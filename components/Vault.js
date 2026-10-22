'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PersistenceBadge } from '@/components/Terminal';
import { CASES, HIDDEN_BOX, VAULT_BOXES, getCaseByBox } from '@/data/cases';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { startHum, stopHum } from '@/lib/sound';

const VaultRoom3D = dynamic(() => import('@/components/VaultRoom3D'), {
  ssr: false,
  loading: () => <div className="vault-loading">Encendiendo el fluorescente…</div>,
});

const VIEW_LABEL = {
  overview: 'Sala de Catalogación',
  left: 'Estantería izquierda · B3-07 a B3-15',
  right: 'Estantería derecha · B3-01 a B3-06',
  table: 'Mesa de inspección',
  terminal: 'Terminal B3-T02',
};

const TABLE_KEY = 'contencion:table';

function describeBox(code, status) {
  const data = getCaseByBox(code);
  if (code === HIDDEN_BOX) {
    return status === 'revealed'
      ? { title: 'B3-11 · Sin registro', body: 'La caja que el sistema da por vacía. Adentro hay un dedo sin sellos.', canCarry: true, caseId: '00' }
      : { title: 'B3-11 · Vacía', body: 'Según el sistema, este lugar nunca se usó. Hay polvo alrededor, pero no adentro.', canCarry: false };
  }
  if (!data) return { title: `${code} · Objeto sellado`, body: 'Un objeto envuelto en tela, ajeno al lote 2018-B3. No te toca inspeccionarlo.', canCarry: false };
  const base = `${data.code} · ${data.title} · ${data.place}`;
  if (status === 'locked') return { title: code, body: `${base}. Bloqueado: primero hay que archivar el expediente anterior.`, canCarry: false };
  if (status === 'archived') return { title: code, body: `${base}. Archivado. Podés volver a revisarlo.`, canCarry: true, caseId: data.id };
  return { title: code, body: `${base}. Pendiente de control de integridad.`, canCarry: true, caseId: data.id };
}

/**
 * Bóveda B3: la sala donde empieza todo. El usuario busca los dedos en las estanterías,
 * los lleva a la mesa y entra al sistema desde la terminal.
 */
