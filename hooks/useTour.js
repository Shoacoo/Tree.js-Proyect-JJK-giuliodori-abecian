'use client';

import { useCallback, useEffect } from 'react';
import { TOUR, TOUR_LENGTH, TOUR_TABS } from '@/data/tour';
import { useProgress } from '@/hooks/useProgress';

const matches = (pattern, action) => pattern === action || (pattern.endsWith('*') && action.startsWith(pattern.slice(0, -1)));

/**
 * Recorrido guiado. Cada pantalla lo llama con lo que pasa en ella (where y su estado) y el
 * paso avanza solo cuando se cumple. Devuelve el paso actual y qué queda bloqueado.
 */
export function useTour(snapshot = {}) {
  const { progress, hydrated, authReady, signedIn, setTour } = useProgress();
  const index = Math.min(progress.tour ?? 0, TOUR_LENGTH);
  const step = hydrated ? (TOUR[index] ?? null) : null;
  const active = Boolean(step);
  const done = Boolean(active && authReady && step.done?.({ signedIn, ...snapshot }));

  // Un paso que ya está cumplido (por ejemplo, la sesión ya estaba abierta) pasa solo.
  useEffect(() => {
    if (done) setTour(index + 1);
  }, [done, index, setTour]);

  const next = useCallback(() => setTour(index + 1), [index, setTour]);
  const skip = useCallback(() => setTour(TOUR_LENGTH), [setTour]);
  const restart = useCallback(() => setTour(0), [setTour]);

  // Pestañas del sistema abiertas hasta este paso. Fuera del sistema, solo la de la sesión.
  const unlockedTabs = (() => {
    if (!active) return TOUR_TABS;
    const visited = TOUR.slice(0, index + 1)
      .map((s) => s.tab)
      .filter(Boolean);
    if (step.where === 'case') return TOUR_TABS;
    return visited.length ? TOUR_TABS.filter((tab) => visited.includes(tab)) : ['sesion'];
  })();

  return {
    active,
    step,
    index,
    total: TOUR_LENGTH,
    here: active && step.where === snapshot.where,
    next,
    skip,
    restart,
    reached: (id) => !active || TOUR.findIndex((s) => s.id === id) <= index,
    tabLocked: (tab) => !unlockedTabs.includes(tab),
    // Acciones de la bóveda. Si el recorrido sigue en el sistema, desde la bóveda solo se puede ir a la terminal.
    allows: (action) => {
      if (!active) return true;
      const allowed =
        step.where === 'vault'
          ? (step.allow ?? [])
          : ['navigate:*', 'activate:terminal', 'activate:login', 'activate:index*', 'activate:case*'];
      return allowed.some((pattern) => matches(pattern, action));
    },
  };
}
