import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Gauge,
  Radio,
  Info,
  Keyboard,
  Waves,
  Sparkles,
  ExternalLink,
  Globe,
  Activity,
  Menu,
  X,
} from 'lucide-react';
import VisualizerCanvas from './components/VisualizerCanvas';
import { soundEngine } from './utils/soundEngine';

const BACKEND_API_ORIGIN = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

const BUILTIN_META = {
  demo_orbit: {
    title: 'Demo Orbit Sequence',
    tag: 'ORBIT-01',
    subtitle: 'Right-hemisphere brightening with rising harmonic pitch',
    sourceCitation: 'Frontend Mock Demo Dataset — AI MINDS',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
    isMock: true,
  },
  demo_tilt: {
    title: 'Demo Tilt Sequence',
    tag: 'TILT-02',
    subtitle: 'Left-hemisphere brightening with low-register stereo shift',
    sourceCitation: 'Frontend Mock Demo Dataset — AI MINDS',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
    isMock: true,
  },
};

function buildAutoCaption(frame, index) {
  if (frame.caption) return frame.caption;
  const timeLabel = frame.timestamp || `Frame ${index + 1}`;
  const intensity = Math.round((frame.hot ?? frame.brightness ?? 0.5) * 100);
  const delta = frame.delta ?? frame.change ?? 0;
  const trend = delta > 0.25 ? 'rapid surge detected' : 'steady progression';
  return `${timeLabel}: Atmospheric signal intensity at ${intensity}% (${trend}).`;
}

function resolveFrameCaption(frame, index, timedCaptions = []) {
  const frameNum = frame.i ?? index;
  if (Array.isArray(timedCaptions) && timedCaptions.length > 0) {
    const match = timedCaptions.find(
      (entry) => frameNum >= entry.start && frameNum <= entry.end
    );
    if (match?.text) return match.text;
  }
  return buildAutoCaption(frame, index);
}

