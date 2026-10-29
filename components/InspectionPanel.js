'use client';

import SealStatePicker from '@/components/SealStatePicker';
import { Key } from '@/components/Shell';

const HINTS = {
  idle: 'Mantené presionado un sello para despegarlo · Arrastrá para girar el dedo · Rueda para acercar',
  hold: 'Despegando… no sueltes hasta que se suelte solo',
  tap: 'Mantené presionado para despegarlo con cuidado. Si soltás antes, se arranca.',
};

/**
 * Panel de la mesa de inspección: herramientas, sellos (también sin 3D), planilla del sello
 * recién retirado y archivo del expediente. Lo que significa cada acción lo decide Vault.
 */
export default function InspectionPanel({
  caseData,
  caseProgress,
  hint,
  hoveredSeal,
  lamp,
  feedback,
  onLamp,
  onZoom,
  onFocus,
  onPeel,
  onReread,
  onMark,
  onArchive,
  onNotes,
  onBack,
}) {
  const seals = caseProgress.seals;
  const marked = caseData.seals.filter((s) => seals[s.id]?.state);
  const activeSeal = caseData.seals.find((s) => seals[s.id]?.peeled && !seals[s.id]?.state) ?? null;
  const allDone = marked.length === caseData.seals.length;

  return (
    <div className="vault__card inspect">
      <div className="label">MESA DE INSPECCIÓN · {caseData.code}{caseProgress.archived ? ' · ARCHIVADO' : ''}</div>
      <p className="inspect__hint" aria-live="polite">{HINTS[hint] ?? HINTS.idle}</p>

      {hoveredSeal ? (
        <div className="inspect__seal" aria-hidden="true">
          <strong>{hoveredSeal.label}</strong>
          <span>Inscripción: {hoveredSeal.inscription}</span>
          {lamp ? <span>Tinta: {hoveredSeal.ink}</span> : null}
        </div>
      ) : null}

      <div className="inspect__tools" role="group" aria-label="Cámara y luz">
        <Key k="+" onClick={() => onZoom('in')} aria-label="Acercar" />
        <Key k="−" onClick={() => onZoom('out')} aria-label="Alejar" />
        <Key k="↺" onClick={() => onZoom('reset')} aria-label="Restablecer vista" />
        <Key k="L" variant={lamp ? 'fill' : 'outline'} onClick={onLamp} aria-pressed={lamp}>
          Luz rasante
        </Key>
      </div>

      {feedback ? (
        <p className={`feedback feedback--${feedback.tone}`} role="status">
          {feedback.text}
        </p>
      ) : null}

      {activeSeal ? <SealStatePicker seal={activeSeal} onMark={(state) => onMark(activeSeal, state)} /> : null}

      <div className="inspect__seals" role="group" aria-label="Sellos (controles sin 3D)">
        <span className="label">SELLOS</span>
        {caseData.seals.map((seal) =>
          seals[seal.id]?.peeled ? (
            <button key={seal.id} type="button" className="btn btn--ghost" onClick={() => onReread(seal.id)}>
              {seal.label} · releer residuo{seals[seal.id].state ? ` · ${seals[seal.id].state.toLowerCase()}` : ''}
            </button>
          ) : (
            <span key={seal.id} className="inspect__seal-row">
              <button type="button" className="btn" onClick={() => onPeel(seal.id, true)}>
                Retirar {seal.label.toLowerCase()}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => onFocus(seal.id)} aria-label={`Mirar de cerca el ${seal.label.toLowerCase()}`}>
                Lupa
              </button>
            </span>
          ),
        )}
        {lamp ? (
          <ul className="no3d__ink">
            {caseData.seals
              .filter((s) => !seals[s.id]?.peeled)
              .map((s) => (
                <li key={s.id}>
                  {s.label}: tinta {s.ink}
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={() => onNotes('case')}>Leer expediente</button>
        <button type="button" className="btn btn--ghost" onClick={() => onNotes('control')}>Planilla</button>
      </div>

      <div className="archive">
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${(marked.length / caseData.seals.length) * 100}%` }} />
        </div>
        <div className="mono small">
          {marked.length} DE {caseData.seals.length} SELLOS VERIFICADOS
        </div>
        {caseProgress.archived ? null : (
          <button type="button" className="btn btn--primary" disabled={!allDone} onClick={onArchive}>
            Archivar expediente
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Alejarse de la mesa
        </button>
      </div>
    </div>
  );
}
