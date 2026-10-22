import { IBM_Plex_Mono, Yuji_Syuku, Zen_Kaku_Gothic_New } from 'next/font/google';
import { ProgressProvider } from '@/hooks/useProgress';
import './globals.css';

const zen = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-zen', display: 'swap' });
const plex = IBM_Plex_Mono({ weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-plex', display: 'swap' });
const yuji = Yuji_Syuku({ weight: '400', subsets: ['latin'], variable: '--font-yuji', display: 'swap' });

export const metadata = {
  title: {
    default: 'Contención: Expediente de una Ventana',
    template: '%s · Contención',
  },
  description:
    'Una Ventana del Colegio Jujutsu de Tokio abre los sellos de tres dedos de Sukuna y descubre lo que los superiores esconden en el Depósito B3. Proyecto académico, Programación III (UMAI).',
  applicationName: 'Contención',
  openGraph: {
    title: 'Contención: Expediente de una Ventana',
    description: 'Experiencia web transmedia inspirada en Jujutsu Kaisen. Proyecto académico sin fines comerciales.',
    locale: 'es_AR',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#17140F',
};

// Server Component: estructura y metadata. El estado de la partida vive en un Client Component (ProgressProvider).
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${zen.variable} ${plex.variable} ${yuji.variable}`}>
      <body>
        <ProgressProvider>{children}</ProgressProvider>
      </body>
    </html>
  );
}
