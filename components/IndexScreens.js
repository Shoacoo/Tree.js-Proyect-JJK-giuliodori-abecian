'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cells, Key, PersistenceBadge, ScreenHead, Tag, goHash, handle, useHotkeys } from '@/components/Shell';
import { CASES, MEMORY_TOTAL, SETTING } from '@/data/cases';
import { ENDINGS } from '@/data/endings';
import { isCaseUnlocked } from '@/hooks/useProgress';
import { qualityLabel } from '@/hooks/useQuality';
import { LEAK_LIMIT, barrierCells, barrierReading, logParts, placeKind, shortPlace } from '@/lib/readings';

// Pantallas del sistema de expedientes (/indice#lote, #registro, …). CaseIndex elige cuál se ve.

const LOT = SETTING.lot.replace(/^LOTE /, '');
const ORDER = SETTING.maintenanceOrder.split(' ').pop();
const ASSIGNED = SETTING.date.split(' ')[1];

function lotRows(progress, finalUnlocked) {
  const rows = CASES.map((c, i) => {
    const open = isCaseUnlocked(progress, c.id);
    const archived = progress.cases[c.id].archived;
    return {
      id: c.id,
      code: c.code,
      origin: shortPlace(c.place),
      box: c.box,
      dots: c.seals.map((s) => (progress.cases[c.id].seals[s.id].peeled ? '○' : '●')).join(''),
      status: archived ? 'archivado' : open ? 'pendiente' : 'bloqueado',
      href: open ? `/expediente/${c.id}` : null,
      title: `${c.code} · ${shortPlace(c.place)}`,
      desc: `${placeKind(c.place)}. ${c.title}, recuperado el ${c.recovered.split(' ')[0]}. ${c.seals.length} sellos de papel, caja ${c.box}.${
        archived ? ' Archivado: se puede volver a revisar.' : open ? '' : ` Bloqueado hasta archivar el ${CASES[i - 1].code}.`
      }`,
      archived,
    };
  });
  rows.push(
    finalUnlocked
      ? {
          id: '00',
          code: 'B3-11',
          origin: 'sin registro',
          box: 'B3-11',
          dots: '—',
          status: 'revisar',
          href: '/expediente/00',
          alert: true,
          title: 'B3-11 · Sin registro',
          desc: 'La caja que el sistema da por vacía. Adentro hay un dedo sin sellos y el registro de la Ventana N.º 0391.',
        }
      : {
          id: 'b3-11',
          code: 'B3-11',
          origin: 'vacía',
          box: 'B3-11',
          dots: '—',
          status: 'vacía',
          href: null,
          title: 'B3-11 · Vacía',
          desc: 'Según el sistema, este lugar nunca se usó.',
        },
  );
  return rows;
}

const STATUS_TONE = { archivado: 'normal', pendiente: 'normal', bloqueado: 'muted', vacía: 'muted', revisar: 'active' };

