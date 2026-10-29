import AuthPanel from '@/components/AuthPanel';
import Shell, { ScreenHead } from '@/components/Shell';

export const metadata = { title: 'Identificación' };

export default function AccessPage() {
  return (
    <Shell active="sesion" hints="[1/2/3] Método  [ENTER] Ingresar  [ESC] Volver a la bóveda">
      <ScreenHead
        eyebrow="Identificación"
        size="xl"
        title={
          <>
            Identificación
            <br />
            requerida
          </>
        }
      />
      <AuthPanel />
    </Shell>
  );
}
