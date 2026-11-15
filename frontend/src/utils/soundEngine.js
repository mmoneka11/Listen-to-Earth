/**
 * Listen to Earth — Production Web Audio Sonification Engine
 * NASA Space Apps Challenge 2026: The Earth Information Jukebox
 *
 * Implements exact scientific mappings from sonification/mapping_config.json:
 *   1. Value / Brightness -> C Major Pentatonic Pitch (20 Notes: C3 to A6, always consonant)
 *   2. Brightness         -> Dynamic Low-pass Formant Filter (350Hz - 4500Hz) & Gain
 *   3. Hot / Coverage     -> Rhythmic Pulse Subdivisions (2, 4, 8 pulses per frame)
 *   4. Centroid PanX      -> Constant-Power Binaural Stereo Panning
 *   5. Delta / Flux Rate  -> Dual Harmonic Crystal Accent Chimes (880Hz / 1760Hz)
 *   6. Sub-Drone          -> Continuous 65.41 Hz (C2) Grounding Fundamental
 *   7. Master Dynamics    -> Brickwall Limiter preventing digital clipping
 */

export const PENTATONIC_FREQUENCIES = [
  130.81, 146.83, 164.81, 196.00, 220.00,  // C3, D3, E3, G3, A3
  261.63, 293.66, 329.63, 392.00, 440.00,  // C4, D4, E4, G4, A4 (Mid C)
  523.25, 587.33, 659.25, 783.99, 880.00,  // C5, D5, E5, G5, A5
  1046.50, 1174.66, 1318.51, 1567.98, 1760.00 // C6, D6, E6, G6, A6
];