export function Desk({ progress, operator, finalUnlocked, onSignOut, canOpen = true }) {
  const [tab, setTab] = useState('orders');
  const [received, setReceived] = useState(false);
  const archived = CASES.filter((c) => progress.cases[c.id].archived).length;

  useHotkeys({
    i: () => goHash('lote'),
    c: onSignOut,
    s: () => setReceived(true),
    Enter: () => goHash('lote'),
  });

  return (
    <>
      <ScreenHead eyebrow="Sesión" title="Sesión activa" />
      <section className="panel" aria-label="Operador">
        <div className="desk__op">
          <div className="photo" role="img" aria-label="Foto del legajo" />
          <div className="desk__info">
            <div className="desk__top">
              <span className="desk__handle">{handle(operator)}</span>
              <span className="desk__meta">Asignado {ASSIGNED}</span>
            </div>
            <p className="muted">Ventana · personal de apoyo. Sin técnica.</p>
            <PersistenceBadge />
          </div>
        </div>
        <div className="desk__foot">
          <div className="desk__stats">
            <span>
              <strong>{archived}</strong>Archivados
            </span>
            <span>
              <strong>{CASES.length - archived}</strong>Pendientes
            </span>
          </div>
          <div className="keys">
            <Key k="I" href="#lote">
              Índice
            </Key>
            <Key k="C" onClick={onSignOut}>
              Cambiar
            </Key>
          </div>
        </div>
      </section>

      <div className="keys desk__tabs" role="tablist" aria-label="Bandeja">
        <Key variant={tab === 'orders' ? 'fill' : 'outline'} role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>
          Órdenes
        </Key>
        <Key variant={tab === 'cases' ? 'fill' : 'outline'} role="tab" aria-selected={tab === 'cases'} onClick={() => setTab('cases')}>
          Expedientes
        </Key>
      </div>

      {tab === 'orders' ? (
        <article className="panel order-card" aria-label={`Orden ${ORDER}`}>
          <div className="panel__head">
            <span className="desk__handle">@superior_sin_firma</span>
            <span className="small">23:02 · {CASES.length} objetos · 1 lote</span>
          </div>
          <span className={`order-card__code${finalUnlocked ? ' is-struck' : ''}`}>{ORDER}</span>
          <ul>
            <li>Control de integridad del lote {LOT}</li>
            <li>Retirar sellos en orden inverso</li>
            <li>Archivar cada expediente antes de salir</li>
          </ul>
          <div className="order-card__foot">
            <div className="order-card__actions">
              <Key k="↵" variant="plain" href="#lote">
                Abrir
              </Key>
              {received ? (
                <span className="y">Recibida por {handle(operator)}</span>
              ) : (
                <Key k="S" variant="plain" onClick={() => setReceived(true)}>
                  Firmar
                </Key>
              )}
            </div>
            <div className="tags">
              <Tag>mantenimiento</Tag>
              <Tag>B3</Tag>
              <Tag tone="alert">{finalUnlocked ? 'no figura en el archivo' : 'sin firma'}</Tag>
            </div>
          </div>
        </article>
      ) : (
        <div className="case-list">
          {lotRows(progress, finalUnlocked)
            .filter((row) => row.href && canOpen)
            .map((row) => (
              <Link key={row.id} href={row.href} className={`panel panel--tight${row.alert ? ' panel--alert' : ''}`}>
                <span>
                  {row.code} · {row.origin}
                </span>
                <Tag tone={STATUS_TONE[row.status]}>{row.status}</Tag>
              </Link>
            ))}
        </div>
      )}
    </>
  );
}

// canOpen: en el recorrido guiado, los expedientes se abren recién en el paso que lo pide.
export function Lot({ progress, finalUnlocked, canOpen = true }) {
  const router = useRouter();
  const rows = lotRows(progress, finalUnlocked).map((r) => (canOpen ? r : { ...r, href: null }));
  const fallback = Math.max(0, rows.findIndex((r) => r.status === 'pendiente' || r.status === 'revisar'));
  const [picked, setPicked] = useState(null);
  const [marked, setMarked] = useState([]);
  const index = Math.min(picked ?? fallback, rows.length - 1);
  const row = rows[index];
  const isMarked = marked.includes(row.id);
  const toggleMark = () => setMarked((list) => (list.includes(row.id) ? list.filter((id) => id !== row.id) : [...list, row.id]));

  useHotkeys({
    ArrowDown: () => setPicked(Math.min(rows.length - 1, index + 1)),
    ArrowUp: () => setPicked(Math.max(0, index - 1)),
    Enter: () => row.href && router.push(row.href),
    m: toggleMark,
  });

  return (
    <>
      <ScreenHead eyebrow="Lote" title={`Lote ${LOT}`} />
      <div className="lot" role="listbox" aria-label={`Expedientes del lote ${LOT}`}>
        <div className="lot__grid lot__head" aria-hidden="true">
          <span>EXP</span>
          <span>ORIGEN</span>
          <span>CAJA</span>
          <span>SELLOS</span>
          <span>ESTADO</span>
        </div>
        {rows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={i === index}
            className={`lot__row lot__grid${i === index ? ' is-selected' : ''}${!r.href && !r.alert ? ' is-locked' : ''}${r.alert ? ' is-alert' : ''}${marked.includes(r.id) ? ' is-marked' : ''}`}
            data-tour={`case-${r.id}`}
            onClick={() => setPicked(i)}
            onDoubleClick={() => r.href && router.push(r.href)}
          >
            <span className="lot__code">{r.code}</span>
            <span>{r.origin}</span>
            <span>{r.box}</span>
            <span className="dots" aria-label={r.dots === '—' ? 'sin sellos' : `${(r.dots.match(/●/g) ?? []).length} sellos colocados`}>
              {r.dots}
            </span>
            <Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag>
          </button>
        ))}
      </div>

      <section className={`panel lot__detail${row.alert ? ' panel--alert' : ''}`} aria-live="polite">
        <h2 className="lot__title">{row.title}</h2>
        <p className="lot__desc">{row.desc}</p>
        <div className="keys">
          <Key k="↵" variant={row.alert ? 'red' : 'fill'} href={row.href ?? undefined} disabled={!row.href} data-tour={`case-${row.id}`}>
            {row.archived ? 'Revisar expediente' : 'Abrir expediente'}
          </Key>
          <Key k="M" aria-pressed={isMarked} onClick={toggleMark}>
            {isMarked ? 'Desmarcar' : 'Marcar'}
          </Key>
        </div>
      </section>
    </>
  );
}

