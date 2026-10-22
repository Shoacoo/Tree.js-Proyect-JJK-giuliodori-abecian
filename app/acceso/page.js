import AuthPanel from '@/components/AuthPanel';
import { SETTING } from '@/data/cases';

export const metadata = { title: 'Acceso al sistema de expedientes' };

export default function AccessPage() {
  return (
    <main className="access">
      <header className="terminal__bar">
        <div className="terminal__brand">
          <span className="terminal__kanji">呪術高専</span>
          <span>SISTEMA DE EXPEDIENTES · DEPÓSITO B3</span>
        </div>
        <div className="terminal__meta">
          <span>{SETTING.terminal} · {SETTING.date} · 23:38</span>
        </div>
      </header>
      <div className="access__body">
        <section className="access__intro">
          <div className="label">FORMULARIO B3-01 · ACCESO DE PERSONAL DE APOYO</div>
          <h1 className="display display--xl">Sistema de expedientes de objetos malditos</h1>
          <p className="lead">
            Uso exclusivo de Ventanas asignadas al Depósito B3. Toda inspección queda registrada a nombre de quien la realiza.
          </p>
          <dl className="facts facts--3">
            <div><dt>UBICACIÓN</dt><dd>Subsuelo B3, Colegio Jujutsu, Tokio</dd></div>
            <div><dt>LOTE ACTIVO</dt><dd>{SETTING.lot} · 3 expedientes</dd></div>
            <div><dt>TAREA</dt><dd>Control de integridad de sellos</dd></div>
          </dl>
          <p className="mono small muted">
            Proyecto académico, Programación III (UMAI). Jujutsu Kaisen © Gege Akutami / Shueisha. Sin fines comerciales.
          </p>
        </section>
        <AuthPanel />
      </div>
    </main>
  );
}
