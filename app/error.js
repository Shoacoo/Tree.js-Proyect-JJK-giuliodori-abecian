'use client';

import Link from 'next/link';

export default function Error({ error, reset }) {
  return (
    <main className="standalone">
      <div className="label red">ERROR 0x4F · FALLA DEL SISTEMA DE EXPEDIENTES</div>
      <h1 className="display">La terminal no respondió</h1>
      <p className="lead">El registro de la sesión quedó guardado. Podés reintentar o volver al índice.</p>
      <p className="mono small muted">{error?.digest ? `Código: ${error.digest}` : null}</p>
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={() => reset()}>
          Reintentar
        </button>
        <Link className="btn" href="/indice">
          Volver al índice
        </Link>
      </div>
    </main>
  );
}
