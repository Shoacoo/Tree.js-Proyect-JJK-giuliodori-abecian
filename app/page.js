import Link from 'next/link';
import Vault from '@/components/Vault';

// Portada (Server Component): el texto de la pantalla de inicio se renderiza en el servidor
// y la bóveda 3D (Client Component) lo muestra encima de la escena.
export default function Home() {
  return (
    <Vault
      intro={<p className="intro__sub">Tres dedos sellados. Una orden de mantenimiento. Nadie más en el subsuelo.</p>}
      legal={
        <p className="intro__legal">
          Subsuelo B3 · Colegio Jujutsu de Tokio. Buscá los dedos del lote en las cajas de las estanterías, llevalos a la mesa de
          inspección y usá la terminal para entrar al sistema de expedientes. Proyecto académico, Programación III (UMAI). Jujutsu
          Kaisen © Gege Akutami / Shueisha. Sin fines comerciales. <Link href="/creditos">Créditos</Link>
        </p>
      }
    />
  );
}
