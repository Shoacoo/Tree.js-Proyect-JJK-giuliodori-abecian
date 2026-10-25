'use client';

import { useEffect, useState } from 'react';
import { SEAL_STATES, SEAL_STATE_GUIDE } from '@/data/cases';

// Lo que se ve en el papel, para quien no puede ver la imagen.
const VISIBLE = {
  Intacto: 'El papel está parejo y el borde rojo, entero.',
  Fisurado: 'Grietas finas cruzan el papel, el borde rojo está cortado y el canto, deshilachado.',
  Dañado: 'El papel está partido y quemado en dos lugares y le faltan pedazos.',
};

/**
 * Planilla de control: el operador registra en qué estado estaba un sello retirado.
 * Muestra el sello desplegado (la misma textura que en 3D) y cómo se reconoce cada estado.
 */
export default function SealStatePicker({ seal, onMark }) {
  const [image, setImage] = useState(null);

  // El canvas solo existe en el navegador; el módulo de Three.js se carga recién acá.
  useEffect(() => {
    let alive = true;
    import('@/three/ofuda').then(({ ofudaImage }) => alive && setImage(ofudaImage(seal)));
    return () => {
      alive = false;
    };
  }, [seal]);

  return (
    <fieldset className="seal-state">
      <legend className="label">ESTADO DEL {seal.label.toUpperCase()}</legend>
      <p className="seal-state__ask">¿Cómo estaba el sello antes de retirarlo? Miralo de cerca.</p>
      {image ? (
        <img className="seal-state__img" src={image} alt={`${seal.label}, desplegado. ${VISIBLE[seal.condition] ?? ''}`} />
      ) : (
        <div className="seal-state__img" aria-hidden="true" />
      )}
      <div className="seal-state__options">
        {SEAL_STATES.map((state) => (
          <button key={state} type="button" className="seal-state__option" onClick={() => onMark(state)}>
            <strong>{state}</strong>
            <span>{SEAL_STATE_GUIDE[state]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