export default function Vault({ intro }) {
  const router = useRouter();
  const { progress, hydrated, signedIn, operator, influence, settings, setSettings } = useProgress();
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState('overview');
  const [openBox, setOpenBox] = useState(null);
  const [tableCaseId, setTableCaseId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [message, setMessage] = useState(null);

  // Recordar qué dedo quedó sobre la mesa y si ya se pasó la intro.
  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTableCaseId(window.sessionStorage.getItem(TABLE_KEY));
      if (window.sessionStorage.getItem('contencion:entered')) setEntered(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Sin almacenamiento: se empieza desde la intro.
    }
  }, []);

  useEffect(() => {
    try {
      if (tableCaseId) window.sessionStorage.setItem(TABLE_KEY, tableCaseId);
      else window.sessionStorage.removeItem(TABLE_KEY);
    } catch {
      // Ignorado.
    }
  }, [tableCaseId]);

  useEffect(() => {
    if (settings.sound && entered) startHum();
    return () => stopHum();
  }, [settings.sound, entered]);

  const allArchived = isCaseUnlocked(progress, '00');
  const boxStatus = {};
  CASES.forEach((c) => {
    boxStatus[c.box] = progress.cases[c.id]?.archived ? 'archived' : isCaseUnlocked(progress, c.id) ? 'pending' : 'locked';
  });
  if (allArchived) boxStatus[HIDDEN_BOX] = 'revealed';

  const navigate = useCallback((next) => {
    setView(next);
    setMessage(null);
    if (next !== 'left' && next !== 'right') setOpenBox(null);
  }, []);

  const clickBox = useCallback((code) => {
    setOpenBox((current) => (current === code ? null : code));
    setMessage(null);
  }, []);

  const activate = useCallback(
    (what) => {
      if (what === 'terminal') {
        router.push(signedIn ? '/indice' : '/acceso');
        return;
      }
      if (!tableCaseId) {
        setMessage({ text: 'La mesa está vacía. Buscá un dedo en las estanterías y traelo.' });
        return;
      }
      if (!signedIn) {
        setMessage({ text: 'Toda inspección queda registrada a tu nombre. Identificate primero en la terminal.', action: 'terminal' });
        return;
      }
      router.push(`/expediente/${tableCaseId}`);
    },
    [router, signedIn, tableCaseId],
  );

  const carry = (caseId) => {
    setTableCaseId(caseId);
    setOpenBox(null);
    setView('table');
    setMessage(null);
  };

  const enter = () => {
    setEntered(true);
    try {
      window.sessionStorage.setItem('contencion:entered', '1');
    } catch {
      // Ignorado.
    }
  };

  const openInfo = openBox ? describeBox(openBox, boxStatus[openBox]) : null;
  const tableCase = CASES.find((c) => c.id === tableCaseId);
  const hoverText = hovered
    ? hovered.type === 'box'
      ? hovered.code
      : hovered.type === 'shelf'
        ? 'Estantería'
        : hovered.type === 'table'
          ? 'Mesa de inspección'
          : 'Terminal B3-T02'
    : null;
  const shelfCodes = view === 'left' ? VAULT_BOXES.left : view === 'right' ? VAULT_BOXES.right : [];

  return (
    <main className="vault" data-influence={hydrated ? influence : 0} data-reduce={settings.reduceEffects ? 'true' : 'false'}>
      <h1 className="sr-only">Depósito B3, Sala de Catalogación</h1>
      <VaultRoom3D
        view={view}
        boxStatus={boxStatus}
        openBox={openBox}
        tableCaseId={tableCaseId}
        sealStates={progress.cases}
        influence={hydrated ? influence : 0}
        signedIn={signedIn}
        operator={operator}
        reduceEffects={settings.reduceEffects}
        onNavigate={navigate}
        onBoxClick={clickBox}
        onActivate={activate}
        onHover={setHovered}
      />

      <header className="vault__hud">
        <div>
          <div className="label">DEPÓSITO B3 · SUBSUELO · COLEGIO JUJUTSU DE TOKIO</div>
          <div className="vault__place">{VIEW_LABEL[view]}</div>
        </div>
        <div className="vault__hud-right">
          <PersistenceBadge />
          <button
            type="button"
            className="vault__chip"
            aria-pressed={settings.sound}
            onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
          >
            Sonido {settings.sound ? 'sí' : 'no'}
          </button>
          <button
            type="button"
            className="vault__chip"
            aria-pressed={settings.reduceEffects}
            onClick={() => setSettings((s) => ({ ...s, reduceEffects: !s.reduceEffects }))}
          >
            Reducir efectos {settings.reduceEffects ? 'sí' : 'no'}
          </button>
        </div>
      </header>

      {hoverText && !openInfo ? (
        <div className="vault__tooltip" aria-hidden="true">
          {hoverText}
        </div>
      ) : null}

      <section className="vault__panel" aria-live="polite">
        {openInfo ? (
          <div className="vault__card">
            <div className="label">CAJA {openInfo.title}</div>
            <p>{openInfo.body}</p>
            <div className="row">
              {openInfo.canCarry ? (
                <button type="button" className="btn btn--primary" onClick={() => carry(openInfo.caseId)}>
                  Llevar a la mesa
                </button>
              ) : null}
              <button type="button" className="btn btn--ghost" onClick={() => setOpenBox(null)}>
                Cerrar la caja
              </button>
            </div>
          </div>
        ) : view === 'table' ? (
          <div className="vault__card">
            <div className="label">MESA DE INSPECCIÓN</div>
            <p>
              {tableCase
                ? `${tableCase.code} sobre la bandeja. ${tableCase.seals.length} sellos ofuda.`
                : tableCaseId === '00'
                  ? 'El dedo de la caja B3-11, sin sellos.'
                  : 'La mesa está vacía.'}
            </p>
            <div className="row">
              <button type="button" className="btn btn--primary" onClick={() => activate('table')}>
                {tableCaseId ? 'Inspeccionar' : 'Buscar en las estanterías'}
              </button>
            </div>
          </div>
        ) : view === 'terminal' ? (
          <div className="vault__card">
            <div className="label">TERMINAL B3-T02</div>
            <p>{signedIn ? `Sesión abierta: ${operator}.` : 'Sin sesión. El sistema registra cada inspección.'}</p>
            <button type="button" className="btn btn--primary" onClick={() => activate('terminal')}>
              {signedIn ? 'Abrir índice de expedientes' : 'Identificarse'}
            </button>
          </div>
        ) : null}
        {message ? (
          <div className="vault__card vault__card--warn" role="status">
            <p>{message.text}</p>
            {message.action === 'terminal' ? (
              <button type="button" className="btn" onClick={() => navigate('terminal')}>
                Ir a la terminal
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <nav className="vault__nav" aria-label="Moverse por la sala sin 3D">
        <span className="label">MOVERSE SIN 3D</span>
        {[
          ['overview', 'Centro'],
          ['left', 'Estantería izq.'],
          ['right', 'Estantería der.'],
          ['table', 'Mesa'],
          ['terminal', 'Terminal'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`vault__chip ${view === id ? 'is-active' : ''}`} aria-current={view === id} onClick={() => navigate(id)}>
            {label}
          </button>
        ))}
        {shelfCodes.length ? (
          <div className="vault__boxes" role="group" aria-label="Cajas de esta estantería">
            {shelfCodes
              .filter((code) => code !== HIDDEN_BOX || boxStatus[HIDDEN_BOX] === 'revealed')
              .map((code) => (
                <button key={code} type="button" className={`vault__chip ${openBox === code ? 'is-active' : ''}`} onClick={() => clickBox(code)}>
                  {code}
                  {getCaseByBox(code) || (code === HIDDEN_BOX && boxStatus[HIDDEN_BOX]) ? ' ·' : ''}
                </button>
              ))}
          </div>
        ) : null}
        <p className="vault__help">Arrastrá para mirar · Click para acercarte o abrir una caja</p>
      </nav>

      {!entered ? (
        <div className="vault__intro">
          <div className="vault__intro-card">
            {intro}
            <button type="button" className="btn btn--primary" onClick={enter} autoFocus>
              Entrar a la bóveda
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
