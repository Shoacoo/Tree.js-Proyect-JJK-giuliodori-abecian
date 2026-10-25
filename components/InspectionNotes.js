'use client';

import { useEffect, useRef } from 'react';
import MangaFlashback from '@/components/MangaFlashback';
import { CASES, SEAL_STATES, SEAL_STATE_GUIDE } from '@/data/cases';

export const NOTE_TABS = [
  ['case', 'Expediente'],
  ['residue', 'Residuos'],
  ['control', 'Planilla'],
  ['archive', 'Archivados'],
];

function CaseSheet({ data }) {
  return (
    <>
      <div className="label">EXPEDIENTE · GRADO ESPECIAL</div>
      <h2 className="notes-drawer__code">{data.code}</h2>
      <p>
        {data.title} · {data.place}
      </p>
      <dl className="facts">
        <div><dt>RECUPERADO</dt><dd>{data.recovered}</dd></div>
        <div><dt>EQUIPO</dt><dd>{data.team}</dd></div>
        <div><dt>LONGITUD</dt><dd>{String(data.length).replace('.', ',')} cm</dd></div>
        <div><dt>PESO</dt><dd>{data.weight}</dd></div>
        <div><dt>SELLOS</dt><dd>{data.seals.length} · papel ofuda</dd></div>
        <div><dt>ÚLT. CONTROL</dt><dd>{data.lastControl}</dd></div>
      </dl>
      <h3 className="label">INFORME DE RECUPERACIÓN</h3>
      <p className="case__report">{data.report}</p>
      <h3 className="label">CADENA DE CUSTODIA</h3>
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
    </>
  );
}

function Residues({ data, seals, memory, onFind }) {
  const peeled = data.seals.filter((s) => seals[s.id]?.peeled);
  if (!peeled.length) {
    return (
      <div className="field-note">
        <div className="label label--red">NOTA DE CAMPO · SIN LEER</div>
        <p>Retirá el primer sello para leer el residuo. Los sellos se retiran en orden inverso al de colocación.</p>
      </div>
    );
  }
  return peeled.map((seal) => (
    <MangaFlashback key={seal.id} inline seal={seal} found={memory.includes(seal.flashback.hidden.id)} onFind={() => onFind(seal.flashback.hidden.id)} />
  ));
}

/**
 * Libretas de la mesa de inspección: lo que el operador lee sin salir de la bóveda.
 * El expediente del dedo, los residuos ya leídos, la planilla de control y las carpetas archivadas.
 */
export default function InspectionNotes({ tab, onTab, onClose, caseData, progress, onFind }) {
  const closeRef = useRef(null);
  const seals = caseData ? progress.cases[caseData.id]?.seals ?? {} : {};
  const archived = CASES.filter((c) => progress.cases[c.id]?.archived);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section className="notes-drawer" role="dialog" aria-modal="false" aria-label="Libretas de la mesa de inspección">
      <header className="notes-drawer__head">
        <div className="notes-drawer__tabs" role="tablist">
          {NOTE_TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => onTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" className="notes-drawer__close" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="notes-drawer__body" role="tabpanel">
        {tab === 'case' ? (
          caseData ? (
            <CaseSheet data={caseData} />
          ) : (
            <div className="field-note">
              <div className="label">LIBRETA DE LA VENTANA N.º 0417</div>
              <p>15/03 23:31 · ingreso B3. OM-2018-0311 (verbal). Lote: 3 objetos. Sellos: orden inverso. B3-11 figura vacía: ¿por qué hay marca en el polvo?</p>
              <p>La mesa está vacía. Traé un dedo de las estanterías para abrir su expediente.</p>
            </div>
          )
        ) : null}

        {tab === 'residue' ? (
          caseData ? (
            <Residues data={caseData} seals={seals} memory={progress.memory} onFind={onFind} />
          ) : (
            <p className="field-note">No hay ningún dedo sobre la mesa.</p>
          )
        ) : null}

        {tab === 'control' ? (
          <>
            <div className="label">FORM. B3-07 · CONTROL DE INTEGRIDAD{caseData ? ` · ${caseData.code}` : ''}</div>
            {caseData ? (
              <table className="custody">
                <tbody>
                  {caseData.seals.map((seal) => {
                    const s = seals[seal.id] ?? {};
                    return (
                      <tr key={seal.id}>
                        <td>{seal.label}</td>
                        <td>{s.peeled ? (s.ripped ? 'Arrancado' : 'Retirado') : 'En el dedo'}</td>
                        <td>
                          {s.state ?? '—'}
                          {s.state && seal.condition && s.state !== seal.condition ? <span className="red"> · no coincide</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
            <h3 className="label">CÓMO RECONOCER EL ESTADO DE UN SELLO</h3>
            <ul className="notes-drawer__guide">
              {SEAL_STATES.map((state) => (
                <li key={state}>
                  <strong>{state}.</strong> {SEAL_STATE_GUIDE[state]}
                </li>
              ))}
            </ul>
            <p className="mono small">
              Registrar mal un estado deja el objeto mal resellado. Residuo en bóveda: {progress.leak}
            </p>
          </>
        ) : null}

        {tab === 'archive' ? (
          archived.length ? (
            archived.map((c) => (
              <details key={c.id} className="notes-drawer__folder">
                <summary>
                  {c.code} · {c.place}
                </summary>
                <p className="case__report">{c.report}</p>
                <Residues data={c} seals={progress.cases[c.id].seals} memory={progress.memory} onFind={onFind} />
              </details>
            ))
          ) : (
            <p className="field-note">Todavía no archivaste ningún expediente.</p>
          )
        ) : null}
      </div>
    </section>
  );
}
