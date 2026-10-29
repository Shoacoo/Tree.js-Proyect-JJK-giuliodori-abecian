'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import MangaFlashback from '@/components/MangaFlashback';
import SealStatePicker from '@/components/SealStatePicker';
import Shell, { Cells, Key, ScreenHead, Tag, handle, useHotkeys } from '@/components/Shell';
import { MEMORY_TOTAL, SETTING, getCase, nextCaseId } from '@/data/cases';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { useQuality } from '@/hooks/useQuality';
import { useTour } from '@/hooks/useTour';
import { LEAK_LIMIT, shortPlace } from '@/lib/readings';
import { downgradeAutoQuality } from '@/three/quality';
import { playPeel } from '@/lib/sound';

// La escena solo existe en el navegador: se carga sin SSR y con su propio estado de carga.
const Reliquary3D = dynamic(() => import('@/components/Reliquary3D'), {
  ssr: false,
  loading: () => <div className="reliquary-loading">Encendiendo cámara CAM-B3-02…</div>,
});

const HINTS = {
  idle: 'mantené presionado un sello para retirarlo · arrastrá para girar · rueda para acercar',
  hold: 'despegando… no sueltes hasta que se suelte solo',
  tap: 'mantené presionado para despegarlo con cuidado: si soltás antes, se arranca',
};

function SealTag({ state }) {
  if (!state.peeled) return <Tag tone="muted">colocado</Tag>;
  if (!state.state) return <Tag tone="active">en curso</Tag>;
  return (
    <Tag tone={state.ripped ? 'alert' : 'normal'}>
      {state.ripped ? 'arrancado' : 'retirado'} · {state.state.toLowerCase()}
    </Tag>
  );
}

