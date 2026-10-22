'use client';

import Link from 'next/link';
import { SETTING } from '@/data/cases';
import { useProgress } from '@/hooks/useProgress';

const PERSISTENCE_LABEL = {
  nube: 'ARCHIVO CENTRAL · nube',
  local: 'REGISTRO LOCAL · equipo',
  offline: 'SIN ENLACE · offline',
};

export function PersistenceBadge() {
  const { persistence, firebaseEnabled } = useProgress();
  return (
    <span
      className={`persistence persistence--${persistence}`}
      role="status"
      title={firebaseEnabled ? undefined : 'Firebase no está configurado: el progreso se guarda en este navegador.'}
    >
      <span className="persistence__dot" aria-hidden="true" />
      {PERSISTENCE_LABEL[persistence]}
    </span>
  );
}

// Marco de la terminal B3-T02: header, contenido y footer. La degradación visual
// depende de la influencia (dedos archivados) y se desactiva con "Reducir efectos".
export default function Terminal({ children, crumbs, footer }) {
  const { operator, influence, settings, hydrated } = useProgress();
  return (
    <div
      className="terminal"
      data-influence={hydrated ? influence : 0}
      data-reduce={settings.reduceEffects ? 'true' : 'false'}
    >
      <header className="terminal__bar">
        <div className="terminal__brand">
          <Link href="/indice" className="terminal__kanji" aria-label="Índice de expedientes">
            呪術高専
          </Link>
          <span className="glitch" data-text="SISTEMA DE EXPEDIENTES · DEPÓSITO B3">
            SISTEMA DE EXPEDIENTES · DEPÓSITO B3
          </span>
          <span className="terminal__muted">{SETTING.terminal}</span>
        </div>
        <div className="terminal__meta">
          <span>
            {SETTING.date} · {SETTING.time}
          </span>
          <span>{operator} · N.º 0417</span>
          <PersistenceBadge />
        </div>
      </header>
      {crumbs ? <nav className="terminal__crumbs" aria-label="Ruta">{crumbs}</nav> : null}
      <div className="terminal__body">{children}</div>
      <footer className="terminal__foot">
        <span>SEB v4.2.1 · {SETTING.terminal} · SESIÓN 7F3A-0417</span>
        {footer ?? <span>USO RESTRINGIDO · TODA SESIÓN QUEDA REGISTRADA</span>}
      </footer>
      <svg className="grain" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="11" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.05  1.1 0 0 0 -0.45" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
