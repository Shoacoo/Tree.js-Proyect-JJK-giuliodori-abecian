import Shell, { Key, ScreenHead } from '@/components/Shell';

export const metadata = { title: 'Créditos y referencias' };

export default function CreditsPage() {
  return (
    <Shell hints="[TAB] Navegar  [ENTER] Abrir enlace">
      <ScreenHead eyebrow="Créditos · referencias" title="Créditos y referencias" />
      <div className="stack credits">
        <p className="lead">
          Proyecto académico para Programación III (UMAI), sin fines comerciales. Jujutsu Kaisen es obra de Gege Akutami,
          publicada por Shueisha. No se usa arte oficial: los sellos y la sala son geometría y texturas procedurales, y los
          modelos 3D de terceros se detallan abajo con su autor y licencia.
        </p>
        <section className="panel stack">
          <h2 className="eyebrow">Recursos</h2>
          <ul>
            <li>
              Tipografías: DM Mono y Space Grotesk en la interfaz; Zen Kaku Gothic New y Yuji Syuku en los carteles de la bóveda
              3D y la expansión de dominio (Google Fonts, licencia SIL Open Font License).
            </li>
            <li>
              3D: Three.js (MIT). Shader de aura, partículas y bóveda propios; dedo procedural con LatheGeometry como respaldo.
            </li>
            <li>
              Modelo 3D del dedo:{' '}
              <a
                href="https://sketchfab.com/3d-models/sukunas-finger-0094c76440e3447a900797ede9bad5bf"
                target="_blank"
                rel="noreferrer"
              >
                “Sukuna&apos;s finger”
              </a>{' '}
              de André Souza (
              <a href="https://sketchfab.com/asouza" target="_blank" rel="noreferrer">
                @asouza
              </a>
              ), licencia{' '}
              <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noreferrer">
                CC BY-NC-ND 4.0
              </a>
              . Se usa sin modificaciones.
            </li>
            <li>
              Santuario de la expansión de dominio:{' '}
              <a
                href="https://sketchfab.com/3d-models/malevolent-shrine-jjk-cc-df9a59de87944a65b8d77847d1008c4d"
                target="_blank"
                rel="noreferrer"
              >
                “Malevolent_shrine jjk cc”
              </a>{' '}
              de Tyo155q (
              <a href="https://sketchfab.com/Tyo155q" target="_blank" rel="noreferrer">
                @Tyo155q
              </a>
              ), licencia{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
              . Adaptado para la web: texturas reducidas a 1024 px en JPEG y sin atributos de malla que no se usan.
            </li>
            <li>
              Sukuna en la expansión de dominio:{' '}
              <a
                href="https://sketchfab.com/3d-models/sukuna-free-fire-skin-81a53ae2b8604c40843bda9490cef39e"
                target="_blank"
                rel="noreferrer"
              >
                “Sukuna Free Fire Skin”
              </a>{' '}
              de rocklee.ff (
              <a href="https://sketchfab.com/rocklee.ff123" target="_blank" rel="noreferrer">
                @rocklee.ff123
              </a>
              ), licencia{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
              . Adaptado: materiales con iluminación, brazos en otra pose y la cabeza animada en la escena.
            </li>
            <li>Sonido: generado en el navegador con Web Audio API.</li>
            <li>Inscripción de los ofuda: «kyūkyū nyoritsuryō», fórmula tradicional del onmyōdō.</li>
          </ul>
        </section>
        <section className="panel stack">
          <h2 className="eyebrow">Referencias narrativas</h2>
          <ul>
            <li>Requiem for a Dream, sitio web de la película (Hi-ReS!, 2000): la interfaz que se degrada.</li>
            <li>
              Interfaz V3.2 (Figma «Project JJK»): terminal de oficina de mediados de los 2000, grises con amarillo y rojo de
              acento.
            </li>
            <li>A Journal of Insomnia (NFB, 2013): el contexto de acceso como recurso narrativo.</li>
            <li>Jujutsu Kaisen, tomos 0 a 2: Ventanas, velos, sellos y la junta de superiores.</li>
          </ul>
        </section>
        <div className="keys">
          <Key variant="fill" href="/">
            Volver a la portada
          </Key>
          <Key href="/indice">Ir al índice</Key>
        </div>
      </div>
    </Shell>
  );
}
