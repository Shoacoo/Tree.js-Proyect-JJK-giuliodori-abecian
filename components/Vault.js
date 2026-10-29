'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import InspectionNotes from '@/components/InspectionNotes';
import InspectionPanel from '@/components/InspectionPanel';
import MangaFlashback from '@/components/MangaFlashback';
import Shell, { Key, PersistenceBadge, ScreenHead, useHotkeys } from '@/components/Shell';
import { CASES, HIDDEN_BOX, MEMORY_TOTAL, VAULT_BOXES, getCase, getCaseByBox, nextCaseId } from '@/data/cases';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { qualityLabel, useQuality } from '@/hooks/useQuality';
import { playPeel, setHumDread, startHum, stopHum } from '@/lib/sound';
import { downgradeAutoQuality } from '@/three/quality';

const VaultRoom3D = dynamic(() => import('@/components/VaultRoom3D'), {
  ssr: false,
  loading: () => <div className="vault-loading">Encendiendo el fluorescente…</div>,
});

const VIEW_LABEL = {
  overview: 'Sala de Catalogación',
  left: 'Estantería izquierda · B3-07 a B3-15',
  right: 'Estantería derecha · B3-01 a B3-06',
  table: 'Mesa de inspección',
  inspect: 'Mesa de inspección · de cerca',
  terminal: 'Terminal B3-T02',
};

const NOTEBOOK_TAB = { case: 'case', control: 'control', archive: 'archive' };
const NOTEBOOK_LABEL = { case: 'Libreta del expediente', control: 'Planilla de control', archive: 'Expedientes archivados' };

const TABLE_KEY = 'contencion:table';
const SEEN_CORRUPTION_KEY = 'contencion:corruption-seen';

