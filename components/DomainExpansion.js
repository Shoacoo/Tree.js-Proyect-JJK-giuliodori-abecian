'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createDomainAudio } from '@/lib/sound';

const Domain3D = dynamic(() => import('@/components/Domain3D'), { ssr: false, loading: () => null });

// Secuencia: unos segundos a oscuras (los que hagan falta para cargar los modelos, sin
// pasar de MAX_DARK_MS) y después, desde que se enciende el altar, la risa y el apagón.
const MIN_DARK_MS = 3800;
const MAX_DARK_MS = 9000;
const TIMELINE = [
  ['lit', 0],
  ['laugh', 5400],
  ['off', 7800],
  ['done', 9600],
];

// Lo que pasa en cada fase, para lectores de pantalla.
const CAPTION = {
  dark: 'Expansión de dominio. Todo se apaga.',
  lit: 'Se enciende una luz sobre el altar. Sukuna te espera sentado frente a su santuario.',
  laugh: 'Se escucha una risa grave, muy cerca.',
  off: 'Oscuridad.',
  done: '',
};

/**
 * Escena del Voto Vinculante: la expansión de dominio de Sukuna.
 * Maneja el tiempo y el sonido; Domain3D dibuja la escena.
 */
export default function DomainExpansion({ reduceEffects = false, onDone }) {
  const [phase, setPhase] = useState('dark');
  const [muted, setMuted] = useState(false);
  const audio = useRef(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    audio.current?.stop();
    onDone?.();
  }, [onDone]);

  // El audio arranca acá, justo después del click en "Aceptar el Voto" (el navegador lo permite).
  useEffect(() => {
    finished.current = false;
    audio.current = createDomainAudio();
    // Mientras dura la escena, la página de atrás no se desplaza.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timers = [];
    let cancelled = false;
    const start = performance.now();
    const models = import('@/three/domainModels').then((m) => m.loadDomainModels());
    Promise.race([models, new Promise((resolve) => setTimeout(resolve, MAX_DARK_MS))]).then(() => {
      if (cancelled) return;
      const wait = Math.max(0, MIN_DARK_MS - (performance.now() - start));
      TIMELINE.forEach(([next, at]) => timers.push(setTimeout(() => setPhase(next), wait + at)));
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      audio.current?.stop();
      audio.current = null;
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    if (phase === 'lit') audio.current?.ignite();
    if (phase === 'laugh') audio.current?.laugh();
    if (phase === 'off') audio.current?.blackout();
    if (phase === 'done') finish();
  }, [phase, finish]);

  useEffect(() => {
    audio.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  // Fuera del marco de la terminal: sus efectos (grano, temblores) no tocan la escena.
  return createPortal(
    <div className="domain" data-phase={phase} data-reduce={reduceEffects ? 'true' : 'false'} role="dialog" aria-modal="true" aria-label="Expansión de dominio">
      {phase !== 'done' ? <Domain3D phase={phase} reduceEffects={reduceEffects} /> : null}
      <p className="domain__title" aria-hidden="true">
        領域展開
      </p>
      <p className="domain__name" aria-hidden="true">
        伏魔御廚子
      </p>
      {/* Sin sonido, la risa se lee. */}
      {muted && phase === 'laugh' ? <p className="domain__subtitle">[ una risa grave, muy cerca ]</p> : null}
      <p className="sr-only" aria-live="assertive">
        {CAPTION[phase]}
      </p>
      <div className="domain__controls">
        <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
          {muted ? 'Activar sonido' : 'Silenciar'}
        </button>
        <button type="button" onClick={finish}>
          Saltar escena
        </button>
      </div>
    </div>,
    document.body,
  );
}