export const PENTATONIC_NOTE_NAMES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6', 'D6', 'E6', 'G6', 'A6'
];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.droneGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.melodyOsc = null;
    this.melodyFilter = null;
    this.melodyGain = null;
    this.panner = null;
    this.initialized = false;
    this.isPlaying = false;
    this.lastEventTime = 0;
    this.currentScale = PENTATONIC_FREQUENCIES;
    this.currentNotes = PENTATONIC_NOTE_NAMES;
    this.customPlayHandler = null;
  }

  // Hook for team members to register custom tone handlers if desired
  registerExternalEngine(customFn) {
    if (typeof customFn === 'function') {
      this.customPlayHandler = customFn;
    }
  }

  async init() {
    if (this.initialized && this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      const now = this.ctx.currentTime;

      // 1. Master Bus Dynamics Limiter (Soft-knee brickwall compression)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16.0, now);
      this.compressor.knee.setValueAtTime(12.0, now);
      this.compressor.ratio.setValueAtTime(4.0, now);
      this.compressor.attack.setValueAtTime(0.003, now);
      this.compressor.release.setValueAtTime(0.25, now);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, now);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 2. Grounding Sub-Drone (65.41 Hz C2 + 130.82 Hz harmonic overtone)
      const droneFilter = this.ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(180, now);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0.0001, now); // Starts muted until play

      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(65.41, now);

      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(130.82, now);

      const droneHarmonicGain = this.ctx.createGain();
      droneHarmonicGain.gain.setValueAtTime(0.35, now);
      this.droneOsc2.connect(droneHarmonicGain);
      droneHarmonicGain.connect(droneFilter);

      this.droneOsc1.connect(droneFilter);
      droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.compressor);

      this.droneOsc1.start(now);
      this.droneOsc2.start(now);

      // 3. Lead Continuous Melodic Oscillator with Formant Filtering
      this.melodyOsc = this.ctx.createOscillator();
      this.melodyOsc.type = 'sine';
      this.melodyOsc.frequency.setValueAtTime(PENTATONIC_FREQUENCIES[6], now); // D4 mid

      this.melodyFilter = this.ctx.createBiquadFilter();
      this.melodyFilter.type = 'lowpass';
      this.melodyFilter.frequency.setValueAtTime(1200, now);
      this.melodyFilter.Q.setValueAtTime(2.0, now);

      this.melodyGain = this.ctx.createGain();
      this.melodyGain.gain.setValueAtTime(0.0001, now);

      if (typeof this.ctx.createStereoPanner === 'function') {
        this.panner = this.ctx.createStereoPanner();
        this.panner.pan.setValueAtTime(0, now);
        this.melodyOsc.connect(this.melodyFilter);
        this.melodyFilter.connect(this.melodyGain);
        this.melodyGain.connect(this.panner);
        this.panner.connect(this.compressor);
      } else {
        this.melodyOsc.connect(this.melodyFilter);
        this.melodyFilter.connect(this.melodyGain);
        this.melodyGain.connect(this.compressor);
      }

      this.melodyOsc.start(now);
      this.initialized = true;
    } catch (err) {
      console.warn('AudioContext startup awaiting user gesture:', err);
    }
  }

  // Maps frame data to note name and frequency
  getNoteForFrame(frame) {
    if (!frame) return { note: 'C4', freq: 261.63, index: 5 };

    // Support pre-mapped notes
    if (frame.audio?.note && frame.audio?.octave) {
      const name = `${frame.audio.note}${frame.audio.octave}`;
      const idx = this.currentNotes.indexOf(name);
      const freq = idx !== -1 ? this.currentScale[idx] : 261.63;
      return { note: name, freq, index: Math.max(0, idx) };
    }

    // Determine normalized value: prefer brightness or data value
    const val = typeof frame.value === 'number'
      ? Math.max(0, Math.min(1, frame.value))
      : Math.max(0, Math.min(1, frame.brightness ?? 0.5));

    const brightness = Math.max(0, Math.min(1, frame.brightness ?? 0.5));
    const numNotes = this.currentScale.length;
    let noteIdx = Math.floor(val * (numNotes - 1));

    // Subtle octave lift when concentration exceeds 75%
    if (brightness > 0.75 && noteIdx < numNotes - 2) {
      noteIdx = Math.min(numNotes - 1, noteIdx + 1);
    }

    const freq = this.currentScale[noteIdx] || 261.63;
    const note = this.currentNotes[noteIdx] || 'C4';
    return { note, freq, index: noteIdx };
  }

  // Plays a single frame from the live streaming loop
  playFrame(frame, masterVolume = 75, speed = 1.0) {
    if (!this.initialized || !this.ctx || !frame) return;

    if (this.customPlayHandler) {
      this.customPlayHandler(frame, masterVolume);
      return;
    }

    const now = this.ctx.currentTime;
    const masterNorm = Math.max(0, Math.min(1, masterVolume / 100));
    if (masterNorm === 0) {
      this.pause();
      return;
    }

    // Unmute drone on playback
    this.droneGain?.gain.setTargetAtTime(0.08 * masterNorm, now, 0.05);

    // 1. Data-Driven Pitch Mapping
    const { freq } = this.getNoteForFrame(frame);
    this.melodyOsc?.frequency.setTargetAtTime(freq, now, 0.035);

    // 2. Dynamic Brightness Formant Filter Cutoff (350Hz - 4500Hz)
    const brightness = Math.max(0, Math.min(1, frame.brightness ?? 0.5));
    const targetCutoff = 350 + (4500 - 350) * Math.pow(brightness, 1.3);
    this.melodyFilter?.frequency.setTargetAtTime(targetCutoff, now, 0.04);

    // Dynamic Volume: Louder when concentration is intense
    const voiceVolume = 0.32 * (0.25 + 0.75 * brightness) * masterNorm;
    this.melodyGain?.gain.setTargetAtTime(voiceVolume, now, 0.025);

    // 3. Constant-Power Stereo Panning
    const panX = Math.max(0, Math.min(1, frame.panX ?? 0.5));
    const panVal = (panX * 2 - 1) * 0.85;
    this.panner?.pan.setTargetAtTime(panVal, now, 0.03);

    // 4. Rhythmic Pulse Subdivisions for Plume Coverage (Hot)
    const hot = Math.max(0, Math.min(1, frame.hot ?? frame.coverage ?? 0));
    const frameDuration = Math.max(0.05, (1 / (12 * speed)));

    if (hot > 0.12 && this.compressor) {
      const pulseCount = hot > 0.65 ? 4 : hot > 0.35 ? 2 : 1;
      const subDuration = frameDuration / pulseCount;

      for (let i = 0; i < pulseCount; i++) {
        const pulseTime = now + (i * subDuration);
        const osc = this.ctx.createOscillator();
        const pulseGain = this.ctx.createGain();

        // Overtone pulse 1 octave above main melody
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 2.0, pulseTime);

        const pulseVol = Math.min(0.22, 0.16 * hot * masterNorm);
        pulseGain.gain.setValueAtTime(0.0001, pulseTime);
        pulseGain.gain.exponentialRampToValueAtTime(Math.max(0.001, pulseVol), pulseTime + 0.006);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + Math.min(0.09, subDuration * 0.85));

        osc.connect(pulseGain);
        pulseGain.connect(this.compressor);

        osc.start(pulseTime);
        osc.stop(pulseTime + subDuration);
      }
    }

    // 5. Dual Harmonic Crystal Accent Chimes on Rapid Flux Spikes (Delta > 0.45)
    const delta = Math.max(0, Math.min(1, frame.delta ?? frame.change ?? 0));
    const isAnomaly = delta > 0.45 || frame.event;

    if (isAnomaly && (performance.now() - this.lastEventTime > 350)) {
      this.lastEventTime = performance.now();
      this.triggerEventChime(panX, masterNorm);
    }
  }

  // Dual resonant crystal chime for sudden climate surges
  triggerEventChime(panX = 0.5, masterNorm = 0.75) {
    if (!this.ctx || !this.compressor) return;
    const now = this.ctx.currentTime;

    [880.0, 1760.0].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const chimeVol = (idx === 0 ? 0.28 : 0.16) * masterNorm;
      chimeGain.gain.setValueAtTime(chimeVol, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      if (typeof this.ctx.createStereoPanner === 'function') {
        const pan = this.ctx.createStereoPanner();
        pan.pan.setValueAtTime((panX * 2 - 1) * 0.75, now);
        osc.connect(chimeGain);
        chimeGain.connect(pan);
        pan.connect(this.compressor);
      } else {
        osc.connect(chimeGain);
        chimeGain.connect(this.compressor);
      }

      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // Graceful pause / stop
  pause() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.melodyGain?.gain.setTargetAtTime(0.0001, now, 0.04);
    this.droneGain?.gain.setTargetAtTime(0.0001, now, 0.06);
  }

  stopAll() {
    this.pause();
  }

  setVolume(vol = 75) {
    if (this.masterGain && this.ctx) {
      const norm = Math.max(0, Math.min(1, vol / 100));
      this.masterGain.gain.setTargetAtTime(norm, this.ctx.currentTime, 0.02);
    }
  }

  // Switch acoustic tuning scale per NASA dataset domain
  setScaleForDataset(datasetId = 'co2') {
    if (datasetId === 'sst') {
      // D-Benthic Harmonic Minor for Ocean Depth
      this.currentScale = [73.42, 82.41, 87.31, 98.0, 110.0, 146.83, 164.81, 174.61, 196.0, 220.0, 293.66, 329.63, 349.23, 392.0, 440.0];
      this.currentNotes = ['D2', 'E2', 'F2', 'G2', 'A2', 'D3', 'E3', 'F3', 'G3', 'A3', 'D4', 'E4', 'F4', 'G4', 'A4'];
    } else if (datasetId === 'ozone') {
      // C-Major Shimmer for Stratospheric Healing
      this.currentScale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      this.currentNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
    } else {
      // C Major Pentatonic for Atmosphere / Default
      this.currentScale = PENTATONIC_FREQUENCIES;
      this.currentNotes = PENTATONIC_NOTE_NAMES;
    }
  }

  // Interactive Audition Methods for Stitch UI Controls
  async testScale(_root = 'C4') {
    await this.init();
    const notesToPlay = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
    notesToPlay.forEach((n, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.compressor) return;
        const noteIndex = this.currentNotes.indexOf(n);
        const freq = noteIndex !== -1 ? this.currentScale[noteIndex] : 261.63;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.28);

        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.3);
      }, idx * 160);
    });
  }

  async testPan(_panVal = -0.75) {
    await this.init();
    if (!this.ctx || !this.compressor) return;

    [-0.85, 0, 0.85].forEach((pos, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(idx === 1 ? 440 : 329.63, now);
        pan.pan.setValueAtTime(pos, now);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc.connect(gain);
        gain.connect(pan);
        pan.connect(this.compressor);

        osc.start(now);
        osc.stop(now + 0.32);
      }, idx * 300);
    });
  }

  async testGain(gainVal = 0.8) {
    await this.init();
    if (!this.ctx || !this.compressor) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(392.0, now); // G4

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350 + (4500 - 350) * Math.pow(gainVal, 1.3), now);

    gain.gain.setValueAtTime(0.35 * gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  async testPulse(density = 4) {
    await this.init();
    if (!this.ctx || !this.compressor) return;

    for (let i = 0; i < density; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(now);
        osc.stop(now + 0.09);
      }, i * 110);
    }
  }

  async testAnomaly() {
    await this.init();
    this.triggerEventChime(0.7, 0.9);
  }

  async testCalibration() {
    await this.init();
    const chords = [
      [130.81, 261.63, 329.63], // C3, C4, E4
      [146.83, 293.66, 392.00], // D3, D4, G4
      [164.81, 329.63, 440.00], // E3, E4, A4
      [261.63, 523.25, 659.25]  // C4, C5, E5
    ];

    chords.forEach((chord, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.compressor) return;
        const now = this.ctx.currentTime;
        chord.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

          osc.connect(gain);
          gain.connect(this.compressor);
          osc.start(now);
          osc.stop(now + 0.5);
        });
      }, i * 350);
    });
  }

  async auditionDataset(datasetId = 'co2') {
    await this.init();
    this.setScaleForDataset(datasetId);

    const testMotifs = {
      co2: [261.63, 329.63, 392.0, 523.25, 659.25], // C Major Pentatonic
      sst: [73.42, 98.0, 146.83, 196.0, 293.66],    // D-Benthic Deep Cello
      ozone: [261.63, 329.63, 392.0, 523.25, 783.99, 1046.5], // Resonant Bells
      precip: [146.83, 196.0, 293.66, 440.0, 587.33], // Rain Texture
      solar: [196.0, 246.94, 293.66, 369.99, 440.0, 587.33], // Solar Flare
      ice: [123.47, 164.81, 196.0, 246.94, 329.63],  // Glass Marimba
    };

    const seq = testMotifs[datasetId] || testMotifs.co2;
    seq.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.compressor) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        osc.type = datasetId === 'sst' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const panPos = (idx / (seq.length - 1)) * 1.6 - 0.8;
        pan.pan.setValueAtTime(panPos, now);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

        osc.connect(gain);
        gain.connect(pan);
        pan.connect(this.compressor);

        osc.start(now);
        osc.stop(now + 0.35);
      }, idx * 220);
    });
  }
}

export const soundEngine = new SoundEngine();
