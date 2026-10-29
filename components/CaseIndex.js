'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Barrier, Desk, Forms, Help, Log, Lot, Protocol } from '@/components/IndexScreens';
import Shell, { goHash, useHash } from '@/components/Shell';
import { isCaseUnlocked, useProgress } from '@/hooks/useProgress';
import { useQuality } from '@/hooks/useQuality';
import { useTour } from '@/hooks/useTour';
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
  const requested = HINTS[hash] ? hash : 'lote';
  const tour = useTour({ where: 'index', tab: requested });
  // Una pestaña que el recorrido todavía no mostró no se abre: se queda en la del paso.
  const tab = tour.tabLocked(requested) ? (tour.step?.tab ?? 'sesion') : requested;

  // Cada paso del recorrido abre su pestaña.
  const stepTab = tour.here ? tour.step.tab : null;
  useEffect(() => {
    if (stepTab) goHash(stepTab);
  }, [stepTab, tour.index]);

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
    <Shell active={tab} hints={HINTS[tab]} tour={tour}>
      {tab === 'sesion' ? <Desk {...shared} onSignOut={signOut} canOpen={tour.reached('abrir')} /> : null}
      {tab === 'lote' ? <Lot {...shared} canOpen={tour.reached('abrir')} /> : null}
      {tab === 'registro' ? <Log {...shared} /> : null}
      {tab === 'barrera' ? <Barrier {...shared} /> : null}
      {tab === 'protocolo' ? <Protocol {...shared} /> : null}
      {tab === 'formularios' ? (
        <Forms
          {...shared}
          settings={settings}
          setSettings={setSettings}
          quality={quality}
          onSignOut={signOut}
          onReset={resetRun}
          onTour={() => {
            tour.restart();
            router.push('/');
          }}
        />
      ) : null}
      {tab === 'ayuda' ? <Help /> : null}
    </Shell>
  );
}
