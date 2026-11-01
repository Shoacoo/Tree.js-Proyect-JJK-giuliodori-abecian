/** Dibujo a tinta de un panel, en public/manga. Es decorativo: lo que cuenta está en el texto. */
export default function MangaArt({ scene, className }) {
  // Un archivo estático ya optimizado: next/image no aporta nada acá.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`/manga/${scene}.webp`} alt="" aria-hidden="true" />;
}
