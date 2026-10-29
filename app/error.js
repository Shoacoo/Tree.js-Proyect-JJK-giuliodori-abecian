'use client';

import Shell, { Key, ScreenHead } from '@/components/Shell';

export default function Error({ error, reset }) {
  return (
    <Shell hints="[ENTER] Reintentar">
      <ScreenHead eyebrow="Error 0x4F · falla del sistema de expedientes" tone="red" title="La terminal no respondió" />
      <div className="stack" style={{ maxWidth: 560 }}>
        <p className="lead">El registro de la sesión quedó guardado. Podés reintentar o volver al índice.</p>
        {error?.digest ? <p className="small muted">Código: {error.digest}</p> : null}
        <div className="keys">
          <Key k="ENTER" variant="fill" onClick={() => reset()} autoFocus>
            Reintentar
          </Key>
          <Key href="/indice">Volver al índice</Key>
        </div>
      </div>
    </Shell>
  );
}
