'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MangaArt from '@/components/MangaArt';

// Residuos cuyo panel roto ya se reconstruyó en esta visita: al releerlos sigue armado.
const mended = new Set();

// Pedazos que hay que sacar para que el resto del panel se desarme solo.
const SHARDS_TO_BREAK = 6;

// La tipografía de los paneles no trae acentos, eñe ni signos de apertura: se dibujan sobre la letra.
const MARKS = { á: 'a´', é: 'e´', í: 'i´', ó: 'o´', ú: 'u´', ñ: 'n~', ü: 'u¨', Á: 'A´', É: 'E´', Í: 'I´', Ó: 'O´', Ú: 'U´', Ñ: 'N~' };
const OPENING = { '¿': '?', '¡': '!' };

function lettered(word) {
  return [...word].map((ch, i) => {
    if (OPENING[ch]) return <span key={i} className="manga__inv">{OPENING[ch]}</span>;
    if (MARKS[ch]) return <span key={i} className="manga__acc" data-mark={MARKS[ch][1]}>{MARKS[ch][0]}</span>;
    return ch;
  });
}

/** Texto en la letra del manga. Se ve dibujado, pero el lector de pantalla recibe el original. */
function MangaText({ text }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(/(\s+)/).map((word, i) => (OPENING[word[0]] ? <span key={i} className="manga__word">{lettered(word)}</span> : <span key={i}>{lettered(word)}</span>))}
      </span>
    </>
  );
}

// Resalta la palabra oculta dentro del texto como un botón discreto.
function WithHidden({ text, hidden, found, onFind }) {
  const index = text.indexOf(hidden.word);
  if (index < 0) return <MangaText text={text} />;
  return (
    <>
      <MangaText text={text.slice(0, index)} />
      <button
        type="button"
        className={`manga__hidden${found ? ' is-found' : ''}`}
        onClick={onFind}
        aria-label={found ? `${hidden.word} (detalle registrado)` : `Examinar: ${hidden.word}`}
      >
        <span aria-hidden="true">{lettered(hidden.word)}</span>
      </button>
      <MangaText text={text.slice(index + hidden.word.length)} />
    </>
  );
}

// Vidrio roto: anillos de pedazos alrededor de un punto de impacto, en coordenadas de 0 a 100.
function buildShards(seed) {
  let a = 0;
  for (const ch of seed) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cx = 34 + rand() * 32;
  const cy = 38 + rand() * 24;
  const rays = 6;
  const angles = Array.from({ length: rays }, (_, i) => ((i + rand() * 0.5) / rays) * Math.PI * 2);
  const ring = (reach) => angles.map((angle) => [cx + Math.cos(angle) * reach * (0.8 + rand() * 0.4), cy + Math.sin(angle) * reach * (0.8 + rand() * 0.4)]);
  const inner = ring(26);
  const outer = ring(180);
  const shards = [];
  for (let i = 0; i < rays; i += 1) {
    const j = (i + 1) % rays;
    shards.push([[cx, cy], inner[i], inner[j]]);
    shards.push([inner[i], outer[i], outer[j], inner[j]]);
  }
  return shards.map((points, i) => ({
    id: i,
    points: points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    // Hacia dónde sale volando al romperse.
    dx: (points[1][0] - cx) * 0.5,
    dy: 20 + rand() * 30,
    spin: (rand() - 0.5) * 70,
  }));
}

/** El panel roto: al tocar los pedazos aparece la imagen, con información nueva del residuo. */
function BrokenPanel({ code, fragment }) {
  const shards = useMemo(() => buildShards(code), [code]);
  const [gone, setGone] = useState(() => new Set());
  const [open, setOpen] = useState(() => mended.has(code));
  const mend = () => {
    mended.add(code);
    setOpen(true);
  };
  const breakShard = (id) => {
    const next = new Set(gone).add(id);
    setGone(next);
    if (next.size >= SHARDS_TO_BREAK) mend();
  };

  return (
    <figure className={`manga__panel manga__panel--broken${open ? ' is-open' : ''}`}>
      <div className="manga__inner">
        <MangaArt scene={fragment.art} className="manga__art" />
        {open ? (
          <div className="manga__fragment" role="status">
            <span className="manga__sfx" aria-hidden="true">
              {fragment.sfx}
            </span>
            <figcaption className="manga__caption">
              <MangaText text={fragment.caption} />
            </figcaption>
            {fragment.speech ? (
              <p className="manga__speech">
                <MangaText text={fragment.speech} />
              </p>
            ) : null}
          </div>
        ) : null}
        <svg className="manga__shards" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {shards.map((shard) => {
            const broken = open || gone.has(shard.id);
            return (
              <polygon
                key={shard.id}
                points={shard.points}
                className={broken ? 'is-gone' : ''}
                style={{ '--dx': `${shard.dx}px`, '--dy': `${shard.dy}px`, '--spin': `${shard.spin}deg` }}
                vectorEffect="non-scaling-stroke"
                onPointerDown={() => !broken && breakShard(shard.id)}
                onPointerEnter={(event) => event.buttons && !broken && breakShard(shard.id)}
              />
            );
          })}
        </svg>
        {!open ? (
          <button type="button" className="manga__mend" onClick={mend}>
            Panel roto · tocá los pedazos o reconstruilo
          </button>
        ) : null}
      </div>
    </figure>
  );
}

/**
 * Flashback en una página de manga: lo que el residuo del sello muestra del pasado del dedo.
 * Cada flashback esconde un detalle; encontrarlo suma a la memoria. Abajo, un panel roto guarda
 * algo más para quien se tome el trabajo de armarlo.
 */
export default function MangaFlashback({ seal, found, onFind, onClose, inline = false }) {
  const closeRef = useRef(null);
  const { flashback } = seal;
  const code = flashback.title.replace('Residuo ', '');

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
            <div className="manga__inner">
              <MangaArt scene={panel.art} className="manga__art" />
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
            </div>
          </figure>
        ))}
        {flashback.fragment ? <BrokenPanel code={code} fragment={flashback.fragment} /> : null}
      </div>
      <p className="manga__end">…RESIDUO {code} / FIN</p>
      {found ? <p className="manga__reveal">{flashback.hidden.reveal}</p> : null}
      {seal.hint ? <p className="manga__hint">{seal.hint}</p> : null}
    </section>
  );
}
