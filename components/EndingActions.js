'use client';

import { useRouter } from 'next/navigation';
import { Key, handle, useHotkeys } from '@/components/Shell';
import { useProgress } from '@/hooks/useProgress';

// Firma del documento final: el operador de la partida.
export function OperatorSignature() {
  const { operator } = useProgress();
  return <span>{handle(operator)}</span>;
}

// Empieza una inspección nueva (conserva los finales ya conseguidos) o va a los créditos.
export default function EndingActions() {
  const router = useRouter();
  const { resetRun } = useProgress();
  const newRun = () => {
    resetRun();
    router.push('/indice');
  };
  useHotkeys({ n: newRun, c: () => router.push('/creditos') });

  return (
    <div className="keys ending-keys">
      <Key k="N" variant="fill" onClick={newRun}>
        Nueva partida
      </Key>
      <Key k="C" href="/creditos">
        Créditos
      </Key>
    </div>
  );
}
