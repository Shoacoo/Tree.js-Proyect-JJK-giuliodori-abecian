'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import MangaFlashback from '@/components/MangaFlashback';
import Terminal from '@/components/Terminal';
import { SEAL_STATES, SETTING, getCase, nextCaseId } from '@/data/cases';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { playPeel } from '@/lib/sound';

// La escena solo existe en el navegador: se carga sin SSR y con su propio estado de carga.
const Reliquary3D = dynamic(() => import('@/components/Reliquary3D'), {
  ssr: false,
  loading: () => <div className="reliquary-loading">Encendiendo cámara CAM-B3-02…</div>,
});

const HINTS = {
  idle: 'Mantené presionado un sello para despegarlo · Arrastrá para girar · Rueda para acercar',
  hold: 'Despegando… no sueltes hasta que se suelte solo',
  tap: 'Mantené presionado para despegarlo con cuidado. Si soltás antes, se arranca.',
};

export default function CaseFile({ caseId }) {
  const data = getCase(caseId);
  const router = useRouter();
  const { progress, hydrated, settings, influence, operator, peelSeal, markSeal, findMemory, archiveCase } = useProgress();
  const apiRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [hint, setHint] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [openFlashback, setOpenFlashback] = useState(null);
  const [lamp, setLamp] = useState(false);
  const [notes, setNotes] = useState('');

  const caseProgress = progress.cases[caseId];
  const sealState = caseProgress.seals;
  const unlocked = isCaseUnlocked(progress, caseId);
  const peeled = data.seals.filter((s) => sealState[s.id].peeled);
  const marked = data.seals.filter((s) => sealState[s.id].state);
  const activeSeal = peeled.find((s) => !sealState[s.id].state) ?? null;
  const allDone = marked.length === data.seals.length;
  const sealsById = Object.fromEntries(data.seals.map((s) => [s.id, s]));

  useEffect(() => {
    if (hydrated && !unlocked) router.replace('/indice');
  }, [hydrated, unlocked, router]);

  const handlePeel = useCallback(
    (sealId, careful) => {
      const result = peelSeal(caseId, sealId, careful);
      if (!result) return;
      if (settings.sound) playPeel(result.ripped);
      const parts = [];
      if (result.ripped) parts.push('Arrancaste el sello.');
      if (result.outOfOrder) parts.push('No era el siguiente en el orden de retiro.');
      setFeedback(
        parts.length
          ? { tone: 'bad', text: `${parts.join(' ')} Se filtró energía maldita.` }
          : { tone: 'ok', text: 'Sello retirado sin fuga.' },
      );
      setHint('idle');
      setOpenFlashback(sealId);
    },
    [caseId, peelSeal, settings.sound],
  );

  const handleHover = useCallback((id) => setHovered(id), []);
  const handleHint = useCallback((value) => setHint(value), []);

  const archive = () => {
    if (!caseProgress.archived) archiveCase(caseId);
    router.push(nextCaseId(caseId) === '00' ? '/expediente/00' : '/indice');
  };

  const hoveredSeal = hovered ? sealsById[hovered] : null;
  const fb = openFlashback ? sealsById[openFlashback] : null;

  return (
    <Terminal
      crumbs={
        <>
          <Link href="/indice">Índice · {SETTING.lot}</Link> / <strong>{data.code}</strong> / Control de integridad
          <span className="terminal__crumbs-right">
            FORM. B3-07 · {SETTING.maintenanceOrder} · RESIDUO EN BÓVEDA {progress.leak}
          </span>
        </>
      }
    >
      <div className="case">
        <aside className="case__sheet">
          <div className="case__kicker">EXPEDIENTE · GRADO ESPECIAL</div>
          <span className="stamp stamp--classified">CLASIFICADO</span>
          <h1 className="case__code">{data.code}</h1>
          <p className="case__title">{data.title}</p>
          <p className="case__place">{data.place}</p>
          <div className="barcode" aria-hidden="true" />
          <div className="mono small">{data.barcode}</div>
          <dl className="facts">
            <div><dt>RECUPERADO</dt><dd>{data.recovered}</dd></div>
            <div><dt>EQUIPO</dt><dd>{data.team}</dd></div>
            <div><dt>LONGITUD</dt><dd>{String(data.length).replace('.', ',')} cm</dd></div>
            <div><dt>PESO</dt><dd>{data.weight}</dd></div>
            <div><dt>SELLOS</dt><dd>{data.seals.length} · papel ofuda</dd></div>
            <div><dt>ÚLT. CONTROL</dt><dd>{data.lastControl}</dd></div>
          </dl>
          <h2 className="label">INFORME DE RECUPERACIÓN</h2>
          <p className="case__report">{data.report}</p>
          <h2 className="label">CADENA DE CUSTODIA</h2>
          <table className="custody">
            <tbody>
              {data.custody.map(([date, who, what]) => (
                <tr key={date + who}>
                  <td>{date}</td>
                  <td>{who}</td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>

        <section className="case__stage" aria-label="Mesa de inspección">
          <div className="viewport">
            <Reliquary3D
              caseData={data}
              sealState={sealState}
              leak={progress.leak}
              influence={influence}
              reduceEffects={settings.reduceEffects}
              lamp={lamp}
              apiRef={apiRef}
              onHover={handleHover}
              onPeel={handlePeel}
              onHint={handleHint}
            />
            <div className="viewport__tag viewport__tag--left">
              <span className="rec" aria-hidden="true" /> CAM-B3-02 · MESA DE INSPECCIÓN
            </div>
            <div className="viewport__tag viewport__tag--right">
              {SETTING.date.split(' ')[1]} {SETTING.time}
            </div>
            {hoveredSeal ? (
              <div className="viewport__label" aria-hidden="true">
                <strong>{hoveredSeal.label.toUpperCase()}</strong>
                <span>Inscripción: {hoveredSeal.inscription}</span>
                {lamp ? <span>Tinta: {hoveredSeal.ink}</span> : null}
              </div>
            ) : null}
            <div className="viewport__tools">
              <button type="button" onClick={() => apiRef.current?.zoomIn()} aria-label="Acercar cámara">＋</button>
              <button type="button" onClick={() => apiRef.current?.zoomOut()} aria-label="Alejar cámara">－</button>
              <button type="button" onClick={() => apiRef.current?.reset()} aria-label="Restablecer vista">⟲</button>
              <button
                type="button"
                onClick={() => setLamp((v) => !v)}
                aria-pressed={lamp}
                aria-label="Luz rasante de inspección"
                className={lamp ? 'is-on' : ''}
              >
                ☀
              </button>
            </div>
            <p className="viewport__hint" aria-live="polite">
              {HINTS[hint]}
            </p>
            {fb ? (
              <div className="viewport__overlay">
                <MangaFlashback
                  seal={fb}
                  found={progress.memory.includes(fb.flashback.hidden.id)}
                  onFind={() => findMemory(fb.flashback.hidden.id)}
                  onClose={() => setOpenFlashback(null)}
                />
              </div>
            ) : null}
          </div>

          <div className="no3d" role="group" aria-label="Controles sin 3D">
            <span className="label">CONTROLES SIN 3D</span>
            <div className="no3d__buttons">
              {data.seals.map((seal) =>
                sealState[seal.id].peeled ? (
                  <button key={seal.id} type="button" className="btn btn--ghost" onClick={() => setOpenFlashback(seal.id)}>
                    {seal.label} · releer residuo
                  </button>
                ) : (
                  <button key={seal.id} type="button" className="btn" onClick={() => handlePeel(seal.id, true)}>
                    Retirar {seal.label.toLowerCase()}
                  </button>
                ),
              )}
              <button type="button" className="btn btn--ghost" aria-pressed={lamp} onClick={() => setLamp((v) => !v)}>
                {lamp ? 'Apagar luz rasante' : 'Inspeccionar tinta'}
              </button>
            </div>
            {lamp ? (
              <ul className="no3d__ink">
                {data.seals
                  .filter((s) => !sealState[s.id].peeled)
                  .map((s) => (
                    <li key={s.id}>
                      {s.label}: tinta {s.ink}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
          {feedback ? (
            <p className={`feedback feedback--${feedback.tone}`} role="status">
              {feedback.text}
            </p>
          ) : null}
        </section>

        <aside className="case__form">
          {peeled.length ? (
            <div className="notes">
              {peeled.map((seal) => (
                <MangaFlashback
                  key={seal.id}
                  inline
                  seal={seal}
                  found={progress.memory.includes(seal.flashback.hidden.id)}
                  onFind={() => findMemory(seal.flashback.hidden.id)}
                />
              ))}
            </div>
          ) : (
            <div className="field-note">
              <div className="label label--red">NOTA DE CAMPO · SIN LEER</div>
              <p>Retirá el primer sello para leer el residuo. Los sellos se retiran en orden inverso al de colocación.</p>
            </div>
          )}

          {activeSeal ? (
            <fieldset className="seal-state">
              <legend className="label">ESTADO DEL {activeSeal.label.toUpperCase()}</legend>
              <div className="segmented">
                {SEAL_STATES.map((state) => (
                  <button key={state} type="button" onClick={() => markSeal(caseId, activeSeal.id, state)}>
                    {state}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label className="label observations">
            OBSERVACIONES
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Opcional" />
          </label>

          <div className="signature">
            <div>
              <div className="label">FIRMA DEL OPERADOR</div>
              <div className="signature__line">{operator}</div>
            </div>
            <span className="stamp stamp--round" aria-hidden="true">確認</span>
          </div>

          <div className="archive">
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${(marked.length / data.seals.length) * 100}%` }} />
            </div>
            <div className="mono small">
              {marked.length} DE {data.seals.length} SELLOS VERIFICADOS
            </div>
            <button type="button" className="btn btn--primary" disabled={!allDone} onClick={archive}>
              {caseProgress.archived ? 'Archivado · volver al índice' : 'Archivar expediente'}
            </button>
          </div>
        </aside>
      </div>
    </Terminal>
  );
}
