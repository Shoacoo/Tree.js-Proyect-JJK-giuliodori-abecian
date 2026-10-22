'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Terminal from '@/components/Terminal';
import { CASES, MEMORY_TOTAL, SETTING } from '@/data/cases';
import { ENDINGS } from '@/data/endings';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { startHum, stopHum } from '@/lib/sound';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
    </label>
  );
}

export default function CaseIndex() {
  const router = useRouter();
  const { progress, hydrated, authReady, signedIn, operator, influence, settings, setSettings, auth, user, resetRun } =
    useProgress();

  useEffect(() => {
    if (hydrated && authReady && !signedIn) router.replace('/acceso');
  }, [hydrated, authReady, signedIn, router]);

  useEffect(() => {
    if (settings.sound) startHum();
    else stopHum();
  }, [settings.sound]);

  const finalUnlocked = isCaseUnlocked(progress, '00');

  return (
    <Terminal>
      <div className="index">
        <aside className="index__side">
          <div>
            <div className="label">OPERADOR</div>
            <div className="index__operator">{operator}</div>
            <div className="mono small muted">Ventana · personal de apoyo</div>
          </div>
          <div className="index__block">
            <div className="label">DEDOS ARCHIVADOS</div>
            <div className="squares" aria-label={`${influence} de 3`}>
              {CASES.map((c, i) => (
                <span key={c.id} className={i < influence ? 'is-on' : ''} />
              ))}
              <span className="mono">{influence} / 3</span>
            </div>
            <div className="label">RESIDUO EN BÓVEDA</div>
            <div className="mono">{progress.leak}</div>
            <div className="label">DETALLES REGISTRADOS</div>
            <div className="mono">
              {progress.memory.length} / {MEMORY_TOTAL}
            </div>
          </div>
          <div className="index__block">
            <div className="label">AJUSTES</div>
            <Toggle
              label="Reducir efectos"
              checked={settings.reduceEffects}
              onChange={(v) => setSettings((s) => ({ ...s, reduceEffects: v }))}
            />
            <Toggle label="Sonido" checked={settings.sound} onChange={(v) => setSettings((s) => ({ ...s, sound: v }))} />
          </div>
          <div className="index__block">
            <Link href="/creditos" className="link">Créditos y referencias</Link>
            {user ? (
              <button type="button" className="link" onClick={() => auth.signOut().then(() => router.push('/acceso'))}>
                Cerrar sesión
              </button>
            ) : null}
          </div>
        </aside>

        <section className="index__main">
          <div className="label">
            {SETTING.lot} · {CASES.length} EXPEDIENTES · {SETTING.maintenanceOrder}
          </div>
          <h1 className="display">Índice de expedientes</h1>
          <p className="lead">
            Dedos recuperados en campo, pendientes de control de integridad. Verificar cada sello, registrar su estado y
            archivar en orden.
          </p>
          <table className="index__table">
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>OBJETO · HALLAZGO</th>
                <th>RECUPERADO</th>
                <th>SELLOS</th>
                <th>ESTADO</th>
                <th><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {CASES.map((c, i) => {
                const open = isCaseUnlocked(progress, c.id);
                const archived = progress.cases[c.id].archived;
                const status = archived ? 'ARCHIVADO' : open ? 'PENDIENTE' : 'BLOQUEADO';
                return (
                  <tr key={c.id} className={open ? '' : 'is-locked'}>
                    <td className="mono">{c.code}</td>
                    <td>
                      <strong>{c.title}</strong>
                      <div className="muted">{c.place}</div>
                    </td>
                    <td className="mono">{c.recovered.split(' ')[0]}</td>
                    <td className="mono">{c.seals.length}</td>
                    <td>
                      <span className={`chip chip--${status.toLowerCase()}`}>{status}</span>
                    </td>
                    <td className="right">
                      {open ? (
                        <Link className="btn btn--primary" href={`/expediente/${c.id}`}>
                          {archived ? 'Revisar' : 'Abrir expediente'} →
                        </Link>
                      ) : (
                        <span className="muted">Requiere archivar {CASES[i - 1].code}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {finalUnlocked ? (
                <tr className="is-new">
                  <td className="mono">EXP-00</td>
                  <td>
                    <strong>Sin título</strong>
                    <div className="muted">No figura en el registro central</div>
                  </td>
                  <td className="mono">S/F</td>
                  <td className="mono">0</td>
                  <td>
                    <span className="chip chip--nuevo">NUEVO</span>
                  </td>
                  <td className="right">
                    <Link className="btn btn--danger" href="/expediente/00">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {!finalUnlocked ? (
            <p className="mono small muted">FIN DEL ÍNDICE. NO HAY EXPEDIENTES ADICIONALES REGISTRADOS EN ESTE LOTE.</p>
          ) : null}

          <ol className="steps">
            <li><span className="label">PASO 1</span><strong>Levantar el sello</strong>Mantener presionado cada ofuda hasta que se suelte. Soltar antes lo arranca.</li>
            <li><span className="label">PASO 2</span><strong>Leer el residuo</strong>Registrar lo que el residuo muestra del hallazgo.</li>
            <li><span className="label">PASO 3</span><strong>Marcar el estado</strong>Intacto, debilitado o roto.</li>
            <li><span className="label">PASO 4</span><strong>Archivar</strong>Los sellos se retiran en orden inverso al de colocación. Se habilita el siguiente.</li>
          </ol>

          {progress.endingsUnlocked.length ? (
            <div className="endings-strip">
              <span className="label">FINALES REGISTRADOS</span>
              {Object.values(ENDINGS).map((e) => (
                <span key={e.id} className={`chip ${progress.endingsUnlocked.includes(e.id) ? 'chip--archivado' : 'chip--bloqueado'}`}>
                  {progress.endingsUnlocked.includes(e.id) ? e.title : '???'}
                </span>
              ))}
              <button type="button" className="link" onClick={resetRun}>
                Nueva inspección
              </button>
            </div>
          ) : null}

          {progress.log.length ? (
            <details className="log">
              <summary className="label">REGISTRO DE ACTIVIDAD ({progress.log.length})</summary>
              <ul>
                {progress.log.slice(-12).reverse().map((entry, i) => (
                  <li key={i} className="mono small">
                    {entry.at} · {entry.text}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </Terminal>
  );
}
