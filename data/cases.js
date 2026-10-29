// Contenido narrativo de los expedientes.
// Unidades del relicario: 1 unidad de Three.js = 1 cm. El dedo se extiende sobre el eje X,
// con la base en x negativo y la uña en x positivo.

export const SETTING = {
  // Ambientación propuesta: entre la muerte de Geto (dic. 2017) y el capítulo 1 (jun. 2018).
  date: 'JUE 15/03/2018',
  time: '23:47',
  lot: 'LOTE 2018-B3',
  terminal: 'TERMINAL B3-T02',
  maintenanceOrder: 'ORDEN DE MANTENIMIENTO OM-2018-0311',
};

export const CASES = [
  {
    id: '01',
    code: 'EXP-01',
    box: 'B3-04',
    title: 'Dedo momificado',
    place: 'Santuario derrumbado, Okutama (Tokio)',
    barcode: 'B3-2011-0001-D',
    recovered: '14/03/2011 · 04:20',
    team: 'Unidad 4 (3 pers.)',
    length: 11.4,
    weight: '38 g',
    lastControl: '02/04/2016',
    report:
      'Hallado bajo el altar tras el derrumbe del santuario. La Unidad 4 colocó los sellos en el lugar: primero en la base, después en el nudillo y por último junto a la uña. Actividad residual baja. Sin víctimas registradas.',
    custody: [
      ['14/03/11', 'Unidad 4', 'Recuperación'],
      ['15/03/11', 'Depósito B3', 'Ingreso'],
      ['02/04/16', 'V. N.º 0391', 'Control'],
      ['15/03/18', 'V. N.º 0417', 'En curso'],
    ],
    // Orden correcto de retiro: inverso al de colocación.
    order: ['punta', 'nudillo', 'base'],
    seals: [
      {
        id: 'base',
        label: 'Sello de la base',
        x: -3.9,
        ink: 'seca',
        condition: 'Fisurado',
        inscription: '急急如律令',
        flashback: {
          title: 'Residuo 01-C',
          panels: [
            { sfx: 'ザァ', caption: 'Okutama, 2011. Llueve sobre un santuario que ya no tiene techo.' },
            {
              sfx: 'ゴゴ',
              caption: 'Alguien cavó bajo el altar antes que la Unidad 4.',
              speech: 'La caja estaba abierta. Y vacía de algo más.',
            },
          ],
          hidden: {
            id: 'okutama-caja',
            word: 'algo más',
            reveal: 'En el barro hay marcas de dos cajas, no de una. Solo una llegó al depósito.',
          },
        },
      },
      {
        id: 'nudillo',
        label: 'Sello del nudillo',
        x: 0.2,
        ink: 'seca',
        condition: 'Intacto',
        inscription: '封',
        flashback: {
          title: 'Residuo 01-B',
          panels: [
            { sfx: 'ポタ', caption: 'Una mujer reza en voz baja y no termina la oración.' },
            {
              sfx: '…',
              caption: 'Lleva un haori con un emblema cosido encima de otro.',
              speech: 'No lo registren. El clan se encarga.',
            },
          ],
          hidden: {
            id: 'okutama-emblema',
            word: 'emblema cosido',
            reveal: 'Debajo del parche se ve el borde de un emblema de tres hojas. No figura en ningún registro de la Unidad 4.',
          },
        },
      },
      {
        id: 'punta',
        label: 'Sello de la punta',
        x: 4.1,
        ink: 'fresca',
        condition: 'Intacto',
        inscription: '急急如律令',
        flashback: {
          title: 'Residuo 01-A',
          panels: [
            { sfx: 'ドン', caption: 'Un altar partido en dos. Huele a hierro.' },
            {
              sfx: '…',
              caption: 'La Unidad 4 sella el dedo con prisa, desde la base hacia la uña.',
              speech: '¿Seguro que era uno solo?',
            },
          ],
          hidden: {
            id: 'okutama-pregunta',
            word: 'uno solo',
            reveal: 'El informe oficial dice "un objeto". La transcripción del residuo dice que la pregunta nunca tuvo respuesta.',
          },
        },
      },
    ],
  },
  {
    id: '02',
    code: 'EXP-02',
    box: 'B3-08',
    title: 'Dedo momificado',
    place: 'Túnel ferroviario clausurado, Nagano',
    barcode: 'B3-2014-0002-D',
    recovered: '02/11/2014 · 01:12',
    team: 'Unidad 7 (2 pers.)',
    length: 11.1,
    weight: '37 g',
    lastControl: '19/06/2016',
    report:
      'Encontrado dentro de un vagón de mantenimiento abandonado. Sellado primero junto a la uña y después en la base. Dos maldiciones de grado 3 exorcizadas en el túnel, atraídas por el objeto.',
    custody: [
      ['02/11/14', 'Unidad 7', 'Recuperación'],
      ['04/11/14', 'Depósito B3', 'Ingreso'],
      ['19/06/16', 'V. N.º 0391', 'Control'],
      ['15/03/18', 'V. N.º 0417', 'En curso'],
    ],
    order: ['base', 'punta'],
    seals: [
      {
        id: 'base',
        label: 'Sello de la base',
        x: -3.6,
        ink: 'fresca',
        condition: 'Intacto',
        inscription: '封',
        flashback: {
          title: 'Residuo 02-B',
          panels: [
            { sfx: 'ガタン', caption: 'Un vagón que no se mueve hace veinte años vibra igual.' },
            {
              sfx: 'ズズ',
              caption: 'Las maldiciones no buscan a la gente del túnel. Buscan el dedo.',
              speech: 'Huelen a Sukuna como un perro huele carne.',
            },
          ],
          hidden: {
            id: 'nagano-vagon',
            word: 'veinte años',
            reveal: 'El vagón pertenece a una empresa ferroviaria liquidada en 1998. El acta de liquidación la firma el mismo clan del emblema de tres hojas.',
          },
        },
      },
      {
        id: 'punta',
        label: 'Sello de la punta',
        x: 3.8,
        ink: 'seca',
        condition: 'Dañado',
        inscription: '急急如律令',
        flashback: {
          title: 'Residuo 02-A',
          panels: [
            { sfx: 'シン', caption: 'Una Ventana anota todo en una libreta mojada.' },
            {
              sfx: '…',
              caption: 'En la libreta hay un número de caja tachado: B3-11.',
              speech: 'Esto no va al registro central.',
            },
          ],
          hidden: {
            id: 'nagano-b311',
            word: 'B3-11',
            reveal: 'La caja B3-11 es el hueco vacío de la estantería. Según el sistema, nunca se usó.',
          },
        },
      },
    ],
  },
  {
    id: '03',
    code: 'EXP-03',
    box: 'B3-13',
    title: 'Dedo momificado',
    place: 'Depósito portuario, Yokohama',
    barcode: 'B3-2016-0003-D',
    recovered: '30/07/2016 · 02:05',
    team: 'Unidad 2',
    length: 11.9,
    weight: '38 g',
    lastControl: 'Sin registro',
    report:
      'Hallado dentro de un contenedor sellado desde el interior. Los cuatro sellos estaban intactos. Orden de colocación: no registrado. Actividad residual alta, no estable.',
    custody: [
      ['30/07/16', 'Unidad 2', 'Recuperación'],
      ['31/07/16', 'Depósito B3', 'Ingreso'],
      ['15/03/18', 'V. N.º 0417', 'En curso'],
    ],
    // Sin orden documentado: la tinta fresca y los residuos indican cuál se colocó último.
    order: ['nudillo', 'medio', 'punta', 'base'],
    seals: [
      {
        id: 'base',
        label: 'Sello de la base',
        x: -4.3,
        ink: 'seca',
        condition: 'Fisurado',
        inscription: '封',
        flashback: {
          title: 'Residuo 03-D',
          panels: [
            { sfx: 'ギィ', caption: 'Un contenedor cerrado desde adentro. Adentro no hay nadie.' },
            {
              sfx: '…',
              caption: 'Hay una silla, una mesa y un expediente con un nombre que conocés.',
              speech: 'Ventana N.º 0391.',
            },
          ],
          hidden: {
            id: 'yokohama-0391',
            word: 'nombre que conocés',
            reveal: 'El expediente de la Ventana N.º 0391 tiene una orden de mantenimiento adjunta. Está tachada a mano.',
          },
        },
      },
      {
        id: 'medio',
        label: 'Sello medio',
        x: -1.5,
        ink: 'seca',
        condition: 'Dañado',
        hint: 'El papel del sello medio tapa el borde del sello de la punta. La punta se selló antes.',
        inscription: '急急如律令',
        flashback: {
          title: 'Residuo 03-B',
          panels: [
            { sfx: 'カツ', caption: 'Zapatos caros sobre el piso de metal.' },
            {
              sfx: '…',
              caption: 'Un hombre de la junta de superiores sella el dedo sin mirarlo.',
              speech: 'Que figure como hallazgo de la Unidad 2.',
            },
          ],
          hidden: {
            id: 'yokohama-superior',
            word: 'junta de superiores',
            reveal: 'En la manga del superior asoma el mismo emblema de tres hojas.',
          },
        },
      },
      {
        id: 'nudillo',
        label: 'Sello del nudillo',
        x: 1.2,
        ink: 'fresca',
        condition: 'Intacto',
        hint: 'Bajo la tinta fresca se ve otra capa: el sello medio se colocó justo antes que este.',
        inscription: '封',
        flashback: {
          title: 'Residuo 03-A',
          panels: [
            { sfx: 'ジジ', caption: 'El fluorescente del depósito B3. Esta misma sala.' },
            {
              sfx: '…',
              caption: 'Alguien volvió a sellar este dedo hace poco. Desde tu terminal.',
              speech: 'La próxima Ventana no va a preguntar.',
            },
          ],
          hidden: {
            id: 'yokohama-terminal',
            word: 'Desde tu terminal',
            reveal: 'El registro de la terminal B3-T02 muestra un acceso del 12/03/2018 con credenciales de la junta.',
          },
        },
      },
      {
        id: 'punta',
        label: 'Sello de la punta',
        x: 4.3,
        ink: 'seca',
        condition: 'Fisurado',
        hint: 'Solo queda el sello de la base, el primero que se colocó.',
        inscription: '急急如律令',
        flashback: {
          title: 'Residuo 03-C',
          panels: [
            { sfx: 'ゴウ', caption: 'El agua del puerto golpea el contenedor toda la noche.' },
            {
              sfx: '…',
              caption: 'Una voz que no es humana se ríe desde la uña.',
              speech: 'Te dieron permiso para abrirme. ¿Lo guardaste?',
            },
          ],
          hidden: {
            id: 'yokohama-permiso',
            word: 'permiso',
            reveal: 'La orden de mantenimiento que te asignaron no tiene copia en el archivo central.',
          },
        },
      },
    ],
  },
];

