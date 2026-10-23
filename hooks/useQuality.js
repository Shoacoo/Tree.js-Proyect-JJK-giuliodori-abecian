'use client';

import { useCallback, useEffect, useState } from 'react';
import { onQualityChange, readQualityPref, resolveQuality, writeQualityPref } from '@/three/quality';

const NEXT = { auto: 'alta', alta: 'baja', baja: 'auto' };

/**
 * Preferencia de calidad gráfica (auto, alta, baja) y la calidad que se aplica.
 * Se guarda en localStorage y se comparte entre la bóveda y el relicario.
 */
export function useQuality() {
  const [state, setState] = useState({ pref: 'auto', quality: null });

  // localStorage solo existe en el cliente: se lee después del montaje.
  useEffect(() => {
    const update = () => setState({ pref: readQualityPref(), quality: resolveQuality() });
    update();
    return onQualityChange(update);
  }, []);

  const cycle = useCallback(() => writeQualityPref(NEXT[readQualityPref()]), []);

  return { ...state, cycle };
}

export function qualityLabel(pref, quality) {
  if (pref === 'auto') return quality ? `auto (${quality})` : 'auto';
  return pref;
}
