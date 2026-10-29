// Finales. No se eligen con un botón: dependen de la memoria (detalles ocultos encontrados
// en los flashbacks) y de la energía filtrada (sellos arrancados o retirados fuera de orden).

export const VOW_MEMORY_REQUIRED = 6;
export const VOW_LEAK_LIMIT = 3;

export const ENDINGS = {
  voto: {
    id: 'voto',
    title: 'Voto Vinculante',
    kind: 'Final verdadero',
    // El documento que queda en el sistema (pantalla "Final · Voto" del Figma).
    document: {
      eyebrow: 'Informe · 16/03/2018',
      code: 'INF-2018-0316',
      tag: 'final verdadero',
      heading: 'Sin novedades',
      lines: [
        'Control de integridad completo. Lote 2018-B3 sin observaciones.',
        'El operador no recuerda la caja B3-11 ni la orden de mantenimiento.',
        'Firmado con una letra que no reconoce.',
      ],
      signed: true,
    },
    summary:
      'Aceptaste el pacto. Olvidás todo lo que viste en la bóveda y nadie tiene nada que callar.',
    epilogue: [
      'El informe del 16/03/2018 dice: "Control de integridad sin novedades". Lo firmás vos, con una letra que no reconocés.',
      'Ya no recordás la caja B3-11, ni el emblema de tres hojas, ni la orden de mantenimiento.',
      'Tres meses después, un dedo reasignado como amuleto descansa en el patio de una secundaria de Sendai.',
    ],
  },
  ejecutado: {
    id: 'ejecutado',
    title: 'Ejecutado',
    kind: 'Final',
    document: {
      eyebrow: 'Junta de superiores · 16/03/2018',
      code: 'RES-2018-0316',
      tag: 'orden eliminada',
      heading: 'Ejecución',
      // Los números son renglones tachados (ancho en px).
      lines: ['Apertura no autorizada de sellos de grado especial.', 456, 478, 'Expediente archivado como objeto maldito en la caja B3-11.'],
      signed: false,
    },
    summary:
      'La orden que te autorizaba desapareció del registro. Para la junta, abriste sellos de grado especial sin permiso.',
    epilogue: [
      'Los residuos en tus manos prueban que fuiste vos quien abrió los sellos.',
      'Un superior firma la ejecución inmediata, sin juicio. Es el mismo que borró tu autorización.',
      'Tu expediente se archiva en el Depósito B3 como objeto maldito, en la caja B3-11.',
    ],
  },
};

export function canOfferVow(progress) {
  return progress.memory.length >= VOW_MEMORY_REQUIRED && progress.leak <= VOW_LEAK_LIMIT;
}

export function getEnding(id) {
  return ENDINGS[id] ?? null;
}
