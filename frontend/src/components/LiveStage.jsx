import { useState, useMemo } from 'react';
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
  Eye,
  Headphones,
  Waves,
  Activity,
  Sliders,
  Sparkles,
  Compass,
  ShieldCheck,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import VisualizerCanvas from './VisualizerCanvas';
import { NASA_CATALOG } from '../utils/nasaDatasets';
import { soundEngine } from '../utils/soundEngine';

function formatTime(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const SCIENTIFIC_PRESETS = [
  {
    name: 'Pristine Clean Air',
    tag: 'BASE-01',
    brightness: 0.15,
    hot: 0.04,
    panX: 0.50,
    delta: 0.05,
    description: 'Deep C3 warm tone, low filter cutoff (355Hz), center pan',
  },
  {
    name: 'Moderate Urban Plume',
    tag: 'PLUME-02',
    brightness: 0.52,
    hot: 0.32,
    panX: 0.28,
    delta: 0.18,
    description: 'Mid A4 note, West -0.44 stereo shift, 4n steady pulse',
  },
  {
    name: 'Severe Wildfire Convection',
    tag: 'BURST-03',
    brightness: 0.94,
    hot: 0.82,
    panX: 0.76,
    delta: 0.88,
    description: 'Piercing G6 overtone, East +0.52 pan, 8n pulse + dual crystal chime',
  },
  {
    name: 'Western Basin Plume',
    tag: 'WEST-04',
    brightness: 0.65,
    hot: 0.45,
    panX: 0.15,
    delta: 0.22,
    description: '85% Left ear focus (-0.70 pan), vocal register C5',
  },
  {
    name: 'Eastern Surge',
    tag: 'EAST-05',
    brightness: 0.70,
    hot: 0.50,
    panX: 0.85,
    delta: 0.35,
    description: '85% Right ear focus (+0.70 pan), vocal register D5',
  },
];

export default function LiveStage({
  activeDataset,
  activeFrames,
  currentFrame,
  frameIndex,
  isPlaying,
  volume,
  speed,
  reducedMotion,
  onPlay,
  onPause,
  onStop,
  onRestart,
  onStepFrame,
  onVolumeChange,
  onSpeedChange,
  onSelectDataset,
}) {
  const [stageMode, setStageMode] = useState('both'); // 'both' | 'audio-only'
  const [isSandboxMode, setIsSandboxMode] = useState(false); // Auto Stream vs Manual Test Lab

  // Interactive Test Lab / Sandbox Custom Values
  const [customBrightness, setCustomBrightness] = useState(0.55);
  const [customHot, setCustomHot] = useState(0.35);
  const [customPanX, setCustomPanX] = useState(0.50);
  const [customDelta, setCustomDelta] = useState(0.15);
  const [liveAudioPreview, setLiveAudioPreview] = useState(true);

  // Synthesize a live frame object when in manual sandbox mode
  const sandboxFrame = useMemo(() => {
    const val = (412 + customBrightness * 18).toFixed(1);
    const panHemisphere =
      customPanX > 0.55
        ? `+${((customPanX - 0.5) * 2).toFixed(2)} East`
        : customPanX < 0.45
        ? `${((customPanX - 0.5) * 2).toFixed(2)} West`
        : 'Center Meridian';

    return {
      i: 999,
      brightness: customBrightness,
      hot: customHot,
      panX: customPanX,
      delta: customDelta,
      measurementText: `${val} ppm CO2`,
      caption: `Manual Simulation Test Lab — Intensity: ${Math.round(
        customBrightness * 100
      )}% (${val} ppm) · Position: ${panHemisphere} · Plume Area: ${Math.round(
        customHot * 100
      )}% · Flux Delta: Δ ${customDelta.toFixed(2)}.`,
      imageUrl: null, // Renders high-fidelity scientific globe radar
    };
  }, [customBrightness, customHot, customPanX, customDelta]);

  // Fallback safe frame while datasets stream or initialize
  const fallbackFrame = useMemo(
    () => ({
      i: 0,
      brightness: 0.5,
      hot: 0.2,
      panX: 0.5,
      delta: 0,
      measurementText: '418.0 ppm CO2',
      caption: 'Calibrating planetary telemetry stream...',
      imageUrl: null,
    }),
    []
  );

  // The active frame rendered by the viewport and meters
  const effectiveFrame = isSandboxMode ? sandboxFrame : (currentFrame || fallbackFrame);

  // Trigger live sound on manual value changes
  const handleCustomParamChange = (updater, name, val) => {
    updater(val);
    if (liveAudioPreview) {
      soundEngine.init().then(() => {
        const frameData = {
          brightness: name === 'brightness' ? val : customBrightness,
          hot: name === 'hot' ? val : customHot,
          panX: name === 'panX' ? val : customPanX,
          delta: name === 'delta' ? val : customDelta,
        };
        soundEngine.playFrame(frameData, volume, speed);
      });
    }
  };

  const handleApplyPreset = (preset) => {
    setCustomBrightness(preset.brightness);
    setCustomHot(preset.hot);
    setCustomPanX(preset.panX);
    setCustomDelta(preset.delta);
    soundEngine.init().then(() => {
      soundEngine.playFrame(
        {
          brightness: preset.brightness,
          hot: preset.hot,
          panX: preset.panX,
          delta: preset.delta,
        },
        volume,
        speed
      );
    });
  };

  const handleAuditionManualTone = async () => {
    await soundEngine.init();
    soundEngine.playFrame(sandboxFrame, volume, speed);
  };

  const currentPan =
    effectiveFrame?.audio?.pan !== undefined
      ? effectiveFrame.audio.pan
      : effectiveFrame?.panX !== undefined
      ? effectiveFrame.panX * 2 - 1
      : 0;

  const panPercent = ((Math.max(-1, Math.min(1, currentPan)) + 1) / 2) * 100;
  const progressPercent =
    activeFrames.length > 1 ? (frameIndex / (activeFrames.length - 1)) * 100 : 100;

  // Sparkline trajectory computation
  const sparklineData = useMemo(() => {
    if (!activeFrames.length) return { points: '', area: '', markers: [] };
    const w = 320;
    const h = 70;
    const padX = 6;
    const padY = 8;
    const count = activeFrames.length;

    const coords = activeFrames.map((f, idx) => {
      const x = count === 1 ? w / 2 : padX + (idx / (count - 1)) * (w - padX * 2);
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

  // Derived 5-channel acoustic telemetry from soundEngine
  const activeAcoustic = soundEngine.getNoteForFrame(effectiveFrame);
  const currentNote = activeAcoustic.note;
  const currentFreqHz = Math.round(activeAcoustic.freq);
  const currentCutoffHz = Math.round(
    350 + (4500 - 350) * Math.pow(effectiveFrame?.brightness ?? 0.5, 1.3)
  );
  const currentGainDb = Math.round(((effectiveFrame?.brightness ?? 0.5) * 18) - 12);
  const currentDelta = (effectiveFrame?.delta ?? effectiveFrame?.change ?? 0).toFixed(2);
  const currentPulseRate =
    (effectiveFrame?.hot ?? 0.2) > 0.35
      ? '8n (High Density)'
      : (effectiveFrame?.hot ?? 0.2) > 0.12
      ? '4n Steady'
      : 'Muted';
  const currentMeasurement =
    effectiveFrame?.measurementText ||
    `${(412 + (effectiveFrame?.brightness ?? 0.5) * 18).toFixed(1)} ppm`;

  return (
    <div className="stitch-command-deck">
      {/* ====================================================================
          LEFT COLUMN: Telemetry Console & Quick Dataset Switcher
          ==================================================================== */}
      <aside className="deck-column deck-left-panel">
        {/* Dataset Quick Switcher */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <Compass size={14} className="text-primary" />
              <span className="deck-card-title">Planetary Stream Switcher</span>
            </div>
            <span className="deck-chip-mono">6 DATASETS</span>
          </div>

          <div className="deck-dataset-switcher-list">
            {Object.values(NASA_CATALOG).map((ds) => {
              const isSelected = activeDataset.id === ds.id;
              return (
                <button
                  key={ds.id}
                  type="button"
                  className={`deck-dataset-switch-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectDataset && onSelectDataset(ds.id)}
                >
                  <div className="switch-btn-left">
                    <span className="switch-ds-tag">{ds.nasaId}</span>
                    <span className="switch-ds-title">{ds.title}</span>
                  </div>
                  {isSelected && <span className="switch-live-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Scientific KPI Meters */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <Activity size={14} className="text-secondary" />
              <span className="deck-card-title">Live Planetary Telemetry</span>
            </div>
            <span className="deck-chip-mono">ISO-9613</span>
          </div>

          <div className="deck-kpi-grid">
            <div className="deck-kpi-cell highlight">
              <span className="kpi-cell-label">Signal Intensity</span>
              <span className="kpi-cell-val text-primary">{currentMeasurement}</span>
            </div>

            <div className="deck-kpi-cell">
              <span className="kpi-cell-label">Luminance</span>
              <span className="kpi-cell-val">
                {Math.round((effectiveFrame?.brightness ?? 0.5) * 100)}%
              </span>
              <div className="kpi-meter-bar">
                <div
                  className="kpi-meter-fill"
                  style={{
                    width: `${Math.round((effectiveFrame?.brightness ?? 0.5) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="deck-kpi-cell">
              <span className="kpi-cell-label">Plume Concentration</span>
              <span className="kpi-cell-val">
                {Math.round((effectiveFrame?.hot ?? 0.2) * 100)}%
              </span>
              <div className="kpi-meter-bar">
                <div
                  className="kpi-meter-fill bg-ochre"
                  style={{
                    width: `${Math.round((effectiveFrame?.hot ?? 0.2) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="deck-kpi-cell">
              <span className="kpi-cell-label">Flux Delta (Δ)</span>
              <span className="kpi-cell-val">Δ {currentDelta}</span>
            </div>
          </div>

          {/* Spatial Stereo Field Radar */}
          <div className="deck-spatial-field-box">
            <div className="spatial-box-header">
              <span className="spatial-label">Binaural Stereo Position</span>
              <span className="spatial-coord">
                {currentPan > 0
                  ? `+${currentPan.toFixed(2)} East`
                  : `${currentPan.toFixed(2)} West`}
              </span>
            </div>
            <div className="spatial-radar-track">
              <div className="spatial-radar-center-mark" />
              <div className="spatial-radar-pointer" style={{ left: `${panPercent}%` }} />
            </div>
            <div className="spatial-axis-labels">
              <span>180°W</span>
              <span>0° Meridian</span>
              <span>180°E</span>
            </div>
          </div>
        </div>

        {/* Sound Tuning & Domain Specs */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <span className="deck-card-title">Acoustic Tuning Model</span>
            </div>
          </div>
          <div className="deck-tuning-specs">
            <div className="tuning-row">
              <span className="tuning-key">Domain:</span>
              <span className="tuning-val">{activeDataset.domain || activeDataset.category}</span>
            </div>
            <div className="tuning-row">
              <span className="tuning-key">Sound Profile:</span>
              <span className="tuning-val text-primary">{activeDataset.soundProfile}</span>
            </div>
            <div className="tuning-row">
              <span className="tuning-key">Scale:</span>
              <span className="tuning-val">{activeDataset.scale || 'Pentatonic E-Minor'}</span>
            </div>
            <div className="tuning-row">
              <span className="tuning-key">Frequency Range:</span>
              <span className="tuning-val">{activeDataset.frequency || '80Hz – 640Hz'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ====================================================================
          CENTER COLUMN: Primary Observational Stage & Integrated Jukebox
          ==================================================================== */}
      <section className="deck-column deck-center-panel">
        {/* Stage Subheader Bar */}
        <div className="stitch-stage-subheader">
          <div className="stitch-stage-left-meta">
            <div className="flex-items-center gap-2">
              <span className="stitch-rect-indicator" />
              <h2 className="stitch-stage-title">
                {isSandboxMode ? 'Interactive Telemetry Test Lab' : activeDataset.title}
              </h2>
            </div>
            <span className="stitch-mono-chip">
              {isSandboxMode ? 'MANUAL SANDBOX' : activeDataset.tag}
            </span>
            <span className="stitch-mono-chip live">
              <span className="stitch-pulse-dot" />{' '}
              {isSandboxMode ? 'VALUE INJECTOR ACTIVE' : 'STREAM ACTIVE'}
            </span>
          </div>

          {/* Mode Switchers: Auto Stream vs Manual Test Lab + Visual vs Audio-Only */}
          <div className="stage-top-controls-group">
            {/* Primary Toggle: NASA Video vs Manual Value Test Lab */}
            <div className="stitch-mode-selector" role="radiogroup" aria-label="Playback Mode">
              <button
                type="button"
                role="radio"
                aria-checked={!isSandboxMode}
                className={`stitch-mode-btn ${!isSandboxMode ? 'active' : ''}`}
                onClick={() => setIsSandboxMode(false)}
                title="Stream real NASA animation frames"
              >
                <Radio size={13} aria-hidden="true" />
                <span>Auto Stream</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={isSandboxMode}
                className={`stitch-mode-btn highlight ${isSandboxMode ? 'active' : ''}`}
                onClick={() => setIsSandboxMode(true)}
                title="Insert and test custom values directly with real-time sound"
              >
                <FlaskConical size={13} aria-hidden="true" />
                <span>Test &amp; Insert Values</span>
              </button>
            </div>

            {/* Accessibility Toggle: Visual+Audio vs Audio-Only */}
            <div className="stitch-mode-selector" role="radiogroup" aria-label="Experience Mode">
              <button
                type="button"
                role="radio"
                aria-checked={stageMode === 'both'}
                className={`stitch-mode-btn ${stageMode === 'both' ? 'active' : ''}`}
                onClick={() => setStageMode('both')}
                title="Standard multi-sensory presentation"
              >
                <Eye size={13} aria-hidden="true" />
                <span>Visual + Audio</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={stageMode === 'audio-only'}
                className={`stitch-mode-btn ${stageMode === 'audio-only' ? 'active' : ''}`}
                onClick={() => setStageMode('audio-only')}
                title="WCAG AAA accessibility mode for blind & low-vision researchers"
              >
                <Headphones size={13} aria-hidden="true" />
                <span>Audio Only</span>
              </button>
            </div>
          </div>
        </div>

        {/* ====================================================================
            MANUAL VALUE INJECTOR / TEST LAB (WHEN SANDBOX MODE IS ACTIVE)
            ==================================================================== */}
        {isSandboxMode && (
          <div className="stitch-sandbox-panel" role="region" aria-label="Custom Value Injector">
            <div className="sandbox-panel-top">
              <div className="flex-items-center gap-2">
                <FlaskConical size={16} className="text-primary" />
                <h3 className="sandbox-title">Scientific Telemetry Value Injector</h3>
                <span className="sandbox-subtitle">
                  Insert custom parameters below to test the sonification engine and observe live globe coordinates
                </span>
              </div>
              <div className="flex-items-center gap-2">
                <label className="sandbox-toggle-label">
                  <input
                    type="checkbox"
                    checked={liveAudioPreview}
                    onChange={(e) => setLiveAudioPreview(e.target.checked)}
                    className="sandbox-checkbox"
                  />
                  <span>Live Audio Follow</span>
                </label>
                <button
                  type="button"
                  className="stitch-btn-primary mini"
                  onClick={handleAuditionManualTone}
                >
                  <Play size={13} fill="currentColor" />
                  <span>Audition Tone</span>
                </button>
              </div>
            </div>

            {/* 4 Interactive Numeric Inputs & Sliders */}
            <div className="sandbox-controls-grid">
              {/* Parameter 1: Brightness / Concentration */}
              <div className="sandbox-field-card">
                <div className="field-header">
                  <label htmlFor="input-brightness" className="field-label">
                    1. Concentration / Brightness
                  </label>
                  <div className="field-value-inputs">
                    <input
                      id="input-brightness"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={customBrightness}
                      onChange={(e) =>
                        handleCustomParamChange(
                          setCustomBrightness,
                          'brightness',
                          Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                        )
                      }
                      className="sandbox-number-input"
                    />
                    <span className="field-unit">
                      {(412 + customBrightness * 18).toFixed(1)} ppm
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={customBrightness}
                  onChange={(e) =>
                    handleCustomParamChange(
                      setCustomBrightness,
                      'brightness',
                      parseFloat(e.target.value)
                    )
                  }
                  className="stitch-range"
                />
                <span className="field-hint">
                  Controls C-Major Pentatonic Pitch (C3 to A6) and Formant Filter Cutoff
                </span>
              </div>

              {/* Parameter 2: Stereo Longitude PanX */}
              <div className="sandbox-field-card">
                <div className="field-header">
                  <label htmlFor="input-pan" className="field-label">
                    2. Geographic Longitude (PanX)
                  </label>
                  <div className="field-value-inputs">
                    <input
                      id="input-pan"
                      type="number"
                      step="0.02"
                      min="0"
                      max="1"
                      value={customPanX}
                      onChange={(e) =>
                        handleCustomParamChange(
                          setCustomPanX,
                          'panX',
                          Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                        )
                      }
                      className="sandbox-number-input"
                    />
                    <span className="field-unit">
                      {customPanX > 0.5
                        ? `+${((customPanX - 0.5) * 2).toFixed(2)} East`
                        : `${((customPanX - 0.5) * 2).toFixed(2)} West`}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={customPanX}
                  onChange={(e) =>
                    handleCustomParamChange(setCustomPanX, 'panX', parseFloat(e.target.value))
                  }
                  className="stitch-range"
                />
                <span className="field-hint">
                  Calibrated via constant-power binaural pan law (-1.0 West to +1.0 East)
                </span>
              </div>

              {/* Parameter 3: Plume Coverage (Hot) */}
              <div className="sandbox-field-card">
                <div className="field-header">
                  <label htmlFor="input-hot" className="field-label">
                    3. Plume Coverage Area (Hot)
                  </label>
                  <div className="field-value-inputs">
                    <input
                      id="input-hot"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={customHot}
                      onChange={(e) =>
                        handleCustomParamChange(
                          setCustomHot,
                          'hot',
                          Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                        )
                      }
                      className="sandbox-number-input"
                    />
                    <span className="field-unit">{Math.round(customHot * 100)}% Area</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={customHot}
                  onChange={(e) =>
                    handleCustomParamChange(setCustomHot, 'hot', parseFloat(e.target.value))
                  }
                  className="stitch-range"
                />
                <span className="field-hint">
                  Triggers 1x, 2x, or 4x sub-divided rhythmic pulses above 12% coverage
                </span>
              </div>

              {/* Parameter 4: Flux Delta (Anomaly Spike) */}
              <div className="sandbox-field-card">
                <div className="field-header">
                  <label htmlFor="input-delta" className="field-label">
                    4. Flux Gradient Delta (Δ)
                  </label>
                  <div className="field-value-inputs">
                    <input
                      id="input-delta"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={customDelta}
                      onChange={(e) =>
                        handleCustomParamChange(
                          setCustomDelta,
                          'delta',
                          Math.max(0, Math.min(1, parseFloat(e.target.value) || 0))
                        )
                      }
                      className="sandbox-number-input"
                    />
                    <span className="field-unit">Δ {customDelta.toFixed(2)}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={customDelta}
                  onChange={(e) =>
                    handleCustomParamChange(setCustomDelta, 'delta', parseFloat(e.target.value))
                  }
                  className="stitch-range"
                />
                <span className="field-hint">
                  Values &gt; 0.45 trigger dual 880Hz / 1760Hz crystal anomaly chimes
                </span>
              </div>
            </div>

            {/* Quick Scientific Presets Strip */}
            <div className="sandbox-presets-strip">
              <span className="presets-label">NASA Calibration Presets:</span>
              <div className="presets-pills-list">
                {SCIENTIFIC_PRESETS.map((preset) => (
                  <button
                    key={preset.tag}
                    type="button"
                    className="preset-btn-pill"
                    onClick={() => handleApplyPreset(preset)}
                    title={preset.description}
                  >
                    <span className="preset-tag">{preset.tag}</span>
                    <span className="preset-name">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Viewport Card */}
        <div className="stitch-viewport-card">
          {stageMode === 'both' ? (
            <div className="stitch-canvas-container">
              <VisualizerCanvas
                frame={effectiveFrame}
                videoTitle={isSandboxMode ? 'Manual Value Test Lab' : activeDataset.title}
                datasetCategory={activeDataset.category}
                isPlaying={isPlaying || isSandboxMode}
                reducedMotion={reducedMotion}
              />
              {/* Technical HUD Overlay */}
              <div className="stitch-hud-overlay" aria-hidden="true">
                <div className="hud-corner top-left">
                  <span>
                    LAT {(14.8 + Math.sin((effectiveFrame?.i ?? 0) * 0.05) * 6.2).toFixed(2)}°N · LON{' '}
                    {(168.1 - ((effectiveFrame?.panX ?? 0.5)) * 42.0).toFixed(2)}°W
                  </span>
                </div>
                <div className="hud-corner top-right">
                  <span>
                    {isSandboxMode
                      ? 'MANUAL TEST BENCH'
                      : `NASA SVS #${activeDataset.nasaId || '5196'}`}
                  </span>
                </div>
                <div className="hud-corner bottom-left">
                  <span>NOTE: {currentNote} ({currentFreqHz}Hz)</span>
                </div>
                <div className="hud-corner bottom-right">
                  <span>CUTOFF: {currentCutoffHz}Hz // 48kHz STEREO</span>
                </div>
              </div>
            </div>
          ) : (
            /* Dedicated Audio-Only Tactile Viewport (WCAG AAA) */
            <div
              className="stitch-audio-only-viewport"
              role="region"
              aria-label="Audio Only Tactile Display"
            >
              <div className="audio-only-center">
                <div className="audio-only-icon-ring">
                  <Headphones size={48} className="text-primary" />
                </div>
                <h3 className="audio-only-title">Tactile Audio Mode Active</h3>
                <p className="audio-only-desc">
                  Visual globe rendering suppressed to conserve system resources. Multi-sensory
                  spatial acoustic pipeline running at full 48kHz fidelity with synchronized
                  screen-reader telemetry narration.
                </p>

                <div className="audio-only-meters">
                  <div className="audio-meter-box">
                    <span className="meter-label">Active Tone</span>
                    <span className="meter-val text-primary">
                      {currentNote} ({currentFreqHz}Hz)
                    </span>
                  </div>
                  <div className="audio-meter-box">
                    <span className="meter-label">Spatial Pan</span>
                    <span className="meter-val">
                      {currentPan > 0
                        ? `+${currentPan.toFixed(2)}E`
                        : `${currentPan.toFixed(2)}W`}
                    </span>
                  </div>
                  <div className="audio-meter-box">
                    <span className="meter-label">Gain</span>
                    <span className="meter-val">{currentGainDb} dB</span>
                  </div>
                  <div className="audio-meter-box">
                    <span className="meter-label">Telemetry</span>
                    <span className="meter-val">{currentMeasurement}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Synchronized Live Audio Description Narration Strip */}
          <div
            className="stitch-narration-strip"
            role="region"
            aria-label="Live frame audio description"
          >
            <div className="stitch-narration-badge">
              <Waves size={15} aria-hidden="true" />
              <span>Live Narration</span>
            </div>
            <p
              key={`${activeDataset.id}-${frameIndex}-${isSandboxMode}`}
              className="stitch-narration-text"
              aria-live="polite"
            >
              {effectiveFrame?.caption ||
                'Calibrating acoustic features for atmospheric sequence...'}
            </p>
          </div>

          {/* Integrated Jukebox Player Dock (shown in auto stream mode) */}
          {!isSandboxMode ? (
            <div className="stitch-player-dock" role="group" aria-label="Earth Jukebox Audio Player">
              {/* Timeline Scrubber */}
              <div className="stitch-timeline-row">
                <span className="stitch-timecode">
                  {formatTime(effectiveFrame?.timestamp_seconds ?? frameIndex)}
                </span>

                <div className="stitch-scrubber-wrap">
                  <label htmlFor="frame-scrubber" className="sr-only">
                    Timeline frame scrubber
                  </label>
                  <input
                    id="frame-scrubber"
                    type="range"
                    min={0}
                    max={Math.max(0, activeFrames.length - 1)}
                    value={frameIndex}
                    style={{ '--progress': `${progressPercent}%` }}
                    onChange={(e) => onStepFrame(Number(e.target.value))}
                    className="stitch-scrubber-input"
                    aria-label={`Frame scrubber, frame ${frameIndex + 1} of ${activeFrames.length}`}
                  />
                </div>

                <span className="stitch-timecode">
                  {formatTime(
                    activeFrames[activeFrames.length - 1]?.timestamp_seconds ??
                      Math.max(0, activeFrames.length - 1)
                  )}
                </span>
              </div>

              {/* Transport Controls + Volume + Speed */}
              <div className="stitch-controls-row">
                <div className="stitch-playback-status-badge">
                  <span className={`stitch-status-dot ${isPlaying ? 'active' : ''}`} />
                  <span className="stitch-status-text">
                    {isPlaying ? 'PLAYING' : frameIndex > 0 ? 'PAUSED' : 'STANDBY'}
                  </span>
                  <span className="stitch-frame-counter">
                    [FRAME {String(frameIndex + 1).padStart(2, '0')}/
                    {String(activeFrames.length).padStart(2, '0')}]
                  </span>
                </div>

                {/* Center Transport Buttons */}
                <div className="stitch-transport-buttons">
                  <button
                    type="button"
                    className="stitch-icon-btn"
                    onClick={onRestart}
                    aria-label="Restart audio stream"
                    title="Restart (R)"
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="stitch-icon-btn"
                    onClick={() => onStepFrame(frameIndex - 1)}
                    disabled={frameIndex === 0}
                    aria-label="Previous frame"
                    title="Previous frame (Left Arrow)"
                  >
                    <SkipBack size={15} aria-hidden="true" />
                  </button>

                  {!isPlaying ? (
                    <button
                      type="button"
                      className="stitch-play-btn"
                      onClick={onPlay}
                      aria-label="Play audio"
                      title="Play (Space)"
                    >
                      <Play size={18} fill="currentColor" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="stitch-play-btn playing"
                      onClick={onPause}
                      aria-label="Pause audio"
                      title="Pause (Space)"
                    >
                      <Pause size={18} fill="currentColor" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    className="stitch-icon-btn"
                    onClick={() => onStepFrame(frameIndex + 1)}
                    disabled={frameIndex >= activeFrames.length - 1}
                    aria-label="Next frame"
                    title="Next frame (Right Arrow)"
                  >
                    <SkipForward size={15} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="stitch-icon-btn"
                    onClick={onStop}
                    aria-label="Stop playback"
                    title="Stop (Esc)"
                  >
                    <Square size={14} aria-hidden="true" />
                  </button>
                </div>

                {/* Right Controls: Volume + Speed */}
                <div className="stitch-right-controls">
                  <div className="stitch-control-pill">
                    {volume === 0 ? (
                      <VolumeX size={14} className="text-primary" aria-hidden="true" />
                    ) : (
                      <Volume2 size={14} className="text-primary" aria-hidden="true" />
                    )}
                    <span className="stitch-control-val">{volume}%</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume}
                      onChange={(e) => onVolumeChange(Number(e.target.value))}
                      aria-label="Volume slider"
                      className="stitch-mini-slider"
                    />
                  </div>

                  <div className="stitch-control-pill">
                    <Gauge size={14} className="text-secondary" aria-hidden="true" />
                    <select
                      value={speed}
                      onChange={(e) => onSpeedChange(Number(e.target.value))}
                      aria-label="Playback speed"
                      className="stitch-select"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1.0}>1.0x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2.0}>2.0x</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Manual Test Bench Dock */
            <div className="stitch-player-dock sandbox-dock">
              <div className="sandbox-dock-inner">
                <div className="flex-items-center gap-2 text-xs">
                  <span className="stitch-status-dot active" />
                  <span className="font-bold text-primary">LIVE TEST BENCH ACTIVE</span>
                  <span className="text-on-surface-variant">
                    Drag sliders above or type numbers to audition live audio response
                  </span>
                </div>
                <div className="flex-items-center gap-3">
                  <button
                    type="button"
                    className="stitch-btn-secondary mini"
                    onClick={() => {
                      setCustomBrightness(0.5);
                      setCustomHot(0.2);
                      setCustomPanX(0.5);
                      setCustomDelta(0.1);
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Reset Values</span>
                  </button>
                  <button
                    type="button"
                    className="stitch-btn-primary mini"
                    onClick={handleAuditionManualTone}
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Audition Tone</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          RIGHT COLUMN: 5-Channel Translation Rack & Trajectory Graph
          ==================================================================== */}
      <aside className="deck-column deck-right-panel">
        {/* 5-Channel Translation Rack */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <Sliders size={14} className="text-primary" />
              <span className="deck-card-title">5-Channel Acoustic Rack</span>
            </div>
            <span className="deck-chip-mono">LIVE ST-QUANTUM</span>
          </div>

          <div className="deck-rack-channels-list">
            {/* CH 01: Pitch */}
            <div className="deck-rack-channel">
              <div className="rack-ch-header">
                <span className="rack-ch-tag">CH.01</span>
                <span className="rack-ch-title">Pitch (Pentatonic)</span>
                <span className="rack-ch-val text-primary">
                  {currentNote} ({currentFreqHz}Hz)
                </span>
              </div>
              <div className="rack-meter-bar">
                <div
                  className="rack-meter-fill bg-ochre"
                  style={{
                    width: `${Math.round((effectiveFrame?.brightness ?? 0.5) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* CH 02: Gain */}
            <div className="deck-rack-channel">
              <div className="rack-ch-header">
                <span className="rack-ch-tag">CH.02</span>
                <span className="rack-ch-title">Gain &amp; Filter Cutoff</span>
                <span className="rack-ch-val">
                  {currentGainDb}dB ({currentCutoffHz}Hz)
                </span>
              </div>
              <div className="rack-meter-bar">
                <div
                  className="rack-meter-fill"
                  style={{
                    width: `${Math.round((effectiveFrame?.brightness ?? 0.5) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* CH 03: Stereo Pan */}
            <div className="deck-rack-channel">
              <div className="rack-ch-header">
                <span className="rack-ch-tag">CH.03</span>
                <span className="rack-ch-title">Stereo Pan</span>
                <span className="rack-ch-val">
                  {currentPan >= 0 ? `+${currentPan.toFixed(2)}E` : `${currentPan.toFixed(2)}W`}
                </span>
              </div>
              <div className="rack-meter-bar">
                <div className="rack-meter-fill bg-teal" style={{ width: `${panPercent}%` }} />
              </div>
            </div>

            {/* CH 04: Rhythm */}
            <div className="deck-rack-channel">
              <div className="rack-ch-header">
                <span className="rack-ch-tag">CH.04</span>
                <span className="rack-ch-title">Rhythm (Plume Hot)</span>
                <span className="rack-ch-val">{currentPulseRate}</span>
              </div>
              <div className="rack-meter-bar">
                <div
                  className="rack-meter-fill"
                  style={{ width: `${Math.round((effectiveFrame?.hot ?? 0.2) * 100)}%` }}
                />
              </div>
            </div>

            {/* CH 05: Anomaly Delta */}
            <div className="deck-rack-channel">
              <div className="rack-ch-header">
                <span className="rack-ch-tag">CH.05</span>
                <span className="rack-ch-title">Anomaly Chime Spike</span>
                <span className="rack-ch-val text-primary">Δ {currentDelta}</span>
              </div>
              <div className="rack-meter-bar">
                <div
                  className="rack-meter-fill bg-ochre"
                  style={{
                    width: `${Math.min(100, Math.round(Number(currentDelta) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trajectory Sparkline Curve Card */}
        <div className="deck-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <Activity size={14} className="text-secondary" />
              <span className="deck-card-title">Sequence Luminance Curve</span>
            </div>
            <span className="deck-chip-mono">
              {isSandboxMode ? 'MANUAL' : `FRAME ${frameIndex + 1}`}
            </span>
          </div>

          <div className="deck-sparkline-box">
            <svg
              viewBox="0 0 320 70"
              className="deck-sparkline-svg"
              role="img"
              aria-label="Sequence brightness trajectory across frames"
            >
              <defs>
                <linearGradient id="deckSparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d97736" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#d97736" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {sparklineData.area && <path d={sparklineData.area} fill="url(#deckSparkFill)" />}
              {sparklineData.points && (
                <polyline
                  fill="none"
                  stroke="#d97736"
                  strokeWidth="2"
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
                  r={idx === frameIndex ? 4.5 : 2}
                  fill={idx === frameIndex ? '#d97736' : '#1f6f60'}
                  stroke={idx === frameIndex ? '#ffffff' : 'none'}
                  strokeWidth="1.2"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Fast Keyboard Shortcuts Guide */}
        <div className="deck-card deck-shortcuts-card">
          <div className="deck-card-header">
            <div className="flex-items-center gap-2">
              <ShieldCheck size={14} className="text-primary" />
              <span className="deck-card-title">Accessibility Keymap</span>
            </div>
            <span className="deck-chip-mono">WCAG 2.2</span>
          </div>

          <div className="deck-mini-shortcuts">
            <div className="mini-shortcut-item">
              <kbd>Space</kbd>
              <span>Play / Pause</span>
            </div>
            <div className="mini-shortcut-item">
              <kbd>← / →</kbd>
              <span>Step Frames</span>
            </div>
            <div className="mini-shortcut-item">
              <kbd>R</kbd>
              <span>Restart</span>
            </div>
            <div className="mini-shortcut-item">
              <kbd>1 – 3</kbd>
              <span>Screens (1: Stage, 2: Guide, 3: Team)</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
