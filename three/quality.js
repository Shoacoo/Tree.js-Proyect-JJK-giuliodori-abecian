// Calidad gráfica. "auto" arranca según el equipo y baja sola si los cuadros tardan demasiado.

export const QUALITY_KEY = 'contencion:quality';
const DETECTED_KEY = 'contencion:quality-detected';
const CHANGE_EVENT = 'contencion:quality';

export const QUALITY_PRESETS = {
  alta: { pixelRatio: 1.5, antialias: true, shadows: true, extraLights: true, dust: 420, particles: 500, miasma: 2 },
  baja: { pixelRatio: 1, antialias: false, shadows: false, extraLights: false, dust: 100, particles: 150, miasma: 1 },
};

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la preferencia dura lo que dura la pestaña.
  }
}

/** Preferencia elegida: 'auto', 'alta' o 'baja'. */
export function readQualityPref() {
  const value = read(QUALITY_KEY);
  return value === 'alta' || value === 'baja' ? value : 'auto';
}

export function writeQualityPref(pref) {
  write(QUALITY_KEY, pref === 'auto' ? null : pref);
  if (pref !== 'baja') write(DETECTED_KEY, null);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Señales baratas de un equipo modesto, antes de crear el contexto WebGL.
function looksLowEnd() {
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  const smallTouch = window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 820;
  return cores <= 4 || memory <= 4 || smallTouch;
}

/** Calidad que se usa ahora: 'alta' o 'baja'. */
export function resolveQuality(pref = readQualityPref()) {
  if (pref !== 'auto') return pref;
  if (read(DETECTED_KEY) === 'baja') return 'baja';
  return looksLowEnd() ? 'baja' : 'alta';
}

/** El modo automático detectó un equipo lento: se recuerda para la próxima visita. */
export function downgradeAutoQuality() {
  if (readQualityPref() !== 'auto') return false;
  write(DETECTED_KEY, 'baja');
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return true;
}

export function onQualityChange(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

/** Renderizado por software (sin GPU): siempre calidad baja. */
export function isSoftwareRenderer(renderer) {
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(name);
  } catch {
    return false;
  }
}

/**
 * Mide el tiempo entre cuadros. Si después del arranque el promedio supera el umbral
 * (unos 30 cuadros por segundo), avisa una sola vez.
 */
export function createFrameMonitor(onSlow, { warmup = 2.5, window: span = 4, maxFrameMs = 34 } = {}) {
  let elapsed = 0;
  let total = 0;
  let frames = 0;
  let done = false;
  return (dt) => {
    if (done) return;
    elapsed += dt;
    if (elapsed < warmup) return;
    // Pestaña en segundo plano o pausa larga: no cuenta.
    if (dt > 0.2) return;
    total += dt;
    frames += 1;
    if (total >= span) {
      done = true;
      if ((total / frames) * 1000 > maxFrameMs) onSlow();
    }
  };
}
