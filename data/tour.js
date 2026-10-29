// Recorrido guiado de la primera partida. Va de la bóveda a la terminal, recorre cada pestaña
// del sistema y termina en el primer expediente. Cada paso muestra un cartel; hasta completarlo,
// lo que viene después queda bloqueado.
//
// where: dónde se muestra el cartel ('vault', 'index' o 'case').
// ack: el paso se completa con "Entendido". Si no, se completa solo cuando done(estado) da true.
// allow: acciones permitidas en la bóveda mientras dura el paso ("navigate:right", "box:B3-04"...).
// tab: pestaña del sistema que se abre y se desbloquea con el paso.
// target: elemento que se resalta (atributo data-tour).
// side: 'left' cuando el elemento queda a la derecha y el cartel lo taparía.

import { getCase } from '@/data/cases';

const FIRST = getCase('01');
const SHELF = 'right'; // la caja del primer expediente está en la estantería derecha
const SHELF_LABEL = 'derecha';

export const TOUR_TABS = ['sesion', 'lote', 'registro', 'barrera', 'protocolo', 'formularios', 'ayuda'];

export const TOUR = [
  {
    id: 'bienvenida',
    where: 'vault',
    title: 'Depósito B3',
    text: `Sos la Ventana asignada al mantenimiento de los sellos del lote. Este recorrido te muestra cada parte del depósito y del sistema. Hasta completar cada paso, lo que sigue queda bloqueado.`,
    ack: true,
  },
  {
    id: 'mirar',
    where: 'vault',
    title: 'Mirar la sala',
    text: 'Arrastrá para mirar alrededor y hacé click en un lugar para acercarte. Abajo a la izquierda tenés los mismos lugares como botones, por si preferís no usar el 3D.',
    ack: true,
    target: 'vault-nav',
  },
  {
    id: 'estanteria',
    where: 'vault',
    title: 'Las estanterías',
    text: `Los dedos del lote se guardan en cajas de archivo. Andá a la estantería ${SHELF_LABEL}.`,
    allow: [`navigate:${SHELF}`, 'navigate:overview'],
    target: `nav-${SHELF}`,
    done: (s) => s.view === SHELF || Boolean(s.openBox) || s.tableCaseId === FIRST.id,
  },
  {
    id: 'caja',
    where: 'vault',
    title: 'La caja del primer expediente',
    text: `Abrí la caja ${FIRST.box}. Las cajas marcadas con un punto tienen un dedo del lote; las demás, otros objetos.`,
    allow: [`navigate:${SHELF}`, 'navigate:overview', `box:${FIRST.box}`],
    target: `box-${FIRST.box}`,
    done: (s) => s.openBox === FIRST.box || s.tableCaseId === FIRST.id,
  },
  {
    id: 'mesa',
    where: 'vault',
    title: 'A la mesa de inspección',
    text: 'El dedo está envuelto entero en tiras de papel: son sus sellos. Llevalo a la mesa.',
    allow: [`carry:${FIRST.id}`, `box:${FIRST.box}`, `navigate:${SHELF}`, 'navigate:overview'],
    target: 'carry',
    done: (s) => s.tableCaseId === FIRST.id,
  },
  {
    id: 'terminal',
    where: 'vault',
    title: 'La terminal',
    text: 'Toda inspección queda registrada a tu nombre. Andá a la terminal, a la derecha de la mesa, y entrá al sistema de expedientes.',
    allow: ['navigate:*', 'activate:terminal', 'activate:login', 'activate:index*'],
    target: 'nav-terminal',
    done: (s) => s.signedIn,
  },
  {
    id: 'sesion',
    where: 'index',
    tab: 'sesion',
    title: 'Sesión',
    text: 'Tu escritorio: quién está a cargo, la orden de mantenimiento que te asignaron y dónde se guarda el progreso (en la nube o en este equipo).',
    ack: true,
    target: 'menu-sesion',
  },
  {
    id: 'lote',
    where: 'index',
    tab: 'lote',
    title: 'Lote',
    text: 'Los tres dedos del lote, cada uno con su expediente. Se inspeccionan en orden: el siguiente se abre recién cuando archivás el anterior.',
    ack: true,
    target: 'menu-lote',
  },
  {
    id: 'registro',
    where: 'index',
    tab: 'registro',
    title: 'Registro',
    text: 'Todo lo que hacés queda anotado acá con la hora: cada sello retirado, cada estado registrado y cada fuga.',
    ack: true,
    target: 'menu-registro',
  },
  {
    id: 'barrera',
    where: 'index',
    tab: 'barrera',
    title: 'Barrera',
    text: 'La barrera del depósito. Baja con cada fuga de energía maldita y con cada dedo archivado. Si se pone crítica, algo despierta.',
    ack: true,
    target: 'menu-barrera',
  },
  {
    id: 'protocolo',
    where: 'index',
    tab: 'protocolo',
    title: 'Protocolo',
    text: 'Las reglas de la inspección. La primera importa más que ninguna: los sellos se retiran en orden inverso al de colocación.',
    ack: true,
    target: 'menu-protocolo',
  },
  {
    id: 'formularios',
    where: 'index',
    tab: 'formularios',
    title: 'Formularios',
    text: 'Ajustes del equipo (sonido, efectos y calidad), los finales que ya viste y la sesión. Desde acá también podés repetir este recorrido.',
    ack: true,
    target: 'menu-formularios',
  },
  {
    id: 'ayuda',
    where: 'index',
    tab: 'ayuda',
    title: 'Ayuda',
    text: 'Los pasos de una inspección y los atajos de teclado, por si te olvidás de algo.',
    ack: true,
    target: 'menu-ayuda',
  },
  {
    id: 'abrir',
    where: 'index',
    tab: 'lote',
    title: 'Abrir el primer expediente',
    text: `Volvé al lote y abrí ${FIRST.code}.`,
    target: `case-${FIRST.id}`,
    done: (s) => s.where === 'case' && s.caseId === FIRST.id,
  },
  {
    id: 'visor',
    where: 'case',
    title: 'El visor',
    text: 'Arrastrá para girar el dedo y usá la rueda o [+] [−] para acercarte. [L] prende la luz rasante: deja ver qué tinta es fresca.',
    ack: true,
    target: 'viewport',
  },
  {
    id: 'retirar',
    where: 'case',
    title: 'Retirar un sello',
    text: 'Cada tramo de papel es un sello y se retira por separado, en orden inverso al de colocación. Leé la nota de campo para saber cuál va primero. Mantené presionado sobre el papel hasta que se despegue, o usá Retirar en la lista.',
    target: 'seals',
    done: (s) => s.peeled > 0,
  },
  {
    id: 'estado',
    where: 'case',
    title: 'Registrar el estado',
    text: 'Mirá el papel desplegado y elegí cómo estaba: intacto, fisurado o dañado. Si lo que registrás no coincide, el sello queda mal y se filtra energía.',
    target: 'seal-state',
    done: (s) => s.marked > 0,
  },
  {
    id: 'lecturas',
    where: 'case',
    title: 'Lecturas',
    text: 'Memoria: los detalles que encontraste en los residuos. Filtrado: la energía que se escapó por errores. Sellos: los que ya registraste.',
    ack: true,
    target: 'readings',
    side: 'left',
  },
  {
    id: 'archivar',
    where: 'case',
    title: 'Archivar',
    text: 'Retirá los otros sellos de la misma forma y archivá el expediente. Desde acá seguís solo.',
    ack: true,
    target: 'archive',
    side: 'left',
  },
];

export const TOUR_LENGTH = TOUR.length;
