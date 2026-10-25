// Sonido generado con Web Audio API (sin archivos): zumbido del fluorescente y golpes de papel.
// Está apagado por defecto y solo arranca después de un gesto del usuario.

let context = null;
let hum = null;
let dread = 0;

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
  // Gruñido grave que late: la energía de los dedos. Arranca en silencio y crece con setHumDread.
  const growl = ctx.createOscillator();
  growl.type = 'triangle';
  growl.frequency.value = 41;
  const growlGain = ctx.createGain();
  growlGain.gain.value = 0;
  const beat = ctx.createOscillator();
  beat.frequency.value = 1.13;
  const beatDepth = ctx.createGain();
  beatDepth.gain.value = 0;
  beat.connect(beatDepth).connect(growlGain.gain);
  growl.connect(growlGain).connect(gain);
  a.start();
  b.start();
  growl.start();
  beat.start();
  hum = { a, b, growl, beat, growlGain, beatDepth, filter, gain };
  setHumDread(dread);
}

/** Cuánto pesa la energía de Sukuna en el zumbido (de 0 a 1). Cambia de a poco. */
export function setHumDread(level) {
  dread = level;
  if (!hum) return;
  const now = hum.gain.context.currentTime;
  hum.a.frequency.setTargetAtTime(100 - level * 14, now, 2);
  hum.filter.frequency.setTargetAtTime(420 + level * 380, now, 2);
  hum.growlGain.gain.setTargetAtTime(level * 0.9, now, 2);
  hum.beatDepth.gain.setTargetAtTime(level * 0.8, now, 2);
  hum.gain.gain.setTargetAtTime(0.018 + level * 0.014, now, 2);
}

export function stopHum() {
  if (!hum) return;
  hum.a.stop();
  hum.b.stop();
  hum.growl.stop();
  hum.beat.stop();
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

// ---------------------------------------------------------------------------
// Expansión de dominio: zumbido grave, el altar que se enciende y una risa.
// La risa se sintetiza: cuerdas vocales (diente de sierra) más aire (ruido), filtradas
// con los formantes de una "a" grave, distorsionadas y con eco de un espacio enorme.

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Respuesta al impulso de una sala gigante: ruido que se apaga de a poco.
function impulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

function gravel(ctx, amount = 6) {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  shaper.curve = curve;
  return shaper;
}

// Una sílaba de la risa ("je", "ja"): golpe de aire y vocal que cae de tono.
function laughSyllable(ctx, out, t, f0, duration, loud) {
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f0 * 1.12, t);
  voice.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + duration);
  const sub = ctx.createOscillator();
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(f0 * 0.56, t);
  sub.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(loud, t + 0.02);
  env.gain.exponentialRampToValueAtTime(loud * 0.45, t + duration * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  const subEnv = ctx.createGain();
  subEnv.gain.setValueAtTime(0.0001, t);
  subEnv.gain.exponentialRampToValueAtTime(loud * 0.5, t + 0.03);
  subEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, duration + 0.05);
  const airEnv = ctx.createGain();
  airEnv.gain.setValueAtTime(loud * 0.8, t);
  airEnv.gain.exponentialRampToValueAtTime(loud * 0.12, t + 0.07);
  airEnv.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  const rough = gravel(ctx, 7);
  voice.connect(env).connect(rough);
  air.connect(airEnv);
  [[620, 5, 1], [1080, 7, 0.55], [2400, 9, 0.22]].forEach(([frequency, q, gain]) => {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = q;
    const level = ctx.createGain();
    level.gain.value = gain * 2.2;
    rough.connect(band);
    airEnv.connect(band);
    band.connect(level).connect(out);
  });
  sub.connect(subEnv).connect(out);

  [voice, sub, air].forEach((node) => {
    node.start(t);
    node.stop(t + duration + 0.05);
  });
}

/** Sonido de la expansión de dominio. Arranca el zumbido; el resto se dispara por fases. */
export function createDomainAudio() {
  const ctx = getContext();
  if (!ctx) return null;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // Compresor al final: la risa y el golpe no saturan los parlantes.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 4, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  reverb.connect(wet).connect(master);
  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(reverb);

  const sources = [];
  const drone = ctx.createGain();
  drone.gain.value = 0;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 170;
  low.connect(drone).connect(bus);
  [36, 36.7, 54.5].forEach((frequency) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    osc.connect(low);
    osc.start();
    sources.push(osc);
  });
  drone.gain.setTargetAtTime(0.1, ctx.currentTime, 1.4);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // Ya estaba detenido.
      }
    });
    master.disconnect();
  };

  return {
    // Las velas se encienden: soplido de fuego y un golpe grave.
    ignite() {
      if (stopped) return;
      const t = ctx.currentTime;
      const whoosh = ctx.createBufferSource();
      whoosh.buffer = noiseBuffer(ctx, 1.2);
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.2;
      band.frequency.setValueAtTime(260, t);
      band.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      whoosh.connect(band).connect(env).connect(bus);
      whoosh.start(t);
      const thump = ctx.createOscillator();
      const thumpEnv = ctx.createGain();
      thump.frequency.setValueAtTime(85, t);
      thump.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      thumpEnv.gain.setValueAtTime(0.7, t);
      thumpEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      thump.connect(thumpEnv).connect(bus);
      thump.start(t);
      thump.stop(t + 0.75);
      drone.gain.setTargetAtTime(0.16, t, 0.8);
    },
    // Risa grave y corta: "je… je je je, ja".
    laugh() {
      if (stopped) return;
      const t = ctx.currentTime + 0.02;
      [
        [0, 96, 0.2, 0.5],
        [0.38, 102, 0.15, 0.6],
        [0.6, 99, 0.15, 0.65],
        [0.82, 94, 0.16, 0.7],
        [1.08, 86, 0.6, 0.8],
      ].forEach(([at, f0, duration, loud]) => laughSyllable(ctx, bus, t + at, f0, duration, loud));
    },
    // Todo se apaga de golpe.
    blackout() {
      if (stopped) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.05);
      setTimeout(stop, 200);
    },
    setMuted(muted) {
      if (stopped) return;
      master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    stop,
  };
}