// Lo que nota el usuario al volver a la bóveda después de avanzar con un dedo.
function dreadMessage(level) {
  if (level >= 0.75) return 'La niebla roja ya sube del piso y la puerta sellada late. Los sellos de la pared apenas contienen lo que despertaste.';
  if (level >= 0.5) return 'El aire de la bóveda se volvió espeso. La energía de los dedos ya no se queda adentro de las cajas.';
  if (level >= 0.25) return 'Algo cambió mientras no estabas: el fluorescente alumbra menos y las cajas laten.';
  return 'El aire de la bóveda está un poco más pesado que cuando te fuiste.';
}

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
export default function Vault({ intro, legal }) {
  const router = useRouter();
  const { progress, hydrated, user, signedIn, operator, influence, corruption, settings, setSettings, persistence, auth, peelSeal, markSeal, findMemory, archiveCase } =
    useProgress();
  const { pref: qualityPref, quality, cycle: cycleQuality } = useQuality();
  const [entered, setEntered] = useState(false);
  const [view, setView] = useState('overview');
  const [openBox, setOpenBox] = useState(null);
  const [tableCaseId, setTableCaseId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [corruptionFrom, setCorruptionFrom] = useState(null);
  const dreadAnnounced = useRef(false);
  // Inspección en la mesa.
  const inspectApi = useRef(null);
  const [lamp, setLamp] = useState(false);
  const [hint, setHint] = useState('idle');
  const [feedback, setFeedback] = useState(null);
  const [flashbackId, setFlashbackId] = useState(null);
  const [notesTab, setNotesTab] = useState(null);

  // Recordar qué dedo quedó sobre la mesa y si ya se pasó la intro.
  useEffect(() => {
    try {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTableCaseId(window.sessionStorage.getItem(TABLE_KEY));
      if (window.sessionStorage.getItem('contencion:entered')) setEntered(true);
      const seen = window.sessionStorage.getItem(SEEN_CORRUPTION_KEY);
      if (seen !== null && Number.isFinite(Number(seen))) setCorruptionFrom(Number(seen));
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

  // La bóveda recuerda cómo estaba la última vez que se la vio: si empeoró, se avisa al volver
  // (la escena 3D hace la transición desde ese valor).
  useEffect(() => {
    if (!hydrated) return;
    setHumDread(corruption);
    if (!dreadAnnounced.current && corruptionFrom !== null && corruption - corruptionFrom > 0.04) {
      dreadAnnounced.current = true;
      setMessage({ text: dreadMessage(corruption) });
    }
    try {
      window.sessionStorage.setItem(SEEN_CORRUPTION_KEY, String(corruption));
    } catch {
      // Ignorado.
    }
  }, [hydrated, corruption, corruptionFrom]);

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
    (action) => {
      // La pantalla de la terminal distingue sus botones con un sufijo ("login#enter").
      const what = action.split('#')[0];
      if (what === 'terminal' || what === 'index') {
        router.push(signedIn ? '/indice' : '/acceso');
        return;
      }
      // "index:registro" abre esa pestaña del sistema de expedientes.
      if (what.startsWith('index:')) {
        router.push(signedIn ? `/indice#${what.slice(6)}` : '/acceso');
        return;
      }
      if (what === 'exit') {
        if (signedIn) setConfirmExit(true);
        else setMessage({ text: 'No hay ninguna sesión abierta. Identificate en la terminal para entrar al sistema.', action: 'terminal' });
        return;
      }
      if (what === 'login') {
        router.push('/acceso');
        return;
      }
      if (what.startsWith('case:')) {
        const id = what.slice(5);
        if (signedIn && isCaseUnlocked(progress, id)) router.push(`/expediente/${id}`);
        return;
      }
      // Libretas a los costados de la mesa: se leen sin salir de la bóveda.
      if (what.startsWith('notebook:')) {
        setNotesTab(NOTEBOOK_TAB[what.slice(9)] ?? 'case');
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
      // El dedo de la B3-11 no tiene sellos: su expediente es el final del recorrido.
      if (tableCaseId === '00') {
        router.push('/expediente/00');
        return;
      }
      setView('inspect');
      setMessage(null);
      setHint('idle');
    },
    [router, signedIn, tableCaseId, progress],
  );

  const carry = (caseId) => {
    setTableCaseId(caseId);
    setOpenBox(null);
    setView('table');
    setMessage(null);
    setFeedback(null);
    setFlashbackId(null);
  };

  // Sellos: se retiran en la mesa, de a uno. Mantener presionado (o el botón sin 3D) los
  // despega con cuidado; soltar antes de tiempo los arranca.
  const handlePeel = useCallback(
    (sealId, careful) => {
      if (!signedIn || !tableCaseId || tableCaseId === '00') return;
      const result = peelSeal(tableCaseId, sealId, careful);
      if (!result) return;
      if (settings.sound) playPeel(result.ripped);
      const parts = [];
      if (result.ripped) parts.push('Arrancaste el sello.');
      if (result.outOfOrder) parts.push('No era el siguiente en el orden de retiro.');
      setFeedback(parts.length ? { tone: 'bad', text: `${parts.join(' ')} Se filtró energía maldita.` } : { tone: 'ok', text: 'Sello retirado sin fuga.' });
      setHint('idle');
      setFlashbackId(sealId);
    },
    [signedIn, tableCaseId, peelSeal, settings.sound],
  );

  const handleMark = (seal, state) => {
    const result = markSeal(tableCaseId, seal.id, state);
    if (!result) return;
    setFeedback(
      result.mismatch
        ? { tone: 'bad', text: `El residuo no coincide: el ${seal.label.toLowerCase()} estaba ${result.actual.toLowerCase()}. Quedó mal resellado y se filtró energía.` }
        : { tone: 'ok', text: `${seal.label} registrado como ${state.toLowerCase()}.` },
    );
  };

  // Archivar devuelve el dedo a su caja y avisa dónde sigue el recorrido.
  const archiveTable = () => {
    const done = getCase(tableCaseId);
    if (!done) return;
    archiveCase(done.id);
    const next = nextCaseId(done.id);
    setTableCaseId(null);
    setFeedback(null);
    setNotesTab(null);
    navigate('table');
    setMessage({
      text:
        next === '00'
          ? `${done.code} archivado. Los tres expedientes del lote están cerrados… pero en la estantería izquierda, la caja B3-11 ya no figura vacía.`
          : `${done.code} archivado y devuelto a su caja. ${getCase(next).code} ya se puede inspeccionar: está en la caja ${getCase(next).box}.`,
    });
  };

  // Salida de emergencia: cierra la sesión de Firebase o la del operador local.
  const signOut = async () => {
    setLeaving(true);
    try {
      if (user) await auth.signOut();
      else auth.enterLocal(null);
      setConfirmExit(false);
      navigate('overview');
      setMessage({ text: 'Sesión cerrada. El registro de la bóveda queda sin operador.' });
    } catch {
      setConfirmExit(false);
      setMessage({ text: 'No se pudo cerrar la sesión. Probá de nuevo.' });
    } finally {
      setLeaving(false);
    }
  };

  useEffect(() => {
    if (!confirmExit) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setConfirmExit(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmExit]);

  const enter = () => {
    setEntered(true);
    try {
      window.sessionStorage.setItem('contencion:entered', '1');
    } catch {
      // Ignorado.
    }
  };
  const toggleSound = () => setSettings((s) => ({ ...s, sound: !s.sound }));
  const toggleReduce = () => setSettings((s) => ({ ...s, reduceEffects: !s.reduceEffects }));

  // Teclas de la pantalla de inicio.
  useHotkeys({ Enter: enter, s: toggleSound, r: toggleReduce, c: () => router.push('/creditos') }, !entered);

  const openInfo = openBox ? describeBox(openBox, boxStatus[openBox]) : null;
  const tableCase = CASES.find((c) => c.id === tableCaseId);
  const hoveredSeal = hovered?.type === 'seal' ? tableCase?.seals.find((s) => s.id === hovered.sealId) : null;
  const flashbackSeal = flashbackId ? tableCase?.seals.find((s) => s.id === flashbackId) : null;
  const hoverText = hovered && !(view === 'terminal' && hovered.type === 'terminal') && hovered.type !== 'seal'
    ? hovered.type === 'box'
      ? hovered.code
      : hovered.type === 'shelf'
        ? 'Estantería'
        : hovered.type === 'table'
          ? view === 'inspect' ? null : 'Mesa de inspección'
          : hovered.type === 'notebook'
            ? NOTEBOOK_LABEL[hovered.side]
            : hovered.type === 'exit'
              ? 'Salida · cerrar sesión'
              : 'Terminal B3-T02'
    : null;
  const zoom = (dir) => {
    if (dir === 'in') inspectApi.current?.zoomIn();
    else if (dir === 'out') inspectApi.current?.zoomOut();
    else inspectApi.current?.reset();
  };
  const closeNotes = useCallback(() => setNotesTab(null), []);
  const closeFlashback = useCallback(() => setFlashbackId(null), []);
  const screenData = {
    cases: CASES.map((c) => ({
      id: c.id,
      code: c.code,
      place: c.place,
      box: c.box,
      seals: c.seals.length,
      // Un punto lleno por sello que sigue puesto.
      dots: c.seals.map((seal) => !progress.cases[c.id]?.seals[seal.id]?.peeled),
      status: boxStatus[c.box],
    })),
    hiddenStatus: boxStatus[HIDDEN_BOX] ?? null,
    log: progress.log ?? [],
    leak: progress.leak ?? 0,
    memory: progress.memory?.length ?? 0,
    memoryTotal: MEMORY_TOTAL,
    persistence,
  };
  const shelfCodes = view === 'left' ? VAULT_BOXES.left : view === 'right' ? VAULT_BOXES.right : [];

  return (
    <main className="vault" data-view={view} data-influence={hydrated ? influence : 0} data-reduce={settings.reduceEffects ? 'true' : 'false'}>
      <h1 className="sr-only">Depósito B3, Sala de Catalogación</h1>
      {quality ? (
      <VaultRoom3D
        key={quality}
        quality={quality}
        onSlow={qualityPref === 'auto' ? downgradeAutoQuality : undefined}
        view={view}
        boxStatus={boxStatus}
        openBox={openBox}
        tableCaseId={tableCaseId}
        sealStates={progress.cases}
        lamp={lamp}
        apiRef={inspectApi}
        onPeel={handlePeel}
        onHint={setHint}
        influence={hydrated ? influence : 0}
        corruption={hydrated ? corruption : null}
        corruptionFrom={corruptionFrom}
        signedIn={signedIn}
        operator={operator}
        reduceEffects={settings.reduceEffects}
        screenData={screenData}
        onNavigate={navigate}
        onBoxClick={clickBox}
        onActivate={activate}
        onHover={setHovered}
      />
      ) : null}

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
            onClick={toggleSound}
          >
            Sonido {settings.sound ? 'sí' : 'no'}
          </button>
          <button
            type="button"
            className="vault__chip"
            aria-pressed={settings.reduceEffects}
            onClick={toggleReduce}
          >
            Reducir efectos {settings.reduceEffects ? 'sí' : 'no'}
          </button>
          <button
            type="button"
            className="vault__chip"
            onClick={cycleQuality}
            title="Calidad gráfica: auto se ajusta según el rendimiento de la PC"
          >
            Calidad {qualityLabel(qualityPref, quality)}
          </button>
        </div>
      </header>

      {hoverText && !openInfo ? (
        <div className="vault__tooltip" aria-hidden="true">
          {hoverText}
        </div>
      ) : null}

      {view === 'inspect' && tableCase ? (
        <section className="vault__panel vault__panel--inspect" aria-label={`Inspección de ${tableCase.code}`}>
          <InspectionPanel
            caseData={tableCase}
            caseProgress={progress.cases[tableCase.id]}
            hint={hint}
            hoveredSeal={hoveredSeal}
            lamp={lamp}
            feedback={feedback}
            onLamp={() => setLamp((v) => !v)}
            onZoom={zoom}
            onFocus={(sealId) => inspectApi.current?.focus(sealId)}
            onPeel={handlePeel}
            onReread={setFlashbackId}
            onMark={handleMark}
            onArchive={archiveTable}
            onNotes={setNotesTab}
            onBack={() => navigate('table')}
          />
        </section>
      ) : (
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
            <p className="vault__hint">A los costados: la libreta del expediente y las carpetas archivadas (izquierda) y la planilla de control (derecha).</p>
            <div className="row">
              <button type="button" className="btn btn--primary" onClick={() => (tableCaseId ? activate('table') : navigate('left'))}>
                {tableCaseId === '00' ? 'Leer el registro de la B3-11' : tableCaseId ? 'Inspeccionar de cerca' : 'Buscar en las estanterías'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setNotesTab('case')}>
                Libreta
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setNotesTab('archive')}>
                Archivados
              </button>
            </div>
          </div>
        ) : view === 'terminal' ? (
          <div className="vault__card">
            <div className="label">TERMINAL B3-T02</div>
            <p>{signedIn ? `Sesión abierta: ${operator}.` : 'Sin sesión. El sistema registra cada inspección.'}</p>
            <p className="vault__hint">Usá el menú de la pantalla: sesión, lote, registro, barrera, protocolo, formularios y ayuda.</p>
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
      )}

      {notesTab ? (
        <InspectionNotes tab={notesTab} onTab={setNotesTab} onClose={closeNotes} caseData={tableCase ?? null} progress={progress} onFind={findMemory} />
      ) : null}

      {flashbackSeal ? (
        <div className="vault__intro vault__flashback">
          <MangaFlashback
            seal={flashbackSeal}
            found={progress.memory.includes(flashbackSeal.flashback.hidden.id)}
            onFind={() => findMemory(flashbackSeal.flashback.hidden.id)}
            onClose={closeFlashback}
          />
        </div>
      ) : null}

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
        {signedIn && tableCase ? (
          <button type="button" className={`vault__chip ${view === 'inspect' ? 'is-active' : ''}`} aria-current={view === 'inspect'} onClick={() => activate('table')}>
            Inspección de cerca
          </button>
        ) : null}
        {signedIn ? (
          <button type="button" className="vault__chip vault__chip--exit" onClick={() => activate('exit')}>
            Salida · cerrar sesión
          </button>
        ) : null}
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

      {confirmExit ? (
        <div className="vault__intro" onClick={() => !leaving && setConfirmExit(false)}>
          <div
            className="vault__card vault__card--warn vault__confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="label" id="exit-title">SALIDA DE EMERGENCIA</div>
            <p id="exit-desc">
              ¿Cerrar la sesión de {operator ?? 'este operador'}? Vas a tener que identificarte de nuevo en la terminal para seguir inspeccionando.
            </p>
            <div className="row">
              <button type="button" className="btn btn--primary" onClick={signOut} disabled={leaving}>
                {leaving ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmExit(false)} disabled={leaving} autoFocus>
                Quedarme
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!entered ? (
        // Inicio: la pantalla de CustodiaOS tapa la sala y deja verla solo por el recuadro de la cámara.
        <div className="vault__start">
          <Shell hints="[ENTER] Entrar  [S] Sonido  [R] Efectos  [C] Créditos">
            <ScreenHead eyebrow="Inicio" title="contención" size="hero" />
            {intro}
            <div className="intro__scene" aria-hidden="true">
              <span className="intro__corner intro__corner--tl" />
              <span className="intro__corner intro__corner--tr" />
              <span className="intro__corner intro__corner--bl" />
              <span className="intro__corner intro__corner--br" />
              <span className="viewport__rec">
                <span className="rec" /> REC&nbsp; CAM-B3-01&nbsp; 15/03/2018 23:31
              </span>
            </div>
            <div className="keys intro__keys">
              <Key k="ENTER" variant="fill" onClick={enter} autoFocus>
                Entrar a la bóveda
              </Key>
              <Key k="S" aria-pressed={settings.sound} onClick={toggleSound}>
                Sonido: {settings.sound ? 'sí' : 'no'}
              </Key>
              <Key k="R" aria-pressed={settings.reduceEffects} onClick={toggleReduce}>
                Efectos reducidos: {settings.reduceEffects ? 'sí' : 'no'}
              </Key>
              <Key k="C" href="/creditos">
                Créditos
              </Key>
            </div>
            {legal}
          </Shell>
        </div>
      ) : null}
    </main>
  );
}
