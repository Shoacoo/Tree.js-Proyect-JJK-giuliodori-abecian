import { notFound } from 'next/navigation';
import CaseFile from '@/components/CaseFile';
import FinalArchive from '@/components/FinalArchive';
import { CASES, getCase } from '@/data/cases';

// Ruta dinámica: /expediente/01, /02, /03 y /00 (el archivo que aparece al final).
export function generateStaticParams() {
  return [...CASES.map((c) => ({ id: c.id })), { id: '00' }];
}

export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (id === '00') return { title: 'EXP-00 · Caja B3-11', description: 'Un expediente que no figura en el registro central.' };
  const data = getCase(id);
  if (!data) return { title: 'Expediente no encontrado' };
  return {
    title: `${data.code} · ${data.place}`,
    description: `Control de integridad de ${data.seals.length} sellos ofuda sobre un dedo de Sukuna recuperado en ${data.place}.`,
  };
}

export default async function CasePage({ params }) {
  const { id } = await params;
  if (id === '00') return <FinalArchive />;
  if (!getCase(id)) notFound();
  return <CaseFile caseId={id} />;
}
