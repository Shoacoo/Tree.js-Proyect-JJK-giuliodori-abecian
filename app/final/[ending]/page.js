import Link from 'next/link';
import { notFound } from 'next/navigation';
import NewRunButton from '@/components/NewRunButton';
import { ENDINGS, getEnding } from '@/data/endings';

export function generateStaticParams() {
  return Object.keys(ENDINGS).map((ending) => ({ ending }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }) {
  const { ending } = await params;
  const data = getEnding(ending);
  return data ? { title: `Final: ${data.title}`, description: data.summary } : { title: 'Final no encontrado' };
}

export default async function EndingPage({ params }) {
  const { ending } = await params;
  const data = getEnding(ending);
  if (!data) notFound();
  return (
    <main className={`ending ending--${data.id}`}>
      <div className="label">{data.kind.toUpperCase()}</div>
      <h1 className="display display--xl">{data.title}</h1>
      <p className="lead">{data.summary}</p>
      <ol className="ending__epilogue">
        {data.epilogue.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <div className="row">
        <NewRunButton />
        <Link className="btn btn--ghost" href="/creditos">
          Créditos
        </Link>
      </div>
    </main>
  );
}
