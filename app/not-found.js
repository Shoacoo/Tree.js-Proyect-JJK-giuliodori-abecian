import Link from 'next/link';

export const metadata = { title: 'Expediente no encontrado' };

export default function NotFound() {
  return (
    <main className="standalone">
      <div className="label">ERROR 404 · DEPÓSITO B3</div>
      <h1 className="display">Expediente no encontrado</h1>
      <p className="lead">No hay ningún objeto registrado con ese código. Si existía, alguien lo dio de baja.</p>
      <Link className="btn btn--primary" href="/indice">
        Volver al índice
      </Link>
    </main>
  );
}