// Cajas del Depósito B3. Tres guardan los dedos del lote; la B3-11 figura vacía en el sistema.
export const VAULT_BOXES = {
  left: ['B3-07', 'B3-08', 'B3-09', 'B3-10', 'B3-11', 'B3-12', 'B3-13', 'B3-14', 'B3-15'],
  right: ['B3-01', 'B3-02', 'B3-03', 'B3-04', 'B3-05', 'B3-06'],
};
export const HIDDEN_BOX = 'B3-11';

// Estado de un sello y cómo se reconoce a simple vista (la planilla de control lo pide).
export const SEAL_STATES = ['Intacto', 'Fisurado', 'Dañado'];
export const SEAL_STATE_GUIDE = {
  Intacto: 'Papel parejo y claro, filetes enteros, símbolos nítidos.',
  Fisurado: 'Grietas finas que cruzan el papel, canto deshilachado.',
  Dañado: 'Papel partido y quemado, con pedazos que faltan: se ve el dedo por debajo.',
};

export const MEMORY_TOTAL = CASES.reduce((sum, c) => sum + c.seals.length, 0);

export function getCaseByBox(box) {
  return CASES.find((c) => c.box === box) ?? null;
}

export function getCase(id) {
  return CASES.find((c) => c.id === id) ?? null;
}

export function nextCaseId(id) {
  const index = CASES.findIndex((c) => c.id === id);
  return CASES[index + 1]?.id ?? '00';
}
