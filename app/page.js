import Link from 'next/link';

// Portada (Server Component): presenta la premisa y la sala donde transcurre todo.
export default function Home() {
  return (
    <main className="home">
      <section className="home__intro">
        <div className="label">UBICACIÓN DE INICIO · SUBSUELO B3, COLEGIO JUJUTSU DE TOKIO · MARZO DE 2018</div>
        <h1 className="display display--xl">Contención</h1>
        <p className="lead">
          Una Ventana del Colegio Jujutsu abre los sellos de tres dedos de Sukuna y descubre lo que los superiores esconden
          en el Depósito B3.
        </p>
        <ol className="home__room">
          <li><strong>Estanterías del depósito.</strong> Cajas numeradas; cada una guarda un objeto sellado. La B3-11 figura vacía.</li>
          <li><strong>Tubo fluorescente.</strong> Zumba todo el tiempo. Parpadea más a medida que avanzás.</li>
          <li><strong>Mesa de inspección.</strong> Luz cenital dura. Ahí vas a despegar cada sello.</li>
          <li><strong>Terminal B3-T02.</strong> Esta web es la pantalla que usa la Ventana sentada en esa sala.</li>
        </ol>
        <div className="row">
          <Link className="btn btn--primary" href="/acceso">
            Ingresar al sistema
          </Link>
          <Link className="btn btn--ghost" href="/creditos">
            Créditos y referencias
          </Link>
        </div>
        <p className="mono small muted">
          Proyecto académico, Programación III (UMAI). Jujutsu Kaisen © Gege Akutami / Shueisha. Sin fines comerciales.
        </p>
      </section>
    </main>
  );
}
