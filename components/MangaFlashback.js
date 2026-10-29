'use client';

import { useEffect, useRef } from 'react';

// Resalta la palabra oculta dentro del texto como un botón discreto.
function WithHidden({ text, hidden, found, onFind }) {
  const index = text.indexOf(hidden.word);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <button
        type="button"
        className={`manga__hidden${found ? ' is-found' : ''}`}
        onClick={onFind}
        aria-label={found ? `${hidden.word} (detalle registrado)` : `Examinar: ${hidden.word}`}
      >
        {hidden.word}
      </button>
      {text.slice(index + hidden.word.length)}
    </>
  );
}

/**
 * Flashback en paneles de manga: lo que el residuo del sello muestra del pasado del dedo.
 * Cada flashback esconde un detalle; encontrarlo suma a la memoria.
 */
export default function MangaFlashback({ seal, found, onFind, onClose, inline = false }) {
  const closeRef = useRef(null);
  const { flashback } = seal;

  useEffect(() => {
    if (inline) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose]);

  return (
    <section
      className={`manga${inline ? ' manga--inline' : ''}`}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : 'true'}
      aria-label={`${flashback.title}: lectura de residuo del ${seal.label.toLowerCase()}`}
    >
      <header className="manga__head">
        <span>{flashback.title} · LECTURA DE RESIDUO</span>
        {!inline ? (
          <button ref={closeRef} type="button" className="manga__close" onClick={onClose}>
            [ESC] Cerrar
          </button>
        ) : null}
      </header>
      <div className="manga__page">
        {flashback.panels.map((panel, i) => (
          <figure key={i} className={`manga__panel manga__panel--${i % 2 ? 'b' : 'a'}`}>
            <span className="manga__sfx" aria-hidden="true">
              {panel.sfx}
            </span>
            <figcaption className="manga__caption">
              <WithHidden text={panel.caption} hidden={flashback.hidden} found={found} onFind={onFind} />
            </figcaption>
            {panel.speech ? (
              <p className="manga__speech">
                <WithHidden text={panel.speech} hidden={flashback.hidden} found={found} onFind={onFind} />
              </p>
            ) : null}
          </figure>
        ))}
      </div>
      {found ? <p className="manga__reveal">{flashback.hidden.reveal}</p> : null}
      {seal.hint ? <p className="manga__hint">{seal.hint}</p> : null}
    </section>
  );
}