function exportLog(entries, operator) {
  const lines = [
    `CustodiaOS · Registro de actividad · ${SETTING.terminal} · ${SETTING.lot}`,
    `Operador: ${handle(operator)}`,
    '',
    ...entries.map((e) => `${e.at}  ${e.text}${e.detail ? ` · ${e.detail}` : ''}`),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'registro-B3.txt';
  link.click();
  URL.revokeObjectURL(url);
}

export function Log({ progress, operator, finalUnlocked }) {
  const entries = progress.log.map(logParts);
  const [picked, setPicked] = useState(null);
  const [retries, setRetries] = useState(0);
  const last = entries.length - 1;
  const retry = () => finalUnlocked && setRetries((n) => n + 1);

  useHotkeys({
    ArrowDown: () => entries.length && setPicked(Math.min(last, (picked ?? -1) + 1)),
    ArrowUp: () => entries.length && setPicked(Math.max(0, (picked ?? entries.length) - 1)),
    l: () => exportLog(entries, operator),
    r: retry,
  });

  return (
    <>
      <ScreenHead eyebrow="Registro" title="Registro de actividad" />
      <div className="log-list">
        {finalUnlocked ? null : (
          <div className="log-row">
            <span className="log-row__at">23:02</span>
            <span>{ORDER} emitida</span>
            <span className="log-row__detail">@superior_sin_firma</span>
          </div>
        )}
        {entries.length ? (
          entries.map((e, i) => (
            <div key={i} className={`log-row${e.bad ? ' log-row--bad' : ''}${picked === i ? ' is-selected' : ''}`}>
              <span className="log-row__at">{e.at}</span>
              <span>{e.text}</span>
              <span className="log-row__detail">{e.detail}</span>
            </div>
          ))
        ) : (
          <p className="muted">Sin actividad registrada en esta inspección.</p>
        )}
        {finalUnlocked ? (
          <div className="log-row log-row--deleted">
            <span className="log-row__at">23:02</span>
            <span className="redact" aria-label="Entrada tachada" />
            <Tag tone="active">eliminado</Tag>
          </div>
        ) : null}
      </div>

      {finalUnlocked ? (
        <section className="panel panel--red authz" role="alert">
          <span className="small">{ORDER}</span>
          <h2 className="authz__title">
            Autorización
            <br />
            no encontrada
          </h2>
          <div className="authz__foot">
            <span>{retries ? `Reintento ${retries}: sin respuesta del archivo central.` : 'La orden ya no figura en el sistema central.'}</span>
            <Key k="R" variant="ink" onClick={retry}>
              Reintentar
            </Key>
          </div>
        </section>
      ) : null}

      <div className="log-hints">
        <span>[↑/↓] recorrer</span>
        <button type="button" className="link" onClick={() => exportLog(entries, operator)}>
          [L] exportar registro
        </button>
      </div>
    </>
  );
}

export function Barrier({ progress, influence, finalUnlocked }) {
  const { percent, stress, status } = barrierReading(progress.leak, influence);
  const cells = barrierCells(percent, stress);
  const readAt = progress.log.at(-1)?.at?.slice(0, 5) ?? SETTING.time;
  const alert =
    influence >= 2 || finalUnlocked
      ? 'Residuos sin registro detectados en la caja B3-11.'
      : progress.leak > 0
        ? `Fuga registrada: ${progress.leak} de energía maldita en el depósito.`
        : null;

  return (
    <section className="barrier" aria-label="Barrera del depósito">
      <ScreenHead eyebrow="Barrera del depósito" />
      <div className="barrier__top">
        <p className={`barrier__value${status === 'crítica' ? ' is-critical' : ''}`}>{percent}%</p>
        <div className="barrier__status">
          <span className={`key ${status === 'crítica' ? 'key--red' : 'key--fill'}`} role="status">
            {status.toUpperCase()}
          </span>
          <span>Lectura {readAt} · sensor B3-S1</span>
        </div>
      </div>
      <div className="meter-cells" role="img" aria-label={`Barrera al ${percent} %`}>
        {cells.map((tone, i) => (
          <span key={i} className={tone ? `is-${tone}` : ''} />
        ))}
      </div>
      <div className="meter-labels" aria-hidden="true">
        <span>estable</span>
        <span>crítico</span>
      </div>
      <div className="readings">
        <div className="reading">
          <span>energía filtrada</span>
          <Cells value={Math.min(progress.leak, LEAK_LIMIT)} max={LEAK_LIMIT} tone="r" />
          <span className={`reading__value${progress.leak ? ' reading__value--r' : ''}`}>
            {progress.leak}/{LEAK_LIMIT}
          </span>
        </div>
        <div className="reading">
          <span>memoria</span>
          <Cells value={progress.memory.length} max={MEMORY_TOTAL} />
          <span className="reading__value">
            {progress.memory.length}/{MEMORY_TOTAL}
          </span>
        </div>
        <div className="reading">
          <span>dedos archivados</span>
          <Cells value={influence} max={CASES.length} />
          <span className="reading__value">
            {influence}/{CASES.length}
          </span>
        </div>
      </div>
      {alert ? (
        <p className="notice notice--red" role="status">
          <span className="notice__mark" aria-hidden="true">
            !
          </span>
          {alert}
        </p>
      ) : null}
    </section>
  );
}

const RULES = [
  'Retirar los sellos en orden inverso al de colocación.',
  'Usar guantes durante toda la inspección.',
  'No dirigirle la palabra al objeto.',
];

export function Protocol({ operator }) {
  const [signed, setSigned] = useState(false);
  useHotkeys({ f: () => setSigned(true) });

  return (
    <>
      <ScreenHead eyebrow="Protocolo" title="Protocolo de inspección" />
      <ol className="rules" aria-label="Reglas">
        {RULES.map((rule, i) => (
          <li key={rule} className="panel rule">
            <span className="rule__num">{String(i + 1).padStart(2, '0')}</span>
            <span>{rule}</span>
          </li>
        ))}
        <li className="panel panel--alert rule">
          <span className="rule__num">04</span>
          <span>La caja B3-11 figura vacía en el sistema.</span>
          <Tag tone="alert">¿?</Tag>
        </li>
      </ol>
      <section className="panel sign-panel" aria-label="Conformidad del operador">
        <h2 className="sign-panel__title">Conformidad del operador</h2>
        <p>Leí y acepto el protocolo vigente del Depósito B3.</p>
        <div className="sign-panel__foot">
          <div className="sign-line">
            <span className="sign-line__mark">{signed ? handle(operator).slice(1) : ''}</span>
            <span>{handle(operator)}</span>
          </div>
          <Key k="F" onClick={() => setSigned(true)} disabled={signed}>
            {signed ? 'Firmado' : 'Firmar'}
          </Key>
        </div>
      </section>
    </>
  );
}

export function Forms({ progress, operator, settings, setSettings, quality, onSignOut, onReset, onTour }) {
  const toggle = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }));
  useHotkeys({
    s: () => toggle('sound'),
    r: () => toggle('reduceEffects'),
    q: quality.cycle,
    t: onTour,
  });
  const endings = Object.values(ENDINGS);

  return (
    <>
      <ScreenHead eyebrow="Formularios" title="Formularios y ajustes" />
      <div className="forms">
        <section className="panel" aria-labelledby="form-equipo">
          <h2 id="form-equipo" className="eyebrow">
            Ajustes del equipo
          </h2>
          <div className="setting">
            <span>Sonido ambiente</span>
            <Key k="S" aria-pressed={settings.sound} onClick={() => toggle('sound')}>
              {settings.sound ? 'sí' : 'no'}
            </Key>
          </div>
          <div className="setting">
            <span>Efectos reducidos</span>
            <Key k="R" aria-pressed={settings.reduceEffects} onClick={() => toggle('reduceEffects')}>
              {settings.reduceEffects ? 'sí' : 'no'}
            </Key>
          </div>
          <div className="setting">
            <span>Calidad gráfica</span>
            <Key k="Q" onClick={quality.cycle} title="Auto se ajusta según el rendimiento de la PC">
              {qualityLabel(quality.pref, quality.quality)}
            </Key>
          </div>
        </section>

        <section className="panel" aria-labelledby="form-registro">
          <h2 id="form-registro" className="eyebrow">
            Estado del registro
          </h2>
          <div className="setting">
            <span>Operador</span>
            <span>{handle(operator)}</span>
          </div>
          <div className="setting">
            <span>Guardado</span>
            <PersistenceBadge />
          </div>
          <div className="setting">
            <span>Detalles registrados</span>
            <span>
              {progress.memory.length}/{MEMORY_TOTAL}
            </span>
          </div>
          <div className="setting">
            <span>Energía filtrada</span>
            <span className={progress.leak ? 'red' : ''}>{progress.leak}</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="form-finales">
          <h2 id="form-finales" className="eyebrow">
            Finales registrados
          </h2>
          <div className="tags" style={{ margin: '8px 0 16px' }}>
            {endings.map((e) => (
              <Tag key={e.id} tone={progress.endingsUnlocked.includes(e.id) ? 'y' : 'muted'}>
                {progress.endingsUnlocked.includes(e.id) ? e.title : '???'}
              </Tag>
            ))}
          </div>
          {progress.endingsUnlocked.length ? (
            <Key k="N" variant="fill" onClick={onReset}>
              Nueva inspección
            </Key>
          ) : (
            <p className="small muted">Todavía no cerraste ninguna inspección.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="form-sesion">
          <h2 id="form-sesion" className="eyebrow">
            Sesión
          </h2>
          <div className="keys" style={{ marginTop: 8 }}>
            <Key href="/">Volver a la bóveda</Key>
            <Key k="T" onClick={onTour}>
              Repetir el recorrido
            </Key>
            <Key href="/creditos">Créditos</Key>
            <Key variant="alert" onClick={onSignOut}>
              Cerrar sesión
            </Key>
          </div>
        </section>
      </div>
    </>
  );
}

const STEPS = [
  ['Buscar el dedo', 'En la bóveda, abrí la caja del expediente en la estantería y llevalo a la mesa de inspección.'],
  ['Levantar el sello', 'Mantené presionado cada sello hasta que se suelte solo. Si soltás antes, se arranca y se filtra energía.'],
  ['Leer el residuo', 'Cada sello deja un recuerdo del hallazgo. Algunas palabras esconden detalles: examinarlas suma memoria.'],
  ['Marcar el estado', 'Intacto, fisurado o dañado. Mirá el papel desplegado antes de elegir: si no coincide, el objeto queda mal resellado.'],
  ['Archivar', 'Los sellos se retiran en orden inverso al de colocación. Archivar un expediente habilita el siguiente del lote.'],
];

export function Help() {
  return (
    <>
      <ScreenHead eyebrow="Ayuda" title="Cómo se inspecciona" />
      <ol className="rules">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="panel rule">
            <span className="rule__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="rule__body">
              <strong>{title}</strong>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <section className="panel sign-panel" aria-label="Atajos de teclado">
        <h2 className="sign-panel__title">Atajos</h2>
        <ul className="seal-state__guide" style={{ fontSize: 13 }}>
          <li>
            <strong>[↑/↓]</strong> recorrer el lote y el registro · <strong>[ENTER]</strong> abrir lo seleccionado
          </li>
          <li>
            <strong>[1] [2] [3]</strong> estado del sello en la planilla · <strong>[L]</strong> luz rasante · <strong>[A]</strong> archivar
          </li>
          <li>
            <strong>[TAB]</strong> moverse entre botones · <strong>[ESC]</strong> cerrar una lectura de residuo
          </li>
        </ul>
      </section>
    </>
  );
}
