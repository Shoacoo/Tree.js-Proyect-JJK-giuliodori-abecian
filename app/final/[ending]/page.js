import { notFound } from 'next/navigation';
import EndingActions, { OperatorSignature } from '@/components/EndingActions';
import Shell, { ScreenHead, Tag } from '@/components/Shell';
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

// El final es el documento que queda en el sistema: un informe en papel o una resolución en rojo.
export default async function EndingPage({ params }) {
  const { ending } = await params;
  const data = getEnding(ending);
  if (!data) notFound();
  const doc = data.document;
  return (
    <Shell hints="[N] Nueva partida  [C] Créditos">
      <ScreenHead eyebrow={doc.eyebrow} />
      <div className="ending-layout">
        <article className={`doc ${doc.signed ? 'panel--paper' : 'panel--red'}`}>
          <header className="doc__head">
            <span>{doc.code}</span>
            <Tag tone="ink">{doc.tag}</Tag>
          </header>
          <h1 className="doc__title">{doc.heading}</h1>
          <div className="doc__lines">
            {doc.lines.map((line, i) =>
              typeof line === 'number' ? (
                <span key={i} className="redact redact--ink" style={{ width: line }} aria-label="Renglón tachado" />
              ) : (
                <p key={i}>{line}</p>
              ),
            )}
          </div>
          <div className="doc__sign">{doc.signed ? <OperatorSignature /> : <span>firma: —</span>}</div>
        </article>
        <aside className="panel anexo">
          <span className="eyebrow">
            Anexo · {data.kind} · {data.title}
          </span>
          <p>{data.summary}</p>
          <ol>
            {data.epilogue.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </aside>
      </div>
      <EndingActions />
    </Shell>
  );
}
