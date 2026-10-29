'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import DomainExpansion from '@/components/DomainExpansion';
import Shell, { Cells, Key, ScreenHead, handle, useHotkeys } from '@/components/Shell';
import { MEMORY_TOTAL, SETTING } from '@/data/cases';
import { canOfferVow } from '@/data/endings';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { LEAK_LIMIT } from '@/lib/readings';

const ORDER = SETTING.maintenanceOrder.split(' ').pop();

// EXP-00: el archivo que no debería existir. Acá la autorización desaparece
// y, según lo que el operador descubrió, Sukuna ofrece un Voto Vinculante.
export default function FinalArchive() {
  const router = useRouter();
  const { progress, hydrated, operator, settings, decide, finish } = useProgress();
  const [phase, setPhase] = useState('reading');
  const [domain, setDomain] = useState(false);
  const unlocked = isCaseUnlocked(progress, '00');
  const vow = canOfferVow(progress);

  // Si Sukuna va a ofrecer el Voto, los modelos del dominio se descargan mientras se lee.
  useEffect(() => {
    if (hydrated && unlocked && vow) import('@/three/domainModels').then((m) => m.loadDomainModels());
  }, [hydrated, unlocked, vow]);

  useEffect(() => {
    if (hydrated && !unlocked) router.replace('/indice');
  }, [hydrated, unlocked, router]);

  // La orden de mantenimiento desaparece sola unos segundos después de abrir el expediente.
  useEffect(() => {
    if (phase !== 'reading') return undefined;
    const timer = setTimeout(() => setPhase('revoked'), settings.reduceEffects ? 600 : 3200);
    return () => clearTimeout(timer);
  }, [phase, settings.reduceEffects]);

  // El final queda registrado al decidir. Aceptar el Voto abre antes la expansión de dominio.
  const end = (endingId, decision) => {
    decide('vow', decision);
    finish(endingId);
    if (endingId === 'voto') setDomain(true);
    else router.push(`/final/${endingId}`);
  };
  const leaveDomain = useCallback(() => router.push('/final/voto'), [router]);

  useHotkeys(
    vow
      ? { v: () => end('voto', 'accepted'), r: () => end('ejecutado', 'refused') }
      : { p: () => end('ejecutado', 'none') },
    phase !== 'reading' && !domain,
  );

  const hints = phase === 'reading' ? 'Leyendo el expediente…' : vow ? '[V] Aceptar el Voto  [R] Rechazar' : '[P] Presentarse';

  return (
    <Shell active="lote" hints={hints}>
      <ScreenHead eyebrow="EXP-00 · No figura en el registro central" tone="red" title="Caja B3-11" />
      <div className="final">
        <article className="panel final__doc">
          <p className="lead">
            El hueco vacío de la estantería no estaba vacío. Adentro hay un cuarto dedo, sin sellos, y el registro de la Ventana
            N.º 0391.
          </p>
          <div className="report-row">
            <span className="eyebrow eyebrow--plain">Informe 01 · 02/04/2016</span>
            <p>Control de integridad del EXP-01 completo. Sello 2 debilitado, reemplazado. Sin novedades.</p>
          </div>
          <div className="report-row">
            <span className="eyebrow eyebrow--plain">Informe 07 · S/F</span>
            <p className="smudge">Los sellos no protegen los dedos. Protegen a quien los esconde.</p>
          </div>
          <div className="report-row">
            <span className="eyebrow eyebrow--plain">Informe 09 · S/F</span>
            <p>Encontré la caja B3-11. Mañana me piden el informe. No fui la primera. El próximo operador asignado es</p>
            <p className="brush">{operator}</p>
          </div>
        </article>

        <aside className="stack">
          {phase === 'reading' ? (
            <section className="panel stack" aria-live="polite">
              <span className="eyebrow">Autorización vigente</span>
              <p className="order__text">
                {ORDER} · Mantenimiento de sellos del {SETTING.lot}. Asignado a: {handle(operator)}.
              </p>
              <p className="small muted">Leyendo el expediente…</p>
            </section>
          ) : (
            <section className="panel panel--red authz" role="alert">
              <span className="small">{ORDER}</span>
              <h2 className="authz__title">
                Autorización
                <br />
                no encontrada
              </h2>
              <p className="small">Orden sin registro en el archivo central. La apertura de sellos figura como no autorizada.</p>
            </section>
          )}

          {phase === 'reading' ? null : vow ? (
            <section className="panel panel--alert stack">
              <span className="eyebrow eyebrow--red">Origen: desconocido · no es un mensaje del sistema</span>
              <p className="invader">Te borraron el permiso. Van a venir por vos.</p>
              <p className="invader">Hagamos un Voto: olvidás todo y vivís. A cambio, uno de mis dedos sale de acá.</p>
              <div className="keys">
                <Key k="V" variant="red" onClick={() => end('voto', 'accepted')}>
                  Aceptar el Voto
                </Key>
                <Key k="R" onClick={() => end('ejecutado', 'refused')}>
                  Rechazar y entregar el informe
                </Key>
              </div>
              <p className="small muted">La decisión queda registrada en esta partida.</p>
            </section>
          ) : (
            <section className="panel stack">
              <span className="eyebrow eyebrow--red">Notificación de la junta de superiores</span>
              <p>
                Los residuos de grado especial en las manos de {operator} prueban la apertura de los sellos. No existe autorización
                registrada. Presentarse en el Depósito B3.
              </p>
              <div className="keys">
                <Key k="P" variant="fill" onClick={() => end('ejecutado', 'none')}>
                  Presentarse
                </Key>
              </div>
              <p className="small muted">
                Encontraste {progress.memory.length} de {MEMORY_TOTAL} detalles. Con más memoria, quizás alguien te hubiera ofrecido otra
                salida.
              </p>
            </section>
          )}

          <section className="panel readout" aria-label="Lecturas">
            <div className="readout__row">
              <span>memoria</span>
              <Cells value={progress.memory.length} max={MEMORY_TOTAL} />
              <span>
                {progress.memory.length}/{MEMORY_TOTAL}
              </span>
            </div>
            <div className="readout__row">
              <span>filtrado</span>
              <Cells value={Math.min(progress.leak, LEAK_LIMIT)} max={LEAK_LIMIT} tone="r" />
              <span className={progress.leak ? 'red' : ''}>
                {progress.leak}/{LEAK_LIMIT}
              </span>
            </div>
          </section>
          <div className="keys">
            <Key href="/indice#lote">Volver al lote</Key>
          </div>
        </aside>
      </div>
      {domain ? <DomainExpansion reduceEffects={settings.reduceEffects} onDone={leaveDomain} /> : null}
    </Shell>
  );
}
