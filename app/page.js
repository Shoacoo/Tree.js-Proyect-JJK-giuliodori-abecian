import Link from 'next/link';
import Vault from '@/components/Vault';

// Portada (Server Component): el texto de la intro se renderiza en el servidor
// y la bóveda 3D (Client Component) lo muestra encima de la escena.
export default function Home() {
  return (
    <Vault
      intro={
        <>
          <div className="label">SUBSUELO B3 · COLEGIO JUJUTSU DE TOKIO · 15/03/2018 · 23:36</div>
          <h2 className="display display--xl">Contención</h2>
          <p className="lead">
            Una Ventana del Colegio Jujutsu abre los sellos de tres dedos de Sukuna y descubre lo que los superiores esconden en
            el Depósito B3.
          </p>
          <p className="muted">
            Buscá los dedos del lote en las cajas de las estanterías, llevalos a la mesa de inspección y usá la terminal para
            entrar al sistema de expedientes.
          </p>
          <p className="mono small muted">
            Proyecto académico, Programación III (UMAI). Jujutsu Kaisen © Gege Akutami / Shueisha. Sin fines comerciales.{' '}
            <Link href="/creditos">Créditos</Link>
          </p>
        </>
      }
    />
  );
}