export default function CaseFile({ caseId }) {
  const data = getCase(caseId);
  const router = useRouter();
  const { progress, hydrated, settings, influence, operator, peelSeal, markSeal, findMemory, archiveCase } = useProgress();
  const { pref: qualityPref, quality } = useQuality();
  const apiRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [hint, setHint] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [openFlashback, setOpenFlashback] = useState(null);
  const [lamp, setLamp] = useState(false);

  const caseProgress = progress.cases[caseId];
  const sealState = caseProgress.seals;
  const unlocked = isCaseUnlocked(progress, caseId);
  const peeled = data.seals.filter((s) => sealState[s.id].peeled);
  const marked = data.seals.filter((s) => sealState[s.id].state);
  const activeSeal = peeled.find((s) => !sealState[s.id].state) ?? null;
  const allDone = marked.length === data.seals.length;
  const sealsById = Object.fromEntries(data.seals.map((s) => [s.id, s]));
  const tour = useTour({ where: 'case', caseId, peeled: peeled.length, marked: marked.length });
  // En el recorrido, los sellos se retiran recién cuando el cartel lo pide.
  const canPeel = tour.reached('retirar');

  useEffect(() => {
    if (hydrated && !unlocked) router.replace('/indice');
  }, [hydrated, unlocked, router]);

  // Reliquary3D lee los callbacks desde una ref: no hace falta memorizarlos.
  const handlePeel = (sealId, careful) => {
    if (!canPeel) return;
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
  };

  const handleMark = (seal, state) => {
    const result = markSeal(caseId, seal.id, state);
    if (!result) return;
    setFeedback(
      result.mismatch
        ? {
            tone: 'bad',
            text: `El residuo no coincide: el ${seal.label.toLowerCase()} estaba ${result.actual.toLowerCase()}. Quedó mal resellado y se filtró energía.`,
          }
        : { tone: 'ok', text: `${seal.label} registrado como ${state.toLowerCase()}.` },
    );
  };

  const handleHover = useCallback((id) => setHovered(id), []);
  const handleHint = useCallback((value) => setHint(value), []);

  const archive = () => {
    if (!allDone) return;
    if (!caseProgress.archived) archiveCase(caseId);
    router.push(nextCaseId(caseId) === '00' ? '/expediente/00' : '/indice#lote');
  };

  const hoveredSeal = hovered ? sealsById[hovered] : null;
  const fb = openFlashback ? sealsById[openFlashback] : null;
  const [residue, code] = activeSeal ? activeSeal.flashback.title.split(' ') : [];

  useHotkeys(
    {
      '+': () => apiRef.current?.zoomIn(),
      '=': () => apiRef.current?.zoomIn(),
      '-': () => apiRef.current?.zoomOut(),
      0: () => apiRef.current?.reset(),
      l: () => setLamp((v) => !v),
      a: archive,
      Escape: () => router.push('/indice#lote'),
    },
    !fb,
  );

  return (
    <Shell
      active="lote"
      hints="[+/−] Zoom  [L] Luz  [1/2/3] Estado del papel  [A] Archivar  [ESC] Volver al lote"
      tour={tour}
      tourPaused={Boolean(fb)}
    >
      <ScreenHead eyebrow={`Expediente · ${SETTING.lot}`} title={`${data.code} · ${shortPlace(data.place)}`} />
      <div className="case">
        <div className="case__main">
          <section className="viewport" aria-label="Mesa de inspección" data-tour="viewport">
            {quality ? (
              <Reliquary3D
                key={quality}
                quality={quality}
                onSlow={qualityPref === 'auto' ? downgradeAutoQuality : undefined}
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
            ) : null}
            <div className="viewport__rec">
              <span className="rec" aria-hidden="true" /> REC&nbsp; CAM-B3-02&nbsp; MESA DE INSPECCIÓN
            </div>
            {hoveredSeal ? (
              <div className="viewport__label" aria-hidden="true">
                <strong>{hoveredSeal.label}</strong>
                {lamp ? <span>Tinta: {hoveredSeal.ink}</span> : <span>[L] luz rasante para ver la tinta</span>}
              </div>
            ) : null}
            <div className="viewport__tools" role="group" aria-label="Cámara y luz">
              <Key k="+" onClick={() => apiRef.current?.zoomIn()} aria-label="Acercar cámara" />
              <Key k="−" onClick={() => apiRef.current?.zoomOut()} aria-label="Alejar cámara" />
              <Key k="↺" onClick={() => apiRef.current?.reset()} aria-label="Restablecer vista" title="Restablecer vista (0)" />
              <Key
                k="L"
                variant={lamp ? 'fill' : 'outline'}
                aria-pressed={lamp}
                onClick={() => setLamp((v) => !v)}
                aria-label="Luz rasante de inspección"
              >
                Luz
              </Key>
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
          </section>

          <div className="seal-rows" role="group" aria-label="Sellos (controles sin 3D)" data-tour="seals">
            {data.seals.map((seal) => {
              const state = sealState[seal.id];
              return (
                <div key={seal.id} className={`seal-row${state.peeled && !state.state ? ' is-current' : ''}`}>
                  <span>
                    {seal.label}
                    {state.peeled ? ` · ${seal.flashback.title.toLowerCase()}` : ''}
                  </span>
                  <span className="seal-row__side">
                    {state.peeled ? (
                      <Key className="key--sm" onClick={() => setOpenFlashback(seal.id)}>
                        Releer residuo
                      </Key>
                    ) : (
                      <Key className="key--sm" onClick={() => handlePeel(seal.id, true)} disabled={!canPeel}>
                        Retirar
                      </Key>
                    )}
                    <SealTag state={state} />
                  </span>
                </div>
              );
            })}
          </div>
          {lamp ? (
            <ul className="ink-list" aria-label="Tinta de los sellos colocados">
              {data.seals
                .filter((s) => !sealState[s.id].peeled)
                .map((s) => (
                  <li key={s.id}>
                    {s.label}: tinta {s.ink}
                  </li>
                ))}
            </ul>
          ) : null}
          {feedback ? (
            <p className={`feedback feedback--${feedback.tone}`} role="status">
              {feedback.text}
            </p>
          ) : null}
        </div>

        <aside className="case__side">
          <section className="panel seal-panel" aria-live="polite" aria-label="Sello activo" data-tour="seal-state">
            {activeSeal ? (
              <>
                <span className="seal-panel__kicker">{activeSeal.label}</span>
                <h2 className="seal-panel__title">
                  {residue}
                  <br />
                  {code}
                </h2>
                <SealStatePicker
                  seal={activeSeal}
                  legend="Estado del papel:"
                  hotkeys={!fb}
                  onMark={(state) => handleMark(activeSeal, state)}
                />
              </>
            ) : (
              <>
                <span className="seal-panel__kicker">Sello activo</span>
                <p className="seal-panel__empty">
                  {allDone
                    ? 'Todos los sellos verificados. Ya podés archivar el expediente.'
                    : 'Retirá un sello para registrar en qué estado estaba el papel.'}
                </p>
              </>
            )}
          </section>

          <section className="panel readout" aria-label="Lecturas" data-tour="readings">
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
            <div className="readout__row">
              <span>sellos</span>
              <Cells value={marked.length} max={data.seals.length} />
              <span>
                {marked.length}/{data.seals.length}
              </span>
            </div>
            <span>firma: {handle(operator)}</span>
          </section>

          <section className="field-note" aria-label="Nota de campo">
            <span className="label">
              Nota de campo · {peeled.length ? `${peeled.length} de ${data.seals.length} residuos leídos` : 'sin leer'}
            </span>
            <p>Retirá los sellos en orden inverso al de colocación.</p>
            <p>{data.report}</p>
          </section>

          <details className="panel ficha">
            <summary className="eyebrow">Ficha del objeto</summary>
            <dl className="facts">
              <div>
                <dt>Objeto</dt>
                <dd>{data.title}</dd>
              </div>
              <div>
                <dt>Caja</dt>
                <dd>{data.box}</dd>
              </div>
              <div>
                <dt>Recuperado</dt>
                <dd>{data.recovered}</dd>
              </div>
              <div>
                <dt>Equipo</dt>
                <dd>{data.team}</dd>
              </div>
              <div>
                <dt>Longitud</dt>
                <dd>{String(data.length).replace('.', ',')} cm</dd>
              </div>
              <div>
                <dt>Peso</dt>
                <dd>{data.weight}</dd>
              </div>
              <div>
                <dt>Sellos</dt>
                <dd>{data.seals.length} · papel ofuda</dd>
              </div>
              <div>
                <dt>Últ. control</dt>
                <dd>{data.lastControl}</dd>
              </div>
            </dl>
            <span className="eyebrow eyebrow--plain">Cadena de custodia</span>
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
          </details>

          <Key k="A" variant="fill" className="archive-key" disabled={!allDone} onClick={archive} data-tour="archive">
            {caseProgress.archived ? 'Archivado · volver al lote' : 'Archivar expediente'}
          </Key>
        </aside>
      </div>
    </Shell>
  );
}
