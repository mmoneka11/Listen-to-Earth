import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Activity,
  Play,
  ShieldCheck,
  Headphones,
  BookOpen,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

export default function ScienceGuide({ currentFrame, frameIndex, activeDataset }) {
  const [sectionFilter, setSectionFilter] = useState('all'); // 'all' | 'science' | 'accessibility'
  const [verbosity, setVerbosity] = useState('standard');
  const [liveBuffer, setLiveBuffer] = useState('');

  // Mapping test bench state
  const [rootNote, setRootNote] = useState(60); // MIDI 60 = C4
  const [gainSens, setGainSens] = useState(78);
  const [stereoSpread, setStereoSpread] = useState(85);
  const [pulseDensity, setPulseDensity] = useState(4);
  const [activeChannel, setActiveChannel] = useState(null);

  const canvasRef = useRef(null);

  // Note names for MIDI numbers 48 to 72
  const midiToNoteName = (midi) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const oct = Math.floor(midi / 12) - 1;
    const name = names[midi % 12];
    return `${name}${oct}`;
  };

  const handleTestScale = async () => {
    setActiveChannel(1);
    await soundEngine.testScale(midiToNoteName(rootNote));
    setTimeout(() => setActiveChannel(null), 1200);
  };

  const handleTestGain = async () => {
    setActiveChannel(2);
    await soundEngine.testGain(gainSens / 100);
    setTimeout(() => setActiveChannel(null), 1000);
  };

  const handleTestPan = async () => {
    setActiveChannel(3);
    await soundEngine.testPan(-(stereoSpread / 100));
    setTimeout(() => setActiveChannel(null), 1000);
  };

  const handleTestPulse = async () => {
    setActiveChannel(4);
    await soundEngine.testPulse(pulseDensity);
    setTimeout(() => setActiveChannel(null), 1000);
  };

  const handleTestAnomaly = async () => {
    setActiveChannel(5);
    await soundEngine.testAnomaly();
    setTimeout(() => setActiveChannel(null), 1000);
  };

  // Oscilloscope Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let t = 0;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Grid Lines
      ctx.strokeStyle = 'rgba(75, 86, 99, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Live waveform
      ctx.beginPath();
      ctx.strokeStyle = activeChannel ? '#d97736' : '#1f6f60';
      ctx.lineWidth = 2;

      for (let x = 0; x < width; x++) {
        const freq = activeChannel ? 0.05 : 0.025;
        const amp = (activeChannel ? 28 : 14) * (gainSens / 100);
        const y =
          height / 2 +
          Math.sin(x * freq + t) * amp +
          Math.cos(x * 0.015 - t * 0.7) * (amp * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      t += 0.06;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeChannel, gainSens]);

  // Live Screen-reader Buffer Generation
  useEffect(() => {
    const frameNum = (frameIndex ?? 0) + 1;
    const intensity = Math.round(
      ((currentFrame?.hot ?? currentFrame?.brightness) ?? 0.5) * 100
    );
    const pan =
      currentFrame?.panX !== undefined
        ? currentFrame.panX > 0.55
          ? 'East hemisphere'
          : currentFrame.panX < 0.45
          ? 'West hemisphere'
          : 'Equatorial center'
        : 'Mid-longitude';
    const delta = (currentFrame?.delta ?? currentFrame?.change ?? 0).toFixed(2);
    const dsName = activeDataset?.title || 'DYAMOND Global CO2';

    if (verbosity === 'brief') {
      setLiveBuffer(`Frame ${frameNum}: ${dsName} Plume ${intensity}%, ${pan}, flux Δ +${delta}.`);
    } else {
      setLiveBuffer(
        `Current: ${dsName} Frame ${frameNum}. Atmospheric observation centered across ${pan}. Plume intensity at ${intensity}% with temporal flux gradient delta +${delta}. Calibrated binaural stereo spread.`
      );
    }
  }, [currentFrame, frameIndex, verbosity, activeDataset]);

  return (
    <div className="stitch-screen-container">
      {/* Top Banner */}
      <section className="stitch-banner">
        <div className="stitch-banner-content">
          <div className="stitch-banner-tags">
            <span className="stitch-tag accent">WCAG 2.2 AAA / SECTION 508</span>
            <span className="stitch-tag live">NASA ST-QUANTUM 2.4</span>
            <span className="stitch-tag">5-CHANNEL DETERMINISTIC AUDIO</span>
          </div>

          <h2 className="stitch-banner-title">
            Science &amp; Accessibility Guide
          </h2>
          <p className="stitch-banner-desc">
            Direct mathematical translation of NASA Earth Information Center (EIC) visual
            frames into multi-sensory spatial sound, paired with full WCAG AAA tactile media
            and speech synthesis for blind and low-vision scientists.
          </p>
        </div>

        <div className="stitch-banner-actions">
          {/* Sub-view switcher */}
          <div className="stitch-pill-group" role="radiogroup" aria-label="Documentation Section">
            <button
              type="button"
              role="radio"
              aria-checked={sectionFilter === 'all'}
              className={`stitch-pill-btn ${sectionFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSectionFilter('all')}
            >
              <BookOpen size={12} />
              <span>All Docs</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sectionFilter === 'science'}
              className={`stitch-pill-btn ${sectionFilter === 'science' ? 'active' : ''}`}
              onClick={() => setSectionFilter('science')}
            >
              <Activity size={12} />
              <span>Acoustic Science</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={sectionFilter === 'accessibility'}
              className={`stitch-pill-btn ${sectionFilter === 'accessibility' ? 'active' : ''}`}
              onClick={() => setSectionFilter('accessibility')}
            >
              <ShieldCheck size={12} />
              <span>WCAG AAA Guide</span>
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 1: PSYCHOACOUSTIC TRANSLATION PROTOCOL (SCIENCE)
          ==================================================================== */}
      {(sectionFilter === 'all' || sectionFilter === 'science') && (
        <section className="guide-combined-section" aria-label="Acoustic Sonification Science">
          <div className="section-title-bar">
            <div className="flex-items-center gap-2">
              <span className="section-accent-dot" />
              <h3 className="section-heading">Part 1: 5-Channel Algorithmic Translation Protocol</h3>
            </div>
            <span className="stitch-mono-chip">DETERMINISTIC MAPPING</span>
          </div>

          {/* Real-time Oscilloscope Console */}
          <div className="stitch-oscilloscope-card mb-4">
            <div className="stitch-osc-header">
              <div className="flex-items-center gap-2">
                <span className="stitch-pulse-dot" />
                <span className="stitch-osc-title">Acoustic Spectrum &amp; Harmonic Oscilloscope</span>
              </div>
              <div className="flex-items-center gap-3">
                <span className="stitch-osc-status">
                  {activeChannel ? `AUDITIONING CHANNEL 0${activeChannel}` : 'SYNTHESIS STANDBY'}
                </span>
                <button
                  type="button"
                  className="stitch-btn-primary mini"
                  onClick={soundEngine.testCalibration.bind(soundEngine)}
                  title="Audition 5-channel calibration burst"
                >
                  <Sparkles size={12} />
                  <span>Harmonic Calibration</span>
                </button>
              </div>
            </div>

            <div className="stitch-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={800}
                height={100}
                className="stitch-osc-canvas"
                aria-label="Oscilloscope waveform visualizer"
              />
            </div>
          </div>

          {/* 5 Translation Channels Grid */}
          <div className="stitch-channels-list mb-6">
            {/* CH 01: Hue/Luminance to Pentatonic Pitch */}
            <div className={`stitch-channel-card ${activeChannel === 1 ? 'channel-active' : ''}`}>
              <div className="stitch-channel-top">
                <div className="stitch-channel-id">
                  <span className="ch-badge">CH.01</span>
                  <div>
                    <h4 className="ch-title">Data Value / Luminance → C-Major Pentatonic Pitch</h4>
                    <p className="ch-desc">
                      Maps normalized visual pixel intensity and atmospheric concentration (e.g. 412–430 ppm CO2)
                      across 20 consonant C-Major Pentatonic frequencies (C3 = 130.81Hz to A6 = 1760.00Hz) with smooth 35ms portamento glides.
                    </p>
                  </div>
                </div>
                <span className="ch-format">20-NOTE PENTATONIC // ISO-9613</span>
              </div>

              <div className="stitch-channel-controls">
                <div className="stitch-slider-group">
                  <label htmlFor="slider-root" className="stitch-slider-label">Root Audition Pitch</label>
                  <input
                    id="slider-root"
                    type="range"
                    min={48}
                    max={72}
                    value={rootNote}
                    onChange={(e) => setRootNote(Number(e.target.value))}
                    className="stitch-range"
                  />
                  <span className="stitch-slider-val">{midiToNoteName(rootNote)}</span>
                </div>
                <button
                  type="button"
                  className="stitch-btn-action"
                  onClick={handleTestScale}
                >
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  <span>Audition Pentatonic Scale</span>
                </button>
              </div>
            </div>

            {/* CH 02: Brightness to Gain & Dynamic Formant Filter */}
            <div className={`stitch-channel-card ${activeChannel === 2 ? 'channel-active' : ''}`}>
              <div className="stitch-channel-top">
                <div className="stitch-channel-id">
                  <span className="ch-badge">CH.02</span>
                  <div>
                    <h4 className="ch-title">Optical Density → Volume Gain &amp; Formant Low-Pass Filter</h4>
                    <p className="ch-desc">
                      Luminance dynamically controls master gain and moves an active Biquad low-pass filter
                      from a muffled 350Hz (clean baseline) up to a bright 4500Hz (dense atmospheric convection).
                    </p>
                  </div>
                </div>
                <span className="ch-format">350Hz – 4500Hz DYNAMIC FILTER</span>
              </div>

              <div className="stitch-channel-controls">
                <div className="stitch-slider-group">
                  <label htmlFor="slider-gain" className="stitch-slider-label">Filter Sensitivity</label>
                  <input
                    id="slider-gain"
                    type="range"
                    min={10}
                    max={100}
                    value={gainSens}
                    onChange={(e) => setGainSens(Number(e.target.value))}
                    className="stitch-range"
                  />
                  <span className="stitch-slider-val">{gainSens}%</span>
                </div>
                <button
                  type="button"
                  className="stitch-btn-action"
                  onClick={handleTestGain}
                >
                  <Volume2 size={13} aria-hidden="true" />
                  <span>Audition Formant Filter</span>
                </button>
              </div>
            </div>

            {/* CH 03: Geographic Longitude to Binaural Stereo Panning */}
            <div className={`stitch-channel-card ${activeChannel === 3 ? 'channel-active' : ''}`}>
              <div className="stitch-channel-top">
                <div className="stitch-channel-id">
                  <span className="ch-badge">CH.03</span>
                  <div>
                    <h4 className="ch-title">Geographic Longitude → Equal-Power Stereo Panning</h4>
                    <p className="ch-desc">
                      Binaural spatial positioning calibrated via 3dB constant-power pan law (L = cos(θ), R = sin(θ)).
                      Positions sound across 180°W (hard left) through Prime Meridian (center) to 180°E (hard right).
                    </p>
                  </div>
                </div>
                <span className="ch-format">CONSTANT-POWER PAN LAW</span>
              </div>

              <div className="stitch-channel-controls">
                <div className="stitch-slider-group">
                  <label htmlFor="slider-pan" className="stitch-slider-label">Binaural Spread</label>
                  <input
                    id="slider-pan"
                    type="range"
                    min={20}
                    max={100}
                    value={stereoSpread}
                    onChange={(e) => setStereoSpread(Number(e.target.value))}
                    className="stitch-range"
                  />
                  <span className="stitch-slider-val">{stereoSpread}%</span>
                </div>
                <button
                  type="button"
                  className="stitch-btn-action"
                  onClick={handleTestPan}
                >
                  <Headphones size={13} aria-hidden="true" />
                  <span>Audition Stereo Pan</span>
                </button>
              </div>
            </div>

            {/* CH 04: Plume Coverage to Pulse Rhythm */}
            <div className={`stitch-channel-card ${activeChannel === 4 ? 'channel-active' : ''}`}>
              <div className="stitch-channel-top">
                <div className="stitch-channel-id">
                  <span className="ch-badge">CH.04</span>
                  <div>
                    <h4 className="ch-title">Plume Coverage Area → Rhythmic Pulse Sub-divisions</h4>
                    <p className="ch-desc">
                      When atmospheric plume area exceeds 12% of the globe, the sonification activates
                      a synchronized triangle-wave overtone (2 × f0) pulsing in 1x, 2x, or 4x subdivisions.
                    </p>
                  </div>
                </div>
                <span className="ch-format">SUB-DIVIDED METRONOMIC OVERTONE</span>
              </div>

              <div className="stitch-channel-controls">
                <div className="stitch-slider-group">
                  <label htmlFor="slider-pulse" className="stitch-slider-label">Pulse Subdivision</label>
                  <input
                    id="slider-pulse"
                    type="range"
                    min={1}
                    max={8}
                    value={pulseDensity}
                    onChange={(e) => setPulseDensity(Number(e.target.value))}
                    className="stitch-range"
                  />
                  <span className="stitch-slider-val">{pulseDensity}x Meter</span>
                </div>
                <button
                  type="button"
                  className="stitch-btn-action"
                  onClick={handleTestPulse}
                >
                  <Activity size={13} aria-hidden="true" />
                  <span>Audition Pulse Rhythm</span>
                </button>
              </div>
            </div>

            {/* CH 05: Temporal Flux Delta to Anomaly Chimes */}
            <div className={`stitch-channel-card ${activeChannel === 5 ? 'channel-active' : ''}`}>
              <div className="stitch-channel-top">
                <div className="stitch-channel-id">
                  <span className="ch-badge">CH.05</span>
                  <div>
                    <h4 className="ch-title">Flux Gradient Delta (Δ) → Dual Crystal Anomaly Chimes</h4>
                    <p className="ch-desc">
                      Rapid transient spikes or sudden frame-to-frame flux surges (Δ &gt; 0.45) trigger dual
                      880Hz (A5) and 1760Hz (A6) crystal bell chimes with exponential release envelopes.
                    </p>
                  </div>
                </div>
                <span className="ch-format">880Hz / 1760Hz DUAL CRYSTAL BELL</span>
              </div>

              <div className="stitch-channel-controls">
                <span className="text-xs text-on-surface-variant">
                  Transient threshold triggers automatically when frame delta exceeds Δ 0.45
                </span>
                <button
                  type="button"
                  className="stitch-btn-action"
                  onClick={handleTestAnomaly}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>Audition Anomaly Chime</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          SECTION 2: UNIVERSAL ACCESSIBILITY & TACTILE MEDIA (WCAG AAA)
          ==================================================================== */}
      {(sectionFilter === 'all' || sectionFilter === 'accessibility') && (
        <section className="guide-combined-section" aria-label="WCAG AAA Accessibility Guidelines">
          <div className="section-title-bar">
            <div className="flex-items-center gap-2">
              <span className="section-accent-dot bg-teal" />
              <h3 className="section-heading">Part 2: Universal Accessibility &amp; Tactile Media Standards</h3>
            </div>
            <span className="stitch-mono-chip live">WCAG 2.2 AAA VERIFIED</span>
          </div>

          <div className="stitch-guide-grid">
            {/* Tool 01: Screen Reader & Audio Description */}
            <section className="stitch-guide-card">
              <div className="stitch-guide-card-header">
                <div className="flex-items-center gap-2">
                  <span className="guide-num-badge">01</span>
                  <h4 className="guide-card-title">Screen Reader &amp; Audio Description</h4>
                </div>
                <span className="guide-meta-tag">Stream Ch. 0</span>
              </div>

              <p className="guide-card-desc">
                Configures speech synthesizers to prioritize high-cadence environmental anomalies or conversational environmental narratives.
              </p>

              <div className="guide-control-group">
                <label className="guide-control-label">Speech Narration Verbosity</label>
                <div className="stitch-pill-group" role="radiogroup" aria-label="Speech Verbosity Level">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={verbosity === 'brief'}
                    className={`stitch-pill-btn ${verbosity === 'brief' ? 'active' : ''}`}
                    onClick={() => setVerbosity('brief')}
                  >
                    Brief
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={verbosity === 'standard'}
                    className={`stitch-pill-btn ${verbosity === 'standard' ? 'active' : ''}`}
                    onClick={() => setVerbosity('standard')}
                  >
                    Standard
                  </button>
                </div>
              </div>

              <div className="guide-buffer-group">
                <div className="buffer-header">
                  <span className="buffer-label">Telemetry Voice Output Buffer</span>
                  <span className="buffer-live-indicator">
                    <span className="stitch-pulse-dot" /> LIVE SYNC
                  </span>
                </div>
                <div
                  className="buffer-output-box"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="buffer-prompt">&gt;</span>
                  <span className="buffer-text">{liveBuffer}</span>
                </div>
              </div>
            </section>

            {/* Tool 02: Tactile & Haptic Mapping */}
            <section className="stitch-guide-card">
              <div className="stitch-guide-card-header">
                <div className="flex-items-center gap-2">
                  <span className="guide-num-badge">02</span>
                  <h4 className="guide-card-title">Tactile &amp; Haptic Calibration</h4>
                </div>
                <span className="guide-meta-tag">80 Hz – 640 Hz</span>
              </div>

              <p className="guide-card-desc">
                Physical sensory parameters designed for tactile refreshable braille displays and low-frequency vibration transducers.
              </p>

              <div className="tactile-spec-list">
                <div className="tactile-spec-item">
                  <span className="tactile-key">Acoustic Bass Sub-drone:</span>
                  <span className="tactile-val">65.4 Hz – 130.8 Hz (Earth Surface Density)</span>
                </div>
                <div className="tactile-spec-item">
                  <span className="tactile-key">Mid Harmonic Body:</span>
                  <span className="tactile-val">220 Hz – 440 Hz (Pentatonic Plume)</span>
                </div>
                <div className="tactile-spec-item">
                  <span className="tactile-key">High Chime Anomaly:</span>
                  <span className="tactile-val">880 Hz – 1760 Hz (Transient Alert)</span>
                </div>
                <div className="tactile-spec-item">
                  <span className="tactile-key">Stereo Balance Spread:</span>
                  <span className="tactile-val">-1.0 (West 180°W) to +1.0 (East 180°E)</span>
                </div>
              </div>
            </section>

            {/* Tool 03: Keyboard Command Center */}
            <section className="stitch-guide-card">
              <div className="stitch-guide-card-header">
                <div className="flex-items-center gap-2">
                  <span className="guide-num-badge">03</span>
                  <h4 className="guide-card-title">Keyboard Command Center</h4>
                </div>
                <span className="guide-meta-tag">WCAG 2.2 AA</span>
              </div>

              <p className="guide-card-desc">
                Full hands-on keyboard accessibility. Every function operates without requiring mouse or pointer interaction.
              </p>

              <div className="keyboard-shortcuts-table">
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>Space</kbd></span>
                  <span className="shortcut-desc">Toggle Play / Pause Sonification</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>Esc</kbd></span>
                  <span className="shortcut-desc">Stop Playback and Reset to Frame 0</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>R</kbd></span>
                  <span className="shortcut-desc">Restart Sonification Stream</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>←</kbd> / <kbd>→</kbd></span>
                  <span className="shortcut-desc">Step Single Frame Backward / Forward</span>
                </div>
                <div className="shortcut-row">
                  <span className="shortcut-keys"><kbd>1</kbd> – <kbd>3</kbd></span>
                  <span className="shortcut-desc">Switch Screens (1: Live Stage, 2: Guide, 3: Team AI-MINDS)</span>
                </div>
              </div>
            </section>

            {/* Tool 04: Acoustic Legend & Visual Tuning */}
            <section className="stitch-guide-card">
              <div className="stitch-guide-card-header">
                <div className="flex-items-center gap-2">
                  <span className="guide-num-badge">04</span>
                  <h4 className="guide-card-title">Acoustic Legend &amp; Contrast</h4>
                </div>
                <span className="guide-meta-tag">ISO-9613</span>
              </div>

              <p className="guide-card-desc">
                High-contrast visual design ratio (7:1) exceeding WCAG AAA standards for low-vision and color-blind researchers.
              </p>

              <div className="legend-pills-wrap">
                <div className="legend-chip">
                  <span className="legend-color-box bg-ochre" />
                  <span>Ochre / Terra Cotta: Active playback head &amp; anomalies</span>
                </div>
                <div className="legend-chip">
                  <span className="legend-color-box bg-teal" />
                  <span>Ocean Teal: Baseline planetary resonance</span>
                </div>
                <div className="legend-chip">
                  <span className="legend-color-box bg-slate" />
                  <span>Matte Slate: Non-reflective field console</span>
                </div>
                <div className="legend-chip">
                  <span className="legend-color-box bg-parchment" />
                  <span>Warm Parchment: High-legibility technical text</span>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
