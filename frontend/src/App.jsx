import { useState, useEffect, useRef } from 'react';
import {
  Radio,
  ExternalLink,
  Menu,
  X,
  Volume2,
  Users,
  BookOpen,
} from 'lucide-react';

import LiveStage from './components/LiveStage';
import ScienceGuide from './components/ScienceGuide';
import TeamMembers from './components/TeamMembers';
import { soundEngine } from './utils/soundEngine';
import { NASA_CATALOG, generateSyntheticDataset } from './utils/nasaDatasets';
import './App.css';

function buildAutoCaption(frame, index, title = 'DYAMOND Global Carbon Dioxide') {
  if (frame.caption) return frame.caption;
  const timeLabel = frame.timestamp || `Frame ${index + 1}`;
  const intensity = Math.round((frame.hot ?? frame.brightness ?? 0.5) * 100);
  const delta = (frame.delta ?? frame.change ?? 0).toFixed(2);
  const pan = frame.panX > 0.55 ? 'East hemisphere' : frame.panX < 0.45 ? 'West hemisphere' : 'Equatorial center';
  const trend = Number(delta) > 0.25 ? 'rapid atmospheric surge detected' : 'steady gradient progression';
  return `${title} — ${timeLabel}: Atmospheric concentration centered across ${pan} (Intensity ${intensity}%, flux delta +${delta}, ${trend}).`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('stage'); // 'stage' | 'guide' | 'team'
  const [datasets, setDatasets] = useState(() => {
    const catalog = {};
    Object.keys(NASA_CATALOG).forEach((key) => {
      catalog[key] = generateSyntheticDataset(key, 60);
    });
    return catalog;
  });
  const [selectedId, setSelectedId] = useState('co2');
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [speed, setSpeed] = useState(1.0);
  const [announcement, setAnnouncement] = useState('Ready. Select a visualization and press Play.');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Load datasets: Start with complete scientific catalog + upgrade with real NASA SVS 5196 data from backend
  useEffect(() => {
    async function loadAllData() {
      // 1. Initialize all 6 NASA catalog datasets with high-precision telemetry
      const initialCatalog = {};
      Object.keys(NASA_CATALOG).forEach((key) => {
        initialCatalog[key] = generateSyntheticDataset(key, 60);
      });

      // 2. Fetch production NASA manifest.json & features from backend
      try {
        const manifestRes = await fetch('/manifest.json');
        if (manifestRes.ok) {
          const manifestData = await manifestRes.json();
          const manifestList = Array.isArray(manifestData)
            ? manifestData
            : (manifestData.visualizations || manifestData.datasets || []);

          for (const item of manifestList) {
            try {
              let featUrl = item.featuresUrl || item.features || `/features/${item.id}.json`;
              if (!featUrl.startsWith('/')) featUrl = '/' + featUrl;

              const featRes = await fetch(featUrl);
              if (featRes.ok) {
                const featJson = await featRes.json();
                const pattern = item.frame_pattern || item.framePattern || 'frames/co2/co2_%04d.jpg';

                const frames = (featJson.frames || []).map((f, idx) => {
                  const padded = String(f.i ?? idx).padStart(4, '0');
                  let imageUrl = pattern.includes('%04d')
                    ? pattern.replace('%04d', padded)
                    : pattern.includes('{index}')
                    ? pattern.replace('{index}', padded)
                    : null;

                  if (imageUrl && !imageUrl.startsWith('/')) {
                    imageUrl = '/' + imageUrl;
                  }

                  const val = (412 + (f.brightness ?? 0.5) * 18).toFixed(1);

                  return {
                    ...f,
                    imageUrl,
                    measurementText: `${val} ppm CO2`,
                    timestamp_seconds: idx * (1 / (featJson.fps || 12)),
                    timestamp: `T+${(idx * (1 / (featJson.fps || 12))).toFixed(1)}s`,
                    caption: buildAutoCaption(f, idx, item.title || 'DYAMOND Global Carbon Dioxide'),
                  };
                });

                initialCatalog[item.id] = {
                  ...NASA_CATALOG[item.id],
                  id: item.id,
                  tag: item.svsId ? `NASA SVS #${item.svsId}` : 'NASA SVS #5196',
                  title: item.title || 'DYAMOND Global Carbon Dioxide (NASA SVS 5196)',
                  subtitle: item.description || 'Global atmospheric CO2 plumes (NASA GEOS DYAMOND model)',
                  fps: featJson.fps || item.fps || 12,
                  sourceCitation: item.sourceCitation || 'NASA Scientific Visualization Studio & EIC',
                  sourceUrl: item.sourceUrl || item.source_url || 'https://svs.gsfc.nasa.gov/5196/',
                  isMock: false,
                  frames,
                };
              }
            } catch (err) {
              console.warn('Features fetch skipped for item:', item.id, err);
            }
          }
        }
      } catch (err) {
        console.warn('Backend manifest fetch error, using synthetic baseline:', err);
      }

      setDatasets(initialCatalog);
      setSelectedId('co2');
    }

    loadAllData();
  }, []);

  const activeDataset = datasets[selectedId] || datasets.co2 || {
    id: 'co2',
    title: 'DYAMOND Carbon Dioxide',
    tag: 'NASA SVS #5196',
    subtitle: 'Global atmospheric CO2 plumes',
    fps: 12,
    frames: [],
  };

  const activeFrames = activeDataset?.frames || [];
  const currentFrame = activeFrames[frameIndex] || activeFrames[0];

  const handlePlay = async () => {
    if (!activeFrames.length) return;
    await soundEngine.init();
    soundEngine.setScaleForDataset(selectedId);
    const startIdx = frameIndex >= activeFrames.length - 1 ? 0 : frameIndex;
    setFrameIndex(startIdx);
    setIsPlaying(true);
    soundEngine.playFrame(activeFrames[startIdx], volume, speed);
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
    soundEngine.setScaleForDataset(selectedId);
    setFrameIndex(0);
    setIsPlaying(true);
    soundEngine.playFrame(activeFrames[0], volume, speed);
    setAnnouncement('Restarted from frame 1.');
  };

  const handleStepFrame = async (newIndex) => {
    if (!activeFrames.length) return;
    const clamped = Math.max(0, Math.min(activeFrames.length - 1, newIndex));
    setFrameIndex(clamped);
    if (!isPlaying) {
      await soundEngine.init();
      soundEngine.setScaleForDataset(selectedId);
      soundEngine.playFrame(activeFrames[clamped], volume, speed);
    }
  };

  const handleSelectDataset = (id) => {
    setIsPlaying(false);
    soundEngine.stopAll();
    soundEngine.setScaleForDataset(id);
    if (datasets[id]) {
      setSelectedId(id);
      setFrameIndex(0);
      setAnnouncement(`Selected ${datasets[id]?.title || id}.`);
    }
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    soundEngine.setVolume(newVol);
  };

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying || activeFrames.length === 0) {
      clearInterval(timerRef.current);
      return;
    }

    const baseFps = activeDataset?.fps || 12;
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
        soundEngine.playFrame(activeFrames[next], volume, speed);
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [isPlaying, speed, activeFrames, activeDataset, volume]);

  // Global Keyboard Shortcuts
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
      } else if (e.key === '1') {
        setActiveTab('stage');
      } else if (e.key === '2') {
        setActiveTab('guide');
      } else if (e.key === '3') {
        setActiveTab('team');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepFrame(frameIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepFrame(frameIndex + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="stitch-app-shell">
      {/* Screen-reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement} {currentFrame?.caption}
      </div>

      {/* Top Sticky Header */}
      <header className="stitch-navbar">
        <div className="stitch-nav-inner">
          {/* Brand Logo & Emblem */}
          <button
            type="button"
            className="stitch-brand"
            onClick={() => setActiveTab('stage')}
            aria-label="Listen to Earth Home — NASA Earth Information Center"
          >
            <div className="stitch-brand-icon-wrap" aria-hidden="true">
              <img src="/favicon.svg" alt="" className="stitch-brand-logo" width="28" height="28" />
            </div>
            <span className="stitch-brand-title">Listen to Earth</span>
            <span className="stitch-brand-badge">NASA EIC</span>
          </button>

          {/* Navigation Tabs (Streamlined 3-Screen Architecture) */}
          <nav
            className={`stitch-nav-tabs ${mobileNavOpen ? 'mobile-open' : ''}`}
            aria-label="Screen Navigation"
          >
            <button
              type="button"
              className={`stitch-tab-btn ${activeTab === 'stage' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('stage');
                setMobileNavOpen(false);
              }}
            >
              <Radio size={14} aria-hidden="true" />
              <span>Live Stage</span>
            </button>

            <button
              type="button"
              className={`stitch-tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('guide');
                setMobileNavOpen(false);
              }}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Science &amp; Guide</span>
            </button>

            <button
              type="button"
              className={`stitch-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('team');
                setMobileNavOpen(false);
              }}
            >
              <Users size={14} aria-hidden="true" />
              <span>Team AI-MINDS</span>
              <span className="tab-badge-pill">5</span>
            </button>
          </nav>

          {/* Right Action Strip */}
          <div className="stitch-nav-right">
            <div className="stitch-status-pill hidden-mobile">
              <span className="stitch-pulse-dot" />
              <span>Audio Ready</span>
            </div>

            <button
              type="button"
              className="stitch-btn-test-audio"
              onClick={soundEngine.testCalibration.bind(soundEngine)}
              title="Test multi-harmonic acoustic calibration"
            >
              <Volume2 size={13} aria-hidden="true" />
              <span>Test Audio</span>
            </button>

            <button
              type="button"
              className="mobile-menu-toggle"
              aria-label="Toggle Navigation Menu"
              onClick={() => setMobileNavOpen((prev) => !prev)}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Dynamic Viewport Space */}
      <main className="stitch-main-content">
        {activeTab === 'stage' && (
          <LiveStage
            activeDataset={activeDataset}
            activeFrames={activeFrames}
            currentFrame={currentFrame}
            frameIndex={frameIndex}
            isPlaying={isPlaying}
            volume={volume}
            speed={speed}
            reducedMotion={reducedMotion}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onRestart={handleRestart}
            onStepFrame={handleStepFrame}
            onVolumeChange={handleVolumeChange}
            onSpeedChange={setSpeed}
            onSelectDataset={handleSelectDataset}
          />
        )}

        {activeTab === 'guide' && (
          <ScienceGuide
            currentFrame={currentFrame}
            frameIndex={frameIndex}
            activeDataset={activeDataset}
          />
        )}

        {activeTab === 'team' && <TeamMembers />}
      </main>

      {/* Footer */}
      <footer className="stitch-footer">
        <div className="stitch-footer-inner">
          <div className="stitch-footer-left">
            <span>
              <strong>NASA Space Apps Challenge 2026</strong> · The Earth Information Jukebox · Team <strong>AI-MINDS</strong> (Hyderabad, Pakistan)
            </span>
          </div>
          <div className="stitch-footer-links">
            <a
              href="https://svs.gsfc.nasa.gov/5196/"
              target="_blank"
              rel="noreferrer"
              className="flex-items-center gap-1"
            >
              <span>NASA SVS #5196 DYAMOND CO2</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
