'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Terminal from '@/components/Terminal';
import { CASES, MEMORY_TOTAL, SETTING } from '@/data/cases';
import { canOfferVow } from '@/data/endings';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';

// EXP-00: el archivo que no debería existir. Acá la autorización desaparece
// y, según lo que el operador descubrió, Sukuna ofrece un Voto Vinculante.
export default function FinalArchive() {
  const router = useRouter();
  const { progress, hydrated, operator, settings, decide, finish } = useProgress();
  const [phase, setPhase] = useState('reading');
  const unlocked = isCaseUnlocked(progress, '00');
  const vow = canOfferVow(progress);

  useEffect(() => {
    if (hydrated && !unlocked) router.replace('/indice');
  }, [hydrated, unlocked, router]);

  // La orden de mantenimiento se tacha sola unos segundos después de abrir el expediente.
  useEffect(() => {
    if (phase !== 'reading') return undefined;
    const timer = setTimeout(() => setPhase('revoked'), settings.reduceEffects ? 600 : 3200);
    return () => clearTimeout(timer);
  }, [phase, settings.reduceEffects]);

  const end = (endingId, decision) => {
    decide('vow', decision);
    finish(endingId);
    router.push(`/final/${endingId}`);
  };

  return (
    <Terminal footer={<span className="red">EXP-00 · ORIGEN DEL REGISTRO: DESCONOCIDO</span>}>
      <div className="final">
        <aside className="final__side">
          <div className="label">ÍNDICE · {SETTING.lot}</div>
          <div className="case-row case-row--new">
            <strong>EXP-00</strong> <span className="red">NUEVO</span>
            <div className="muted">Caja B3-11 · sin responsable · 0 sellos</div>
          </div>
          {CASES.map((c) => (
            <div key={c.id} className="case-row">
              <strong>{c.code}</strong> <span className="muted">ARCHIVADO</span>
              <div className="muted">{c.place}</div>
            </div>
          ))}
          <div className="label">DETALLES REGISTRADOS {progress.memory.length} / {MEMORY_TOTAL}</div>
          <div className="label">RESIDUO EN BÓVEDA {progress.leak}</div>
        </aside>

        <article className="final__doc">
          <div className="label red">EXP-00 · NO FIGURA EN EL REGISTRO CENTRAL</div>
          <h1 className="display">Caja B3-11</h1>
          <p className="lead">
            El hueco vacío de la estantería no estaba vacío. Adentro hay un cuarto dedo, sin sellos, y el registro de la
            Ventana N.º 0391.
          </p>
          <hr />
          <section className="report">
            <div className="label">INFORME 01 · 02/04/2016</div>
            <p>Control de integridad del EXP-01 completo. Sello 2 debilitado, reemplazado. Sin novedades.</p>
            <div className="label">INFORME 07 · S/F</div>
            <p className="smudge">Los sellos no protegen los dedos. Protegen a quien los esconde.</p>
            <div className="label">INFORME 09 · S/F</div>
            <p>
              Encontré la caja B3-11. Mañana me piden el informe. No fui la primera. El próximo operador asignado es
            </p>
            <p className="brush">{operator}</p>
          </section>

          <section className={`order ${phase !== 'reading' ? 'is-revoked' : ''}`} aria-live="polite">
            <div className="label">AUTORIZACIÓN VIGENTE</div>
            <p className="order__text">
              {SETTING.maintenanceOrder} · Mantenimiento de sellos del {SETTING.lot}. Asignado a: {operator}.
            </p>
            {phase !== 'reading' ? (
              <p className="order__status red">
                ORDEN SIN REGISTRO EN ARCHIVO CENTRAL. LA APERTURA DE SELLOS FIGURA COMO NO AUTORIZADA.
              </p>
            ) : null}
          </section>
        </article>

        <aside className="final__decision">
          {phase === 'reading' ? (
            <p className="muted">Leyendo el expediente…</p>
          ) : vow ? (
            <>
              <div className="label red">ORIGEN: DESCONOCIDO · NO ES UN MENSAJE DEL SISTEMA</div>
              <p className="invader">Te borraron el permiso. Van a venir por vos.</p>
              <p className="invader">Hagamos un Voto: olvidás todo y vivís. A cambio, uno de mis dedos sale de acá.</p>
              <button type="button" className="btn btn--danger btn--block" onClick={() => end('voto', 'accepted')}>
                Aceptar el Voto
              </button>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => end('ejecutado', 'refused')}>
                Rechazar y entregar el informe
              </button>
              <p className="mono small muted">La decisión queda registrada en esta partida.</p>
            </>
          ) : (
            <>
              <div className="label red">NOTIFICACIÓN DE LA JUNTA DE SUPERIORES</div>
              <p>
                Los residuos de grado especial en las manos de {operator} prueban la apertura de los sellos. No existe autorización registrada.
                Presentarse en el Depósito B3.
              </p>
              <button type="button" className="btn btn--primary btn--block" onClick={() => end('ejecutado', 'none')}>
                Presentarse
              </button>
              <p className="mono small muted">
                Encontraste {progress.memory.length} de {MEMORY_TOTAL} detalles. Con más memoria, quizás alguien te hubiera
                ofrecido otra salida.
              </p>
            </>
          )}
          <Link href="/indice" className="link">Volver al índice</Link>
        </aside>
      </div>
    </Terminal>
  );
}
