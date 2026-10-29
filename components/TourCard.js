'use client';

import { useEffect, useRef } from 'react';
import { Key } from '@/components/Shell';

const PLACE = { vault: 'la bóveda', index: 'el sistema de expedientes', case: 'el expediente' };

function awayHref(step) {
  if (step.where === 'index') return `/indice#${step.tab ?? 'sesion'}`;
  if (step.where === 'case') return '/expediente/01';
  return '/';
}

/**
 * Cartel del recorrido guiado. Explica la parte que se está mostrando y, si el paso pide una
 * acción, la espera. Resalta el elemento del paso (atributo data-tour) y bloquea lo demás.
 * Si el paso es en otra pantalla, ofrece ir hasta ahí.
 */
export default function TourCard({ tour, paused = false, placement = 'shell' }) {
  const { active, step, index, total, here, next, skip } = tour;
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // [ENTER] Entendido. Va antes que los atajos de la pantalla para que no abra otra cosa.
  const listen = active && here && step.ack && !paused;
  useEffect(() => {
    if (!listen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '') || target?.closest?.('button, a')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      nextRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listen]);

  if (!active || paused) return null;

  return (
    <aside
      className={`tour tour--${placement}${here && step.side === 'left' ? ' tour--left' : ''}`}
      role="dialog"
      aria-live="polite"
      aria-label={`Recorrido guiado: ${step.title}`}
    >
      {here && step.target ? (
        <style>{`[data-tour~="${step.target}"]{outline:2px solid var(--amarillo);outline-offset:3px;box-shadow:0 0 18px rgba(217,174,58,0.35);}`}</style>
      ) : null}
      <p className="eyebrow">
        Recorrido · paso {index + 1} de {total}
      </p>
      {here ? (
        <>
          <h2 className="tour__title">{step.title}</h2>
          <p className="tour__text">{step.text}</p>
          <div className="tour__actions">
            {step.ack ? (
              <Key k="ENTER" variant="fill" onClick={next}>
                Entendido
              </Key>
            ) : (
              <span className="tour__wait">
                Esperando
                <span className="cursor" aria-hidden="true" />
              </span>
            )}
            <button type="button" className="tour__skip" onClick={skip}>
              Saltar recorrido
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="tour__title">{step.title}</h2>
          <p className="tour__text">
            El recorrido sigue en {PLACE[step.where]}. Lo demás queda bloqueado hasta completar este paso.
          </p>
          <div className="tour__actions">
            <Key k="↵" variant="fill" href={awayHref(step)}>
              Ir al paso
            </Key>
            <button type="button" className="tour__skip" onClick={skip}>
              Saltar recorrido
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
