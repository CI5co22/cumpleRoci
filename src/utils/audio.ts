/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;

// Pentatonic scale frequencies (Hz) centered around peaceful cosmic registers
// Scale: G4, A4, C5, D5, E5, G5, A5, C6, D6, E6
const CHIME_PITCHES = [
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50, // C6
  1174.66, // D6
  1318.51  // E6
];

export function playCelestialChime(index?: number) {
  try {
    // Lazy initialize AudioContext on user interaction to comply with browser autoplay policies
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Pick a pitch - either specific or random
    const pitchIndex = index !== undefined ? index % CHIME_PITCHES.length : Math.floor(Math.random() * CHIME_PITCHES.length);
    const frequency = CHIME_PITCHES[pitchIndex];

    // Main carrier oscillator (Sine for pure, clean tone)
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    // Harmonic oscillator (Triangle for gentle warmth and bell-like chime)
    const harmonicOsc = audioCtx.createOscillator();
    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.setValueAtTime(frequency * 2, now); // An octave above

    // Gain node for envelope (quick attack, long celestial decay)
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02); // Quick swell
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.0); // Gentle 3-second decay

    const harmonicGain = audioCtx.createGain();
    harmonicGain.gain.setValueAtTime(0, now);
    harmonicGain.gain.linearRampToValueAtTime(0.03, now + 0.01);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); // Fades faster than fundamental

    // Delay/Echo effect to make it feel like deep, open space
    const delay = audioCtx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.35, now);

    const feedback = audioCtx.createGain();
    feedback.gain.setValueAtTime(0.45, now); // Sweet 45% echo feedback

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now); // Filter out harsh high-frequency noise from echoes

    // Connect echo chain
    gainNode.connect(delay);
    harmonicGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(filter);
    filter.connect(delay); // Create loop

    // Create a reverb/ambient swell node
    const mainMix = audioCtx.createGain();
    mainMix.gain.setValueAtTime(1.0, now);

    // Connect everything to destination
    osc.connect(gainNode);
    harmonicOsc.connect(harmonicGain);

    gainNode.connect(mainMix);
    harmonicGain.connect(mainMix);
    filter.connect(mainMix); // Mix in the delayed chime

    mainMix.connect(audioCtx.destination);

    // Start oscillators
    osc.start(now);
    harmonicOsc.start(now);

    // Stop and clean up nodes after decay is finished to prevent memory leaks
    osc.stop(now + 3.5);
    harmonicOsc.stop(now + 3.5);
  } catch (error) {
    console.warn('Audio feedback failed to initialize:', error);
  }
}
