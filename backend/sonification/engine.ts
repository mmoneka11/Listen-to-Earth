/**
 * Listen to Earth — Web Audio Sonification Engine
 * Clean, zero-dependency browser-native sonification module.
 *
 * Implements:
 *   - C Major Pentatonic Pitch Mapping (Value / Hue)
 *   - Brightness-driven Low-pass Filter & Loudness
 *   - Coverage-driven Rhythmic Pulse Layers (Hot)
 *   - Constant-Power Binaural Stereo Panning (PanX)
 *   - Dual Harmonic Chime Accent (Events / Anomalies)
 *   - 65.41 Hz C2 Grounding Sub-Drone
 *   - Brickwall Dynamics Compression
 */

export interface SonificationFrame {
  i?: number;
  value?: number;
  hue?: number;
  brightness?: number;
  hot?: number;
  coverage?: number;
  panX?: number;
  centroid_x?: number;
  delta?: number;
  change?: number;
  event?: boolean;
}

export const PENTATONIC_FREQUENCIES: number[] = [
  130.81, 146.83, 164.81, 196.00, 220.00, // C3 - A3
  261.63, 293.66, 329.63, 392.00, 440.00, // C4 - A4
  523.25, 587.33, 659.25, 783.99, 880.00, // C5 - A5
  1046.50, 1174.66, 1318.51, 1567.98, 1760.00 // C6 - A6
];

export class SonificationPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private droneGain: GainNode | null = null;
  private melodyOsc: OscillatorNode | null = null;
  private melodyFilter: BiquadFilterNode | null = null;
  private melodyGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isInitialized: boolean = false;
  private lastEventTime: number = 0;

  public async init(): Promise<void> {
    if (this.isInitialized && this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const now = this.ctx.currentTime;

    // Master Bus with Brickwall Compressor
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-16, now);
    this.compressor.knee.setValueAtTime(12, now);
    this.compressor.ratio.setValueAtTime(4, now);
    this.compressor.attack.setValueAtTime(0.003, now);
    this.compressor.release.setValueAtTime(0.25, now);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, now);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Continuous Grounding Sub-Drone (65.41 Hz C2)
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(180, now);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.08, now);

    const drone1 = this.ctx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.setValueAtTime(65.41, now);

    const drone2 = this.ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.setValueAtTime(130.82, now);
    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.35, now);
    drone2.connect(harmonicGain);
    harmonicGain.connect(droneFilter);

    drone1.connect(droneFilter);
    droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.compressor);

    drone1.start(now);
    drone2.start(now);

    // Lead Melody Voice
    this.melodyOsc = this.ctx.createOscillator();
    this.melodyOsc.type = 'sine';
    this.melodyOsc.frequency.setValueAtTime(PENTATONIC_FREQUENCIES[5], now); // C4

    this.melodyFilter = this.ctx.createBiquadFilter();
    this.melodyFilter.type = 'lowpass';
    this.melodyFilter.frequency.setValueAtTime(1000, now);
    this.melodyFilter.Q.setValueAtTime(1.8, now);

    this.melodyGain = this.ctx.createGain();
    this.melodyGain.gain.setValueAtTime(0.001, now);

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

    // Noise buffer for accents
    const bufferSize = this.ctx.sampleRate * 0.4;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.isInitialized = true;
  }

  public playFrame(frame: SonificationFrame, frameDurationSeconds: number = 0.12): void {
    if (!this.ctx || !this.isInitialized) return;
    const now = this.ctx.currentTime;

    const val = typeof frame.value === 'number'
      ? Math.max(0, Math.min(1, frame.value))
      : Math.max(0, Math.min(1, ((frame.hue ?? 180) % 360) / 360));

    const brightness = Math.max(0, Math.min(1, frame.brightness ?? 0.5));
    const hot = Math.max(0, Math.min(1, frame.hot ?? frame.coverage ?? 0.0));
    const panX = Math.max(0, Math.min(1, frame.panX ?? frame.centroid_x ?? 0.5));
    const delta = Math.max(0, Math.min(1, frame.delta ?? frame.change ?? 0.0));
    const isEvent = Boolean(frame.event || delta > 0.65);

    // 1. Pitch Mapping
    const numNotes = PENTATONIC_FREQUENCIES.length;
    let noteIdx = Math.floor(val * (numNotes - 1));
    if (brightness > 0.75 && noteIdx < numNotes - 2) noteIdx = Math.min(numNotes - 1, noteIdx + 1);
    const targetFreq = PENTATONIC_FREQUENCIES[noteIdx];

    this.melodyOsc?.frequency.setTargetAtTime(targetFreq, now, 0.04);

    // 2. Brightness & Filter Cutoff
    const targetCutoff = 350 + (4500 - 350) * (brightness ** 1.3);
    this.melodyFilter?.frequency.setTargetAtTime(targetCutoff, now, 0.04);
    this.melodyGain?.gain.setTargetAtTime(0.24 * (0.25 + 0.75 * brightness), now, 0.02);

    // 3. Stereo Panning
    const panVal = (panX * 2 - 1) * 0.85;
    this.panner?.pan.setTargetAtTime(panVal, now, 0.03);

    // 4. Rhythmic Pulses
    if (hot > 0.12 && this.compressor) {
      const count = hot > 0.65 ? 4 : (hot > 0.35 ? 2 : 1);
      const subDuration = frameDurationSeconds / count;
      for (let i = 0; i < count; i++) {
        const pulseTime = now + (i * subDuration);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(targetFreq * 2.0, pulseTime);

        gain.gain.setValueAtTime(0.0001, pulseTime);
        gain.gain.exponentialRampToValueAtTime(0.16 * hot, pulseTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, pulseTime + Math.min(0.08, subDuration * 0.8));

        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(pulseTime);
        osc.stop(pulseTime + subDuration);
      }
    }

    // 5. Event Accent Chimes
    if (isEvent && (performance.now() - this.lastEventTime > 400)) {
      this.lastEventTime = performance.now();
      this.triggerEventChime(panX);
    }
  }

  public triggerEventChime(panX: number = 0.5): void {
    if (!this.ctx || !this.compressor) return;
    const now = this.ctx.currentTime;

    [880.0, 1760.0].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const vol = 0.28 * (idx === 0 ? 0.7 : 0.4);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      if (typeof this.ctx!.createStereoPanner === 'function') {
        const pan = this.ctx!.createStereoPanner();
        pan.pan.setValueAtTime((panX * 2 - 1) * 0.7, now);
        osc.connect(gain);
        gain.connect(pan);
        pan.connect(this.compressor!);
      } else {
        osc.connect(gain);
        gain.connect(this.compressor!);
      }

      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  public pause(): void {
    if (this.melodyGain && this.ctx) {
      this.melodyGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
  }

  public setVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.02);
    }
  }
}
