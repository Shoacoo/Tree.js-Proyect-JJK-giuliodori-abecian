// Bóveda B3: punto de entrada de los módulos de la sala.
// vaultRoom: piso, paredes, puerta sellada y utilería. vaultShelf: estanterías y cajas.
// vaultTable: mesa de inspección y relicario. vaultTerminal: computadora y su interfaz.
export { ROOM, createRoom } from './vaultRoom';
export { BOX, createShelf } from './vaultShelf';
export { RELIC_SCALE, TRAY_FLOOR, createTable, createTableRelic, placeLooseOfuda } from './vaultTable';
export { SCREEN, SCREEN_TABS, createTerminal, drawTerminalScreen } from './vaultTerminal';
