// Lecturas que muestran igual la interfaz web y la pantalla de la terminal 3D.
import { VOW_LEAK_LIMIT } from '@/data/endings';

export const LEAK_LIMIT = VOW_LEAK_LIMIT;

// "ABECIAN, J." → "@abecian_j", como figura el operador en la barra de estado.
export function handle(operator) {
  const slug = String(operator ?? 'operador')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `@${slug || 'operador'}`;
}

// "Túnel ferroviario clausurado, Nagano" → "Nagano"; "Santuario derrumbado, Okutama (Tokio)" → "Okutama".
export function shortPlace(place) {
  return String(place).split(',').pop().replace(/\(.*\)/, '').trim();
}

// "Santuario derrumbado, Okutama (Tokio)" → "Santuario derrumbado".
export function placeKind(place) {
  return String(place).split(',')[0].trim();
}

// Estado de la barrera del depósito: baja con la energía filtrada y con cada dedo archivado.
export function barrierReading(leak = 0, influence = 0) {
  const stress = Math.min(1, leak / 8 + influence / 4);
  const percent = Math.round((1 - stress) * 100);
  const status = percent >= 85 ? 'estable' : percent >= 50 ? 'fluctuante' : 'crítica';
  return { stress, percent, status };
}

// Medidor de 30 celdas: amarillo lo estable, rojo lo que fluctúa, vacío lo que ya se perdió.
export function barrierCells(percent, stress, total = 30) {
  const lit = Math.round((percent / 100) * total);
  const red = stress > 0 ? Math.min(lit, Math.max(1, Math.round(stress * 8))) : 0;
  return Array.from({ length: total }, (_, i) => (i < lit - red ? 'y' : i < lit ? 'r' : null));
}

// Cómo se muestra una entrada del registro: hora, texto y detalle a la derecha.
export function logParts(entry) {
  const at = String(entry?.at ?? '').slice(0, 5);
  const text = String(entry?.text ?? '');
  const memory = text.match(/^Detalle registrado: /);
  if (memory) return { at, text: 'Detalle del residuo registrado', detail: 'memoria +1', bad: false };
  const reason = text.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (reason) return { at, text: reason[1], detail: reason[2], bad: true };
  const state = text.match(/^(.*) registrado: (.+)$/);
  if (state) return { at, text: `${state[1]} registrado`, detail: state[2].toLowerCase(), bad: false };
  return { at, text, detail: '', bad: false };
}