function resolveUrlWithBase(pathOrUrl, basePrefix) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${basePrefix}${cleanPath}`;
}

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [datasets, setDatasets] = useState({});
  const [controlsConfig, setControlsConfig] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [speed, setSpeed] = useState(1.0);
  const [announcement, setAnnouncement] = useState('Ready. Select a visualization and press Play.');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeNav, setActiveNav] = useState('stage-section');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    async function loadAllData() {
      const loadedDatasets = {};

      const manifestSources = [
        { manifestUrl: '/manifest.json', assetPrefix: '' },
        {
          manifestUrl: `${BACKEND_API_ORIGIN}/public/manifest.json`,
          assetPrefix: `${BACKEND_API_ORIGIN}/public`,
        },
      ];

      for (const source of manifestSources) {
        try {
          const manifestRes = await fetch(source.manifestUrl);
          if (!manifestRes.ok) continue;

          const manifestData = await manifestRes.json();
          const vizList = Array.isArray(manifestData)
            ? manifestData
            : manifestData.visualizations || manifestData.items || [];

          for (const item of vizList) {
            const vizSlug = item.id || item.viz || 'co2';
            const rawFeaturesPath =
              item.featuresUrl ||
              item.features_url ||
              item.features ||
              `/features/${vizSlug}.json`;
            const resolvedFeaturesUrl = resolveUrlWithBase(
              rawFeaturesPath,
              source.assetPrefix
            );

            try {
              const featRes = await fetch(resolvedFeaturesUrl);
              if (!featRes.ok) continue;
              const featJson = await featRes.json();
              const timedCaptions = featJson.captions || [];

              const frames = (featJson.frames || []).map((f, idx) => {
                const frameNum = f.i ?? idx;
                const padded = String(frameNum).padStart(4, '0');
                const pattern = item.framePattern || item.frame_pattern;

                let rawFramePath = null;
                if (f.image || f.frame_url) {
                  rawFramePath = f.image || f.frame_url;
                } else if (pattern) {
                  rawFramePath = pattern
                    .replace('{index}', padded)
                    .replace(/%0\d+d/g, padded)
                    .replace(/%d/g, String(frameNum));
                } else {
                  const frameFolder = item.frames_dir || item.framesDir || `/frames/${vizSlug}`;
                  rawFramePath = `${frameFolder.replace(/\/$/, '')}/${vizSlug}_${padded}.jpg`;
                }

                const altFramePath = rawFramePath.includes('/frame_')
                  ? rawFramePath.replace('/frame_', '/')
                  : null;

                return {
                  ...f,
                  imageUrl: resolveUrlWithBase(rawFramePath, source.assetPrefix),
                  altImageUrl: resolveUrlWithBase(altFramePath, source.assetPrefix),
                  caption: resolveFrameCaption(f, idx, timedCaptions),
                };
              });

              const datasetKey = featJson.viz || vizSlug;
              loadedDatasets[datasetKey] = {
                id: datasetKey,
                tag: item.svsId ? `NASA SVS #${item.svsId}` : 'NASA EIC',
                title: featJson.title || item.title || datasetKey,
                subtitle:
                  featJson.description ||
                  item.description ||
                  'NASA Earth Information Center visualization',
                fps: featJson.fps || item.fps || 12,
                sourceCitation:
                  item.sourceCitation ||
                  item.source_citation ||
                  'NASA Earth Information Center (earth.gov)',
                sourceUrl:
                  featJson.source_url ||
                  item.source_url ||
                  item.sourceUrl ||
                  'https://svs.gsfc.nasa.gov/5196/',
                isMock: false,
                frames,
              };
            } catch {
              // Skip individual feature file if unavailable
            }
          }

          if (Object.keys(loadedDatasets).length > 0) {
            break;
          }
        } catch {
          // Try next manifest source
        }
      }

      try {
        const mockRes = await fetch('/data/frontend_mock_data.json');
        if (mockRes.ok) {
          const mockJson = await mockRes.json();
          setProjectInfo(mockJson.project);
          setControlsConfig(mockJson.controls);
          setVolume(mockJson.controls?.volume?.default ?? 70);
          setSpeed(mockJson.controls?.playback_speed?.default ?? 1.0);

          const grouped = {};
          for (const frame of mockJson.mock_frames || []) {
            if (!grouped[frame.video_id]) grouped[frame.video_id] = [];
            grouped[frame.video_id].push(frame);
          }

          Object.entries(grouped).forEach(([vid, frames]) => {
            const meta = BUILTIN_META[vid] || {
              title: vid,
              tag: 'DEMO',
              subtitle: 'Mock visualization sequence',
              sourceCitation: 'NASA SVS #5196 (Mock Demo)',
              sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
              isMock: true,
            };
            loadedDatasets[vid] = {
              id: vid,
              ...meta,
              fps: 1,
              frames,
            };
          });
        }
      } catch (err) {
        console.error('Error loading mock JSON:', err);
      }

      setDatasets(loadedDatasets);
      const keys = Object.keys(loadedDatasets);
      if (keys.length > 0) {
        setSelectedId(keys[0]);
      }
    }

    loadAllData();
  }, []);

  const datasetIds = useMemo(() => Object.keys(datasets), [datasets]);
  const activeDataset = datasets[selectedId];
  const activeFrames = activeDataset?.frames || [];
  const currentFrame = activeFrames[frameIndex] || activeFrames[0];

  const handlePlay = async () => {
    if (!activeFrames.length) return;
    await soundEngine.init();
    const startIdx = frameIndex >= activeFrames.length - 1 ? 0 : frameIndex;
    setFrameIndex(startIdx);
    setIsPlaying(true);
    soundEngine.playFrame(activeFrames[startIdx], volume);
    setAnnouncement(`Playing ${activeDataset.title}.`);
  };

  const handlePause = () => {
    setIsPlaying(false);
    soundEngine.stopAll();
    setAnnouncement('Playback paused.');
  };

  const handleStop = () => {
    setIsPlaying(false);
    setFrameIndex(0);
    soundEngine.stopAll();
    setAnnouncement('Playback stopped and reset to frame 1.');
  };

  const handleRestart = async () => {
    if (!activeFrames.length) return;
    await soundEngine.init();
    setFrameIndex(0);
    setIsPlaying(true);
    soundEngine.playFrame(activeFrames[0], volume);
    setAnnouncement('Restarted from frame 1.');
  };

  const handleStepFrame = async (newIndex) => {
    if (!activeFrames.length) return;
    const clamped = Math.max(0, Math.min(activeFrames.length - 1, newIndex));
    setFrameIndex(clamped);
    if (!isPlaying) {
      await soundEngine.init();
      soundEngine.playFrame(activeFrames[clamped], volume);
    }
  };

  const handleSelectDataset = (id) => {
    setIsPlaying(false);
    soundEngine.stopAll();
    setSelectedId(id);
    setFrameIndex(0);
    setAnnouncement(`Selected ${datasets[id]?.title || id}.`);
  };

  useEffect(() => {
    if (!isPlaying || activeFrames.length === 0) {
      clearInterval(timerRef.current);
      return;
    }

    const baseFps = activeDataset?.fps || 1;
    const intervalMs = 1000 / (baseFps * speed);

    timerRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= activeFrames.length) {
          setIsPlaying(false);
          soundEngine.stopAll();
          setAnnouncement('Playback completed.');
          return prev;
        }
        soundEngine.playFrame(activeFrames[next], volume);
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [isPlaying, speed, activeFrames, activeDataset, volume]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) handlePause();
        else handlePlay();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleStop();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const sparklineData = useMemo(() => {
    if (!activeFrames.length) return { points: '', area: '', markers: [] };
    const w = 320;
    const h = 76;
    const padX = 8;
    const padY = 10;
    const count = activeFrames.length;

    const coords = activeFrames.map((f, idx) => {
      const x =
        count === 1
          ? w / 2
          : padX + (idx / (count - 1)) * (w - padX * 2);
      const val = Math.max(0, Math.min(1, f.brightness ?? 0.2));
      const y = h - padY - val * (h - padY * 2);
      return { x, y, val };
    });

    const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area =
      coords.length > 1
        ? `M ${coords[0].x.toFixed(1)},${h} ` +
          coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
          ` L ${coords[coords.length - 1].x.toFixed(1)},${h} Z`
        : '';

    return { points, area, markers: coords };
  }, [activeFrames]);

  if (!activeDataset) {
    return (
      <main className="app-shell">
        <p className="mono-loading">Initializing Listen to Earth...</p>
      </main>
    );
  }

  const speedOptions = controlsConfig?.playback_speed?.options || [0.5, 1.0, 1.5, 2.0];
  const currentPan =
    currentFrame?.audio?.pan !== undefined
      ? currentFrame.audio.pan
      : currentFrame?.panX !== undefined
      ? currentFrame.panX * 2 - 1
      : 0;
  const panPercent = ((Math.max(-1, Math.min(1, currentPan)) + 1) / 2) * 100;
  const progressPercent =
    activeFrames.length > 1 ? (frameIndex / (activeFrames.length - 1)) * 100 : 100;

  const navigateToSection = (sectionId) => {
    setActiveNav(sectionId);
    setMobileNavOpen(false);
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <div className="page-wrapper">
      <div className="starfield-bg" aria-hidden="true" />
      <div className="ambient-aurora" aria-hidden="true" />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement} {currentFrame?.caption}
      </div>

      <nav className="top-navbar" aria-label="Primary Navigation">
        <div className="nav-inner">
          <a
            href="#stage-section"
            className="brand-lockup"
            onClick={(e) => {
              e.preventDefault();
              navigateToSection('stage-section');
            }}
          >
            <span className="brand-emblem" aria-hidden="true">
              <Globe size={18} />
            </span>
            <span className="brand-text">
              <span className="brand-name">Listen to Earth</span>
              <span className="brand-sub">NASA Space Apps · {projectInfo?.team || 'AI MINDS'}</span>
            </span>
          </a>

          <div className={`nav-links ${mobileNavOpen ? 'open' : ''}`}>
            <button
              type="button"
              className={`nav-link ${activeNav === 'stage-section' ? 'active' : ''}`}
              onClick={() => navigateToSection('stage-section')}
            >
              Visualization Stage
            </button>
            <button
              type="button"
              className={`nav-link ${activeNav === 'datasets-section' ? 'active' : ''}`}
              onClick={() => navigateToSection('datasets-section')}
            >
              Datasets
            </button>
            <button
              type="button"
              className={`nav-link ${activeNav === 'mapping-section' ? 'active' : ''}`}
              onClick={() => navigateToSection('mapping-section')}
            >
              Sonification Model
            </button>
            <a
              href={activeDataset.sourceUrl || 'https://svs.gsfc.nasa.gov/5196/'}
              target="_blank"
              rel="noreferrer"
              className="nav-external"
            >
              <span>NASA SVS #5196</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>

          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <div className="app-shell">
        <header className="hero-section">
          <div className="hero-badges">
            <span className="pill-badge cyan">
              <Radio size={13} aria-hidden="true" />
              Earth Information Jukebox
            </span>
            <span className={`pill-badge status ${isPlaying ? 'playing' : ''}`}>
              <span className="pulse-dot" aria-hidden="true" />
              {isPlaying ? 'Live Sonification Active' : 'Ready to Stream'}
            </span>
            <span className="pill-badge muted">
              {activeDataset.isMock ? 'Demo Dataset' : 'NASA EIC Pipeline'}
            </span>
          </div>

          <div className="hero-split">
            <div className="hero-copy">
              <h1 className="hero-heading">
                Listen to Earth.{' '}
                <span className="gradient-accent">Understand its story.</span>
              </h1>
              <p className="hero-description">
                Experience NASA Earth Information Center visualizations through spatial sound and
                real-time descriptive telemetry—designed for both sighted and blind or low-vision
                explorers.
              </p>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className="btn-primary-hero"
                onClick={isPlaying ? handlePause : handlePlay}
              >
                {isPlaying ? (
                  <>
                    <Pause size={18} fill="currentColor" aria-hidden="true" />
                    <span>Pause Stream</span>
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" aria-hidden="true" />
                    <span>Start Listening</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-secondary-hero"
                onClick={() => navigateToSection('mapping-section')}
              >
                <span>How It Works</span>
              </button>
            </div>
          </div>
        </header>

        <section
          id="stage-section"
          aria-labelledby="stage-heading"
          className="stage-card"
        >
          <div className="stage-topbar">
            <div className="stage-track-meta">
              <span className="track-tag">{activeDataset.tag}</span>
              <div>
                <h2 id="stage-heading" className="stage-title">
                  {activeDataset.title}
                </h2>
                <p className="stage-subtitle">{activeDataset.subtitle}</p>
              </div>
            </div>

            <div className="stage-counters">
              <span className="telemetry-chip">
                Frame {String(frameIndex + 1).padStart(2, '0')} /{' '}
                {String(activeFrames.length).padStart(2, '0')}
              </span>
              <span className="telemetry-chip">
                {formatTime(
                  currentFrame?.timestamp_seconds ??
                    frameIndex / (activeDataset.fps || 1)
                )}
              </span>
            </div>
          </div>

          <VisualizerCanvas
            frame={currentFrame}
            videoTitle={activeDataset.title}
            isPlaying={isPlaying}
            reducedMotion={reducedMotion}
          />

          <div className="narration-bar" role="region" aria-label="Live frame audio description">
            <div className="narration-badge">
              <Waves size={15} aria-hidden="true" />
              <span>Live Audio Description</span>
            </div>
            <p key={`${selectedId}-${frameIndex}`} className="narration-text">
              {currentFrame?.caption}
            </p>
          </div>

          <div className="player-dock" role="group" aria-label="Earth Jukebox Audio Player">
            <div className="timeline-row">
              <span className="time-code">
                {formatTime(
                  currentFrame?.timestamp_seconds ??
                    frameIndex / (activeDataset.fps || 1)
                )}
              </span>
              <div className="scrubber-track-wrap">
                <label htmlFor="frame-scrubber" className="sr-only">
                  Timeline frame position
                </label>
                <input
                  id="frame-scrubber"
                  type="range"
                  min={0}
                  max={Math.max(0, activeFrames.length - 1)}
                  value={frameIndex}
                  style={{ '--progress': `${progressPercent}%` }}
                  onChange={(e) => handleStepFrame(Number(e.target.value))}
                  aria-label={`Timeline scrubber, frame ${frameIndex + 1} of ${activeFrames.length}`}
                />
              </div>
              <span className="time-code">
                {formatTime(
                  activeFrames[activeFrames.length - 1]?.timestamp_seconds ??
                    Math.max(0, activeFrames.length - 1) / (activeDataset.fps || 1)
                )}
              </span>
            </div>

            <div className="dock-controls-row">
              <div className="dock-left-status">
                <span className={`playback-pill ${isPlaying ? 'active' : ''}`}>
                  {isPlaying ? 'Playing' : frameIndex > 0 ? 'Paused' : 'Standby'}
                </span>
                {currentFrame?.audio && (
                  <span className="note-readout">
                    Note {currentFrame.audio.note}
                    {currentFrame.audio.octave} · {currentFrame.audio.rhythm}
                  </span>
                )}
              </div>

              <div className="dock-transport">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleRestart}
                  aria-label={controlsConfig?.restart?.label || 'Restart audio'}
                  title="Restart (R)"
                >
                  <RotateCcw size={17} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleStepFrame(frameIndex - 1)}
                  disabled={frameIndex === 0}
                  aria-label="Previous frame"
                  title="Previous frame"
                >
                  <SkipBack size={18} aria-hidden="true" />
                </button>

                {!isPlaying ? (
                  <button
                    type="button"
                    className="play-circle-btn"
                    onClick={handlePlay}
                    aria-label={controlsConfig?.play?.label || 'Play audio'}
                    title="Play (Space)"
                  >
                    <Play size={22} fill="currentColor" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="play-circle-btn playing"
                    onClick={handlePause}
                    aria-label={controlsConfig?.pause?.label || 'Pause audio'}
                    title="Pause (Space)"
                  >
                    <Pause size={22} fill="currentColor" aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleStepFrame(frameIndex + 1)}
                  disabled={frameIndex >= activeFrames.length - 1}
                  aria-label="Next frame"
                  title="Next frame"
                >
                  <SkipForward size={18} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleStop}
                  aria-label={controlsConfig?.stop?.label || 'Stop audio'}
                  title="Stop (Esc)"
                >
                  <Square size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="dock-right-settings">
                <label className="dock-control-pill" htmlFor="volume-slider">
                  {volume === 0 ? (
                    <VolumeX size={16} className="cyan-icon" aria-hidden="true" />
                  ) : (
                    <Volume2 size={16} className="cyan-icon" aria-hidden="true" />
                  )}
                  <span className="control-readout">{volume}%</span>
                  <input
                    id="volume-slider"
                    type="range"
                    min={controlsConfig?.volume?.min ?? 0}
                    max={controlsConfig?.volume?.max ?? 100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label={controlsConfig?.volume?.label || 'Volume'}
                  />
                </label>

                <label className="dock-control-pill" htmlFor="speed-select">
                  <Gauge size={16} className="cyan-icon" aria-hidden="true" />
                  <select
                    id="speed-select"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label={controlsConfig?.playback_speed?.label || 'Playback speed'}
                  >
                    {speedOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}x
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className="lower-grid">
          <section
            id="datasets-section"
            aria-labelledby="picker-heading"
            className="glass-card"
          >
            <div className="card-header">
              <div>
                <h2 id="picker-heading">Visualization Sequences</h2>
                <p className="card-caption">Select a planetary dataset to sonify</p>
              </div>
              <span className="key-hint">Arrow Keys</span>
            </div>

            <div role="radiogroup" aria-label="Earth visualization datasets" className="dataset-list">
              {datasetIds.map((id, idx) => {
                const ds = datasets[id];
                const selected = id === selectedId;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`dataset-item ${selected ? 'selected' : ''}`}
                    onClick={() => handleSelectDataset(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        handleSelectDataset(datasetIds[(idx + 1) % datasetIds.length]);
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        handleSelectDataset(
                          datasetIds[(idx - 1 + datasetIds.length) % datasetIds.length]
                        );
                      }
                    }}
                  >
                    <div className="dataset-item-top">
                      <span className="dataset-code">{ds.tag}</span>
                      <span className="dataset-count">{ds.frames.length} frames</span>
                    </div>
                    <span className="dataset-name">{ds.title}</span>
                    <span className="dataset-desc">{ds.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="telemetry-heading" className="glass-card">
            <div className="card-header">
              <div>
                <h2 id="telemetry-heading">Frame Telemetry &amp; Trajectory</h2>
                <p className="card-caption">Real-time luminance, spatial pan, and sequence curve</p>
              </div>
              <Activity size={18} className="cyan-icon" aria-hidden="true" />
            </div>

            <div className="kpi-row">
              <div className="kpi-box">
                <span className="kpi-label">Luminance</span>
                <span className="kpi-val">
                  {Math.round((currentFrame?.brightness ?? 0) * 100)}%
                </span>
              </div>
              <div className="kpi-box">
                <span className="kpi-label">Frame Delta</span>
                <span className="kpi-val">
                  {(currentFrame?.change ?? currentFrame?.delta ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="kpi-box">
                <span className="kpi-label">Stereo Pan</span>
                <span className="kpi-val">
                  {currentPan >= 0 ? `+${currentPan.toFixed(2)}` : currentPan.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="spatial-meter">
              <div className="spatial-labels">
                <span>West (-1.0)</span>
                <span>Spatial Field</span>
                <span>East (+1.0)</span>
              </div>
              <div className="spatial-bar" aria-hidden="true">
                <div className="spatial-mid" />
                <div className="spatial-dot" style={{ left: `${panPercent}%` }} />
              </div>
            </div>

            <div className="sparkline-panel">
              <div className="sparkline-header">
                <span>Sequence Brightness Curve</span>
                <span>Frame {frameIndex + 1} highlighted</span>
              </div>
              <svg
                viewBox="0 0 320 76"
                className="sparkline-svg"
                role="img"
                aria-label="Sequence brightness trajectory across frames"
              >
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {sparklineData.area && <path d={sparklineData.area} fill="url(#sparkFill)" />}
                {sparklineData.points && (
                  <polyline
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklineData.points}
                  />
                )}
                {sparklineData.markers.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === frameIndex ? 4.5 : 2.5}
                    fill={idx === frameIndex ? '#2DD4BF' : '#7DD3FC'}
                    stroke={idx === frameIndex ? '#040814' : 'none'}
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </div>
          </section>
        </div>

        <section
          id="mapping-section"
          aria-labelledby="mapping-heading"
          className="glass-card"
        >
          <div className="card-header">
            <div>
              <h2 id="mapping-heading">Data-to-Sound Translation Model</h2>
              <p className="card-caption">
                Consistent, explainable rules grounded in pixel-level Earth visualization features
              </p>
            </div>
            <Sparkles size={18} className="violet-icon" aria-hidden="true" />
          </div>

          <div className="model-grid">
            <div className="model-card">
              <span className="model-tag cyan">01 · Color &amp; Hue</span>
              <h3>Pentatonic Pitch</h3>
              <p>
                Dominant color values map onto a consonant five-note pentatonic scale, climbing in
                pitch as atmospheric concentrations intensify.
              </p>
            </div>
            <div className="model-card">
              <span className="model-tag teal">02 · Brightness</span>
              <h3>Octave &amp; Gain</h3>
              <p>
                Frame luminance governs harmonic register and acoustic volume, making denser plumes
                sound fuller and brighter.
              </p>
            </div>
            <div className="model-card">
              <span className="model-tag violet">03 · Regional Balance</span>
              <h3>Stereo Panning</h3>
              <p>
                West-to-east brightness shifts smoothly pan the soundscape across left and right
                audio channels.
              </p>
            </div>
            <div className="model-card">
              <span className="model-tag blue">04 · Frame Delta</span>
              <h3>Percussive Accents</h3>
              <p>
                Rapid frame-to-frame changes trigger subtle rhythmic pulses so sudden climate
                events stand out immediately.
              </p>
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-item">
            <Keyboard size={15} className="cyan-icon" aria-hidden="true" />
            <span>
              <strong>Keyboard Controls:</strong> <kbd>Space</kbd> Play / Pause · <kbd>Esc</kbd>{' '}
              Stop · <kbd>R</kbd> Restart · <kbd>Tab</kbd> + <kbd>Arrows</kbd> Switch &amp; Scrub
            </span>
          </div>
          <div className="footer-item">
            <Info size={15} className="cyan-icon" aria-hidden="true" />
            <span>
              {activeDataset.isMock && projectInfo?.important_note
                ? `${projectInfo.important_note} `
                : ''}
              Scientific Data Source:{' '}
              <a
                href={activeDataset.sourceUrl || 'https://svs.gsfc.nasa.gov/5196/'}
                target="_blank"
                rel="noreferrer"
              >
                NASA Scientific Visualization Studio ID #5196 (DYAMOND Global Carbon Dioxide)
              </a>{' '}
              via{' '}
              <a href="https://earth.gov" target="_blank" rel="noreferrer">
                NASA Earth Information Center (earth.gov)
              </a>
              .
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
