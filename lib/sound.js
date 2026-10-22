// Sonido generado con Web Audio API (sin archivos): zumbido del fluorescente y golpes de papel.
// Está apagado por defecto y solo arranca después de un gesto del usuario.

let context = null;
let hum = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

export function startHum() {
  const ctx = getContext();
  if (!ctx || hum) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.018;
  const a = ctx.createOscillator();
  a.type = 'sawtooth';
  a.frequency.value = 100;
  const b = ctx.createOscillator();
  b.type = 'sine';
  b.frequency.value = 120;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  a.connect(filter);
  b.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  a.start();
  b.start();
  hum = { a, b, gain };
}

export function stopHum() {
  if (!hum) return;
  hum.a.stop();
  hum.b.stop();
  hum.gain.disconnect();
  hum = null;
}

// Ruido corto filtrado: papel que se despega (suave) o se arranca (seco y fuerte).
export function playPeel(ripped = false) {
  const ctx = getContext();
  if (!ctx) return;
  const duration = ripped ? 0.25 : 0.7;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (ripped ? (1 - t) ** 2 : Math.sin(Math.PI * t) * 0.5);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = ripped ? 'highpass' : 'bandpass';
  filter.frequency.value = ripped ? 1800 : 2600;
  const gain = ctx.createGain();
  gain.gain.value = ripped ? 0.35 : 0.12;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  if (ripped) {
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.frequency.setValueAtTime(90, ctx.currentTime);
    thump.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
    thumpGain.gain.setValueAtTime(0.4, ctx.currentTime);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start();
    thump.stop(ctx.currentTime + 0.4);
  }
}
