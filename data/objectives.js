import { CASES, MEMORY_TOTAL } from '@/data/cases';

/**
 * Lo que muestra el tablón de la bóveda: qué hay que hacer, cómo viene cada dedo y qué detalles
 * se encontraron. La B3-11 no se anota hasta que aparece, y las palabras ocultas de los residuos
 * quedan en blanco hasta que se encuentran: el tablón no adelanta nada.
 */
export function getObjectives(progress, signedIn) {
  const cases = CASES.map((c, i) => {
    const state = progress.cases[c.id];
    const seals = state?.seals ?? {};
    return {
      id: c.id,
      code: c.code,
      box: c.box,
      archived: Boolean(state?.archived),
      unlocked: i === 0 || Boolean(progress.cases[CASES[i - 1].id]?.archived),
      peeled: c.seals.filter((s) => seals[s.id]?.peeled).length,
      marked: c.seals.filter((s) => seals[s.id]?.state).length,
      total: c.seals.length,
      details: c.seals.map((s) => ({
        id: s.flashback.hidden.id,
        word: s.flashback.hidden.word,
        found: progress.memory.includes(s.flashback.hidden.id),
      })),
    };
  });
  const allArchived = cases.every((c) => c.archived);

  const objectives = [
    { id: 'login', text: 'Identificarse en la terminal', done: signedIn },
    ...cases.map((c) => ({
      id: c.id,
      text: `${c.code}: controlar y archivar`,
      detail: c.unlocked ? `Caja ${c.box} · sellos retirados ${c.peeled}/${c.total} · verificados ${c.marked}/${c.total}` : `Caja ${c.box} · espera al expediente anterior`,
      done: c.archived,
      locked: !c.unlocked,
    })),
    ...(allArchived ? [{ id: 'b311', text: 'Revisar la caja B3-11', detail: 'Figuraba vacía. Estantería izquierda', done: Boolean(progress.ending) }] : []),
  ];

  return {
    objectives,
    current: objectives.find((o) => !o.done && !o.locked) ?? null,
    cases,
    found: progress.memory.length,
    total: MEMORY_TOTAL,
    archived: cases.filter((c) => c.archived).length,
    leak: progress.leak ?? 0,
  };
}
