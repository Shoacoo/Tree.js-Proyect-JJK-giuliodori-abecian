import Shell, { Key, ScreenHead } from '@/components/Shell';

export const metadata = { title: 'Expediente no encontrado' };

export default function NotFound() {
  return (
    <Shell>
      <ScreenHead eyebrow="Error 404 · Depósito B3" tone="red" title="Expediente no encontrado" />
      <div className="stack" style={{ maxWidth: 560 }}>
        <p className="lead">No hay ningún objeto registrado con ese código. Si existía, alguien lo dio de baja.</p>
        <div className="keys">
          <Key variant="fill" href="/indice">
            Volver al índice
          </Key>
          <Key href="/">Volver a la bóveda</Key>
        </div>
      </div>
    </Shell>
  );
}
