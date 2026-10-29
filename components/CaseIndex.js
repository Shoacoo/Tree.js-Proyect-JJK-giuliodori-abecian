'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Barrier, Desk, Forms, Help, Log, Lot, Protocol } from '@/components/IndexScreens';
import Shell, { useHash } from '@/components/Shell';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { useQuality } from '@/hooks/useQuality';
import { startHum, stopHum } from '@/lib/sound';

// Barra de estado: los atajos reales de cada pantalla.
const HINTS = {
  sesion: '[I] Índice  [S] Firmar orden  [C] Cambiar operador',
  lote: '[↑/↓] Navegar  [ENTER] Abrir  [M] Marcar',
  registro: '[↑/↓] Recorrer  [L] Exportar  [R] Reintentar',
  barrera: 'Lectura en vivo · sensor B3-S1',
  protocolo: '[F] Firmar conformidad',
  formularios: '[S] Sonido  [R] Efectos  [Q] Calidad',
  ayuda: '[TAB] Navegar  [ENTER] Seleccionar  [ESC] Cerrar',
};

/**
 * Sistema de expedientes del Depósito B3. Cada pantalla del menú vive en el hash
 * (/indice#registro) para que el panel lateral funcione igual desde cualquier página.
 */
export default function CaseIndex() {
  const router = useRouter();
  const hash = useHash();
  const { progress, hydrated, authReady, signedIn, operator, influence, settings, setSettings, auth, user, resetRun } = useProgress();
  const quality = useQuality();
  const tab = HINTS[hash] ? hash : 'lote';

  useEffect(() => {
    if (hydrated && authReady && !signedIn) router.replace('/acceso');
  }, [hydrated, authReady, signedIn, router]);

  useEffect(() => {
    if (settings.sound) startHum();
    else stopHum();
  }, [settings.sound]);

  const finalUnlocked = isCaseUnlocked(progress, '00');
  const signOut = async () => {
    if (user) await auth.signOut();
    else auth.enterLocal(null);
    router.push('/acceso');
  };
  const shared = { progress, operator, influence, finalUnlocked };

  return (
    <Shell active={tab} hints={HINTS[tab]}>
      {tab === 'sesion' ? <Desk {...shared} onSignOut={signOut} /> : null}
      {tab === 'lote' ? <Lot {...shared} /> : null}
      {tab === 'registro' ? <Log {...shared} /> : null}
      {tab === 'barrera' ? <Barrier {...shared} /> : null}
      {tab === 'protocolo' ? <Protocol {...shared} /> : null}
      {tab === 'formularios' ? (
        <Forms {...shared} settings={settings} setSettings={setSettings} quality={quality} onSignOut={signOut} onReset={resetRun} />
      ) : null}
      {tab === 'ayuda' ? <Help /> : null}
    </Shell>
  );
}
