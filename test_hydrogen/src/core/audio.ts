import type { AircraftVariant } from './constants.ts';

/**
 * Procedural Web Audio API synthesizer for aircraft engine rumble, wind rush,
 * and checkpoint discovery chimes. Starts safely muted until enabled by user action.
 */
export class FlightAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private enabled = false;

  /**
   * Initializes the Web Audio graph on first user gesture.
   *
   * @returns Whether audio initialization succeeded.
   */
  public init(): boolean {
    if (this.ctx) return true;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      // Engine harmonic drone
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 260;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.08;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 68;

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 34;

      this.engineOsc.connect(this.engineFilter);
      this.engineSubOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.engineSubOsc.start();

      // Filtered white noise for atmospheric wind rush
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 420;
      this.windFilter.Q.value = 0.8;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.04;

      noise.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      noise.start();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggles audio mute/unmute and resumes AudioContext if suspended.
   *
   * @param nextState - Optional explicit enabled state.
   * @returns Current enabled state after toggle.
   */
  public setEnabled(nextState?: boolean): boolean {
    if (!this.ctx) {
      this.init();
    }
    this.enabled = nextState ?? !this.enabled;
    if (this.ctx && this.ctx.state === 'suspended' && this.enabled) {
      void this.ctx.resume();
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.enabled ? 0.55 : 0,
        this.ctx.currentTime,
        0.08
      );
    }
    return this.enabled;
  }

  /**
   * Returns whether flight audio is currently enabled.
   *
   * @returns True if sound is unmuted.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Updates engine pitch and wind filter dynamically each frame based on flight state.
   *
   * @param speedNorm - Normalized speed [0..1].
   * @param altitude - Current altitude above ground.
   * @param variant - Active aircraft variant ('biplane' or 'jet').
   */
  public update(speedNorm: number, altitude: number, variant: AircraftVariant): void {
    if (!this.ctx || !this.enabled || !this.engineOsc || !this.engineSubOsc || !this.engineFilter || !this.engineGain || !this.windFilter || !this.windGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const clampedSpeed = Math.max(0, Math.min(1, speedNorm));

    if (variant === 'biplane') {
      const baseFreq = 52 + clampedSpeed * 56;
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(180 + clampedSpeed * 240, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.065 + clampedSpeed * 0.045, now, 0.08);
    } else {
      const baseFreq = 115 + clampedSpeed * 130;
      this.engineOsc.type = 'sine';
      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(420 + clampedSpeed * 650, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.045 + clampedSpeed * 0.04, now, 0.08);
    }

    // Wind drops off slightly at high orbital altitudes
    const airDensity = Math.max(0.15, 1 - altitude / 45);
    this.windFilter.frequency.setTargetAtTime(300 + clampedSpeed * 900, now, 0.1);
    this.windGain.gain.setTargetAtTime(
      (0.02 + clampedSpeed * 0.075) * airDensity,
      now,
      0.1
    );
  }

  /**
   * Plays an uplifting harmonic arpeggio chime when flying through/over a checkpoint.
   *
   * @param isFinal - True if all checkpoints have just been discovered.
   */
  public playCheckpointChime(isFinal = false): void {
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = isFinal ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = now + idx * 0.075;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.75);
    });
  }
}
