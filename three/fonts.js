// next/font registra las tipografías con nombres generados (por ejemplo "__IBM_Plex_Mono_1a2b").
// El canvas necesita ese nombre real: se lee de las variables CSS que define el layout.
const FALLBACK = {
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  sans: '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif',
  brush: '"Yuji Syuku", "Hiragino Mincho ProN", "Noto Serif JP", serif',
};
const VARS = { mono: '--font-plex', sans: '--font-zen', brush: '--font-yuji' };
const cache = {};

export function fontStack(kind = 'mono') {
  if (cache[kind]) return cache[kind];
  let stack = FALLBACK[kind];
  if (typeof document !== 'undefined') {
    const value = getComputedStyle(document.documentElement).getPropertyValue(VARS[kind]).trim();
    if (value) stack = `${value}, ${FALLBACK[kind]}`;
  }
  cache[kind] = stack;
  return stack;
}

export function font(kind, size, weight = 400) {
  return `${weight} ${size}px ${fontStack(kind)}`;
}
