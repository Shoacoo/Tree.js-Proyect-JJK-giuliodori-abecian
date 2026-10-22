'use client';

import { useRouter } from 'next/navigation';
import { useProgress } from '@/hooks/useProgress';

// Empieza una inspección nueva y conserva los finales ya conseguidos.
export default function NewRunButton() {
  const router = useRouter();
  const { resetRun } = useProgress();
  return (
    <button
      type="button"
      className="btn btn--primary"
      onClick={() => {
        resetRun();
        router.push('/indice');
      }}
    >
      Nueva inspección
    </button>
  );
}
