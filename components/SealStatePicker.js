'use client';

import { useEffect, useState } from 'react';
import { Key, useHotkeys } from '@/components/Shell';
import { SEAL_STATES, SEAL_STATE_GUIDE } from '@/data/cases';

// Lo que se ve en el papel, para quien no puede ver la imagen.
const VISIBLE = {
  Intacto: 'El papel está parejo y los símbolos, nítidos.',
  Fisurado: 'Grietas finas cruzan el papel y el canto está deshilachado.',
  Dañado: 'El papel está partido y quemado en dos lugares y le faltan pedazos.',
};

/**
 * Planilla de control: el operador registra en qué estado estaba un sello retirado.
 * Muestra el sello desplegado (la misma textura que en 3D) y cómo se reconoce cada estado.
 * Las teclas 1, 2 y 3 eligen el estado.
 */
export default function SealStatePicker({ seal, onMark, legend, hotkeys = true }) {
  const [image, setImage] = useState(null);

  // El canvas solo existe en el navegador; el módulo de Three.js se carga recién acá.
  useEffect(() => {
    let alive = true;
    import('@/three/ofuda').then(({ ofudaImage }) => alive && setImage(ofudaImage(seal)));
    return () => {
      alive = false;
    };
  }, [seal]);

  useHotkeys(Object.fromEntries(SEAL_STATES.map((state, i) => [String(i + 1), () => onMark(state)])), hotkeys);

  return (
    <fieldset className="seal-state">
      <legend>{legend ?? `Estado del ${seal.label.toLowerCase()}:`}</legend>
      {image ? (
        // Imagen generada en un canvas (data URL): next/image no aporta nada acá.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="seal-state__img" src={image} alt={`${seal.label}, desplegado. ${VISIBLE[seal.condition] ?? ''}`} />
      ) : (
        <div className="seal-state__img" aria-hidden="true" />
      )}
      <div className="seal-state__options">
        {SEAL_STATES.map((state, i) => (
          <Key key={state} k={String(i + 1)} onClick={() => onMark(state)} title={SEAL_STATE_GUIDE[state]}>
            {state}
          </Key>
        ))}
      </div>
      <ul className="seal-state__guide">
        {SEAL_STATES.map((state) => (
          <li key={state}>
            <strong>{state}.</strong> {SEAL_STATE_GUIDE[state]}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
