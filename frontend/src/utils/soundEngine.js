import * as Tone from 'tone';

const PENTATONIC_SCALE = ['C', 'D', 'E', 'G', 'A'];

function hueToPentatonicNote(hue = 200, brightness = 0.5) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  // Invert hue so cool blues (210-240) map lower and warm reds (0-30) climb higher
  const warmth = 1 - Math.min(normalizedHue, 240) / 240;
  const idx = Math.min(
    PENTATONIC_SCALE.length - 1,
    Math.floor(warmth * PENTATONIC_SCALE.length)
  );
  const octave = 3 + Math.round(Math.max(0, Math.min(1, brightness)) * 2); // Octaves 3 to 5
  return `${PENTATONIC_SCALE[idx]}${octave}`;
}

class SoundEngine {
  constructor() {
    this.initialized = false;
    this.panner = null;
    this.synth = null;
    this.padSynth = null;
    this.accentSynth = null;
    this.customPlayHandler = null;
  }

  // Hook for Person B (Sobia) to plug in a custom Tone.js function without touching UI code
  registerExternalEngine(customFn) {
    if (typeof customFn === 'function') {
      this.customPlayHandler = customFn;
    }
  }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    this.panner = new Tone.Panner(0).toDestination();

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.06, decay: 0.2, sustain: 0.45, release: 0.7 },
    }).connect(this.panner);

    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 1.0 },
    }).connect(this.panner);

    this.accentSynth = new Tone.MembraneSynth({
      volume: -12,
    }).connect(this.panner);

    this.initialized = true;
  }

  playFrame(frame, masterVolume = 70, _speed = 1.0) {
    if (!this.initialized || !frame) return;

    // If Sobia attached her own Tone.js handler, delegate to it
    if (this.customPlayHandler) {
      this.customPlayHandler(frame, masterVolume);
      return;
    }

    const masterNorm = Math.max(0, Math.min(1, masterVolume / 100));
    if (masterNorm === 0) return;

    // MODE A: optional pre-mapped audio format (frame.audio = {note,octave,...})
    if (frame.audio) {
      const { note, octave, volume, pan, rhythm } = frame.audio;
      const pitch = `${note}${octave}`;
      const gain = Math.max(0.01, ((volume ?? 50) / 100) * masterNorm);

      this.panner.pan.rampTo(Math.max(-1, Math.min(1, pan ?? 0)), 0.08);

      const durationMap = { slow: '2n', medium: '4n', fast: '8n' };
      this.synth.triggerAttackRelease(pitch, durationMap[rhythm] || '4n', undefined, gain);

      if ((frame.change ?? 0) >= 0.08 || rhythm === 'fast') {
        this.accentSynth.triggerAttackRelease('C2', '16n', undefined, gain * 0.45);
      }
      return;
    }

    // MODE B: Team Build Guide normalized feature contract (hue, brightness, hot, panX, delta)
    const {
      hue = 200,
      brightness = 0.5,
      hot = 0.2,
      panX = 0.5,
      delta = 0.05,
    } = frame;

    const pitch = hueToPentatonicNote(hue, brightness);
    const panVal = Math.max(-1, Math.min(1, panX * 2 - 1));
    const gain = Math.max(0.02, (0.25 + brightness * 0.75) * masterNorm);

    this.panner.pan.rampTo(panVal, 0.08);
    this.synth.triggerAttackRelease(pitch, '8n', undefined, gain);

    // Layer harmonic fifth when high-intensity "hot" pixels exceed 0.35
    if (hot > 0.35) {
      const harmonyNote = hueToPentatonicNote(hue - 40, Math.max(0.2, brightness - 0.15));
      this.padSynth.triggerAttackRelease(harmonyNote, '4n', undefined, gain * 0.45);
    }

    // Trigger percussive accent when frame-to-frame delta spikes (> 0.25) or hot > 0.65
    if (delta > 0.25 || hot > 0.65) {
      this.accentSynth.triggerAttackRelease('C2', '16n', undefined, gain * 0.5);
    }
  }

  getNoteForFrame(frame) {
    if (!frame) return { note: 'C4', freq: 261.63 };
    if (frame.audio?.note) {
      const n = `${frame.audio.note}${frame.audio.octave || 4}`;
      try {
        return { note: n, freq: Tone.Frequency(n).toFrequency() };
      } catch {
        return { note: n, freq: 261.63 };
      }
    }
    const hue = frame.hue ?? 200;
    const brightness = frame.brightness ?? 0.5;
    const pitch = hueToPentatonicNote(hue, brightness);
    try {
      return {
        note: pitch,
        freq: Tone.Frequency(pitch).toFrequency(),
      };
    } catch {
      return { note: pitch, freq: 261.63 };
    }
  }

  stopAll() {
    if (!this.initialized) return;
    this.synth?.releaseAll();
    this.padSynth?.releaseAll();
  }

  // Interactive Science Guide & HUD Audition helpers (powered by Tone.js)
  async testScale(note = 'C4') {
    await this.init();
    this.synth.triggerAttackRelease(note, '4n');
  }

  async testGain(gainNorm = 0.7) {
    await this.init();
    this.synth.triggerAttackRelease('G4', '4n', undefined, Math.max(0.05, Math.min(1, gainNorm)));
  }

  async testPan(panVal = -0.5) {
    await this.init();
    this.panner.pan.rampTo(panVal, 0.05);
    this.synth.triggerAttackRelease('E4', '4n');
  }

  async testPulse() {
    await this.init();
    this.synth.triggerAttackRelease('C5', '8n');
  }

  async testAnomaly() {
    await this.init();
    this.accentSynth.triggerAttackRelease('C2', '8n');
  }

  async testCalibration() {
    await this.init();
    ['C3', 'E3', 'G3', 'C4', 'E4'].forEach((note, idx) => {
      setTimeout(() => {
        this.synth.triggerAttackRelease(note, '8n');
      }, idx * 150);
    });
  }

  async auditionDataset(_datasetId = 'co2') {
    await this.init();
    this.playFrame({ hue: 125, brightness: 0.6, hot: 0.4, panX: 0.5, delta: 0.2 });
  }

  setScaleForDataset(_datasetId = 'co2') {
    // Dynamic scale selection hook
  }
}

export const soundEngine = new SoundEngine();
