# Contención: Expediente de una Ventana

Experiencia web transmedia inspirada en *Jujutsu Kaisen*. TP6 de Programación III (UMAI). Proyecto académico, sin fines comerciales.

**Premisa:** una Ventana del Colegio Jujutsu de Tokio entra al Depósito B3 para controlar los sellos de tres dedos de Sukuna. Mientras los abre, descubre lo que los superiores esconden en la bóveda.

Este README es también la **memoria descriptiva del proyecto**: qué se decidió, qué está hecho, cómo está armado y qué falta. Está pensado para que cualquier integrante del equipo pueda clonar el repo y seguir trabajando sin tener que preguntar.

---

## Índice

1. [Estado actual](#1-estado-actual)
2. [Inicio rápido](#2-inicio-rápido)
3. [Historia y decisiones de guion](#3-historia-y-decisiones-de-guion)
4. [Recorrido del usuario](#4-recorrido-del-usuario)
5. [Rutas](#5-rutas)
6. [Mecánica](#6-mecánica)
7. [La bóveda 3D](#7-la-bóveda-3d)
8. [Three.js: qué se usa y dónde](#8-threejs-qué-se-usa-y-dónde)
9. [Estado, datos y persistencia](#9-estado-datos-y-persistencia)
10. [Firebase](#10-firebase)
11. [Estructura del código](#11-estructura-del-código)
12. [Cumplimiento de la consigna TP6](#12-cumplimiento-de-la-consigna-tp6)
13. [Cómo extender el proyecto](#13-cómo-extender-el-proyecto)
14. [Convenciones y advertencias](#14-convenciones-y-advertencias)
15. [Pendientes](#15-pendientes)
16. [Historial de trabajo](#16-historial-de-trabajo)
17. [Créditos](#17-créditos)
- [Rama `jugika`: qué cambió](#rama-jugika-qué-cambió)

---

## 1. Estado actual

- **Rama de trabajo: `contencion`.** Todo el proyecto está ahí. `main` conserva el boilerplate original de la cátedra (demo "SEÑAL 88") y todavía no se tocó.
- La experiencia completa funciona de punta a punta: bóveda 3D, login, tres expedientes con sus sellos y flashbacks, expediente final y los dos finales.
- `npm run lint` y `npm run build` pasan sin errores (Next.js genera 12 páginas estáticas).
- Sin variables de Firebase, todo funciona en modo local (localStorage). Con un `.env.local` válido, el progreso se guarda en Firestore.
- Falta el deploy (ver [Pendientes](#15-pendientes)).
- **Rama `jugika`:** sale de `contencion` y suma la inspección dentro de la bóveda, la atmósfera que empeora con el avance, la salida para cerrar sesión y la expansión de dominio del final. Ver [Rama `jugika`: qué cambió](#rama-jugika-qué-cambió).

## Rama `jugika`: qué cambió

Resumen de todo lo que se agregó en esta rama, con los archivos involucrados. `npm run build` pasa (12 páginas estáticas). `npm run lint` no se pudo correr en la máquina donde se trabajó porque faltaba el paquete `typescript` que pide `eslint-config-next`.

### 1. Salida de emergencia: cerrar sesión
- La puerta verde de la pared izquierda de la bóveda (非常口) ahora es clickeable: se ilumina al pasar el puntero y abre un diálogo de confirmación ("Cerrar sesión" / "Quedarme", Escape o click afuera cancelan).
- Confirmar cierra la sesión de Firebase o la del operador local, vuelve la cámara al centro y avisa "Sesión cerrada". Sin sesión, la puerta indica que hay que identificarse en la terminal.
- Alternativa sin 3D: botón "Salida · cerrar sesión" en la barra "Moverse sin 3D".
- Archivos: `three/vaultRoom.js` (la puerta tiene `userData.type = 'exit'`), `components/VaultRoom3D.js`, `components/Vault.js`.

### 2. La bóveda se enturbia con el avance
- `getCorruption(progress)` en `hooks/useProgress.js` calcula un nivel de 0 a 1: cada dedo pesa igual, sube con cada sello retirado (70 % de su parte) y completa al archivarlo; el residuo (sellos arrancados, fuera de orden o mal registrados) suma hasta un 15 %.
- En la escena (`components/VaultRoom3D.js`): la niebla se cierra y se tiñe de rojo, baja y se ensucia la luz, el fluorescente parpadea más, la puerta sellada late con una luz roja (latido de ~68 ppm) y a partir de la mitad del recorrido se escapan brasas por su borde; las cajas brillan más y la cámara tiene un vaivén lento.
- Miasma: niebla roja a ras del piso hecha con un shader propio de ruido fbm deformado (`three/miasma.js`). No se dibuja mientras el nivel es 0. Capas según calidad (`three/quality.js`: 2 en alta, 1 en baja).
- Velo de bordes oscuros y rojos sobre el canvas (`.vault-canvas__veil`).
- Al volver de un expediente, la sala arranca como estaba y se oscurece en unos segundos (el último nivel visto se guarda en `sessionStorage`) y aparece un aviso según el nivel.
- Sonido: `setHumDread()` en `lib/sound.js` agrega un gruñido grave que late al zumbido.
- Con "Reducir efectos" la sala se oscurece igual pero sin latidos, parpadeos ni movimiento de cámara.

### 3. Inspección dentro de la mesa (sin cambiar de pantalla)
- Desde la mesa, "Inspeccionar de cerca" baja la cámara sobre la bandeja (vista `inspect`). Los sellos se retiran ahí: mantener presionado despega con cuidado, soltar antes arranca. Arrastrar gira el dedo; la rueda y los botones acercan; la **Lupa** de cada sello centra la cámara en él; la luz rasante delata la tinta fresca.
- Al retirar un sello se abre su residuo (flashback) y el papel queda apoyado detrás de la bandeja. Al archivar, el dedo vuelve a su caja y un aviso indica dónde está el siguiente. El dedo de la B3-11 sigue llevando a `/expediente/00`.
- Panel de inspección con todos los controles también sin 3D (`components/InspectionPanel.js`).
- Libretas a los costados de la mesa, en 3D y legibles en un panel (`components/InspectionNotes.js`): libreta del expediente y carpetas archivadas a la izquierda, planilla de control a la derecha. Pestañas: Expediente, Residuos (con las palabras ocultas), Planilla y Archivados. Las texturas de las libretas se reescriben con el progreso (`three/vaultTable.js`).
- El dedo de la mesa ya no se reconstruye en cada cambio de progreso: se arma al cambiar de dedo y los sellos retirados se animan.
- La ruta `/expediente/[id]` se mantiene (índice de la terminal) y es la ruta dinámica que pide la consigna.
- Archivos: `components/Vault.js`, `components/VaultRoom3D.js`, `three/vaultTable.js`, `three/vault.js`, `app/globals.css`.

### 4. Estado de los sellos visible
- Cada sello tiene un estado real en `data/cases.js` (`condition`): **Intacto**, **Fisurado** o **Dañado** (antes los estados eran Intacto/Debilitado/Roto). Guía de reconocimiento en `SEAL_STATE_GUIDE`.
- El papel lo muestra (`three/ofuda.js`, con semilla para que se vea igual en todos lados): intacto parejo; fisurado con grietas, borde rojo cortado y canto deshilachado; dañado partido y quemado, con pedazos que faltan (agujeros reales con `alphaTest`).
- Al registrar el estado, la planilla muestra el sello desplegado y cómo se reconoce cada estado (`components/SealStatePicker.js`, compartido con `CaseFile`).
- Registrar un estado que no coincide avisa cuál era, suma 1 de residuo y queda marcado "no coincide" en la planilla (`markSeal` en `hooks/useProgress.js`).

| Expediente | Estados reales |
| --- | --- |
| EXP-01 | base Fisurado · nudillo Intacto · punta Intacto |
| EXP-02 | base Intacto · punta Dañado |
| EXP-03 | base Fisurado · medio Dañado · nudillo Intacto · punta Fisurado |

### 5. Arreglos del dedo al inspeccionarlo
- El modelo del dedo venía marcado como semitransparente (`alphaMode: BLEND`) aunque su textura es opaca: no escribía profundidad y la mitad de atrás de los sellos se veía a través. Ahora se dibuja opaco (`three/fingerModel.js`); la malla y las texturas siguen sin modificarse.
- Al girarlo ya no atraviesa la bandeja: en cada cuadro se busca su punto más bajo (unos 700 puntos de su superficie, `three/finger.js`) y se lo deja apoyado sobre el terciopelo, como si rodara. El giro lateral se limitó para no chocar con el borde. Lo mismo en la escena del expediente (`components/Reliquary3D.js`).

### 6. Final del Voto: expansión de dominio de Sukuna
- Al tocar "Aceptar el Voto" se abre una escena a pantalla completa antes de `/final/voto` (`components/DomainExpansion.js`, montada con un portal fuera del marco de la terminal):
  1. Oscuridad con 領域展開 (dura lo necesario para cargar los modelos: entre 3,8 y 9 s).
  2. Se encienden las velas del altar y una luz entra por las fauces del santuario; Sukuna espera parado adentro con la cabeza gacha. Aparece 伏魔御廚子.
  3. Levanta la cabeza y se le encienden los ojos.
  4. Risa: la cámara se le acerca de golpe a la cara, la cabeza se sacude.
  5. Apagón: negro total, solo quedan los ojos rojos un instante. Después pasa al final.
- Escena 3D en `components/Domain3D.js`; modelos en `three/domainModels.js`; versión procedural de respaldo (santuario, cráneos, Sukuna, altar, charco y cielo) en `three/domain.js`.
- Modelos de Sketchfab (CC BY 4.0) optimizados para la web con un script propio basado en `sharp`: el santuario pasó de 50 MB a 9,5 MB (texturas a 1024 px en JPEG, sin atributos de malla que no se usan, índices de 16 bits) y Sukuna pesa 1,3 MB. A Sukuna se le cambiaron los materiales "unlit" por materiales con luz y se le bajaron los brazos; la cabeza se anima con su esqueleto.
- Los modelos se empiezan a descargar cuando aparece la oferta del Voto (`components/FinalArchive.js`).
- Sonido sintetizado con Web Audio (`createDomainAudio()` en `lib/sound.js`): drone grave, golpe al encender el altar, risa grave con formantes y eco, y corte total en el apagón.
- Controles: "Saltar escena" (o Escape) y "Silenciar"; sin sonido, la risa aparece como subtítulo. Con "Reducir efectos" no hay temblores ni parpadeos. El final queda guardado apenas se acepta.
- Para llegar al Voto: 6 o más detalles ocultos y 3 o menos de residuo al abrir el EXP-00.

### 7. Otros
- `.claude/launch.json` para levantar el servidor de desarrollo desde Claude Code.
- `yarn.lock` quedó en el repo junto a `package-lock.json`: conviene dejar uno solo antes del deploy.
- Firestore devolvió "Missing or insufficient permissions" en una sesión de prueba: revisar que `firestore.rules` esté publicado. El login anónimo también falló (revisar que el proveedor Anonymous esté habilitado).

## 2. Inicio rápido

Requiere **Node.js 20 o superior**.

```bash
git clone https://github.com/Shoacoo/Tree.js-Proyect-JJK-giuliodori-abecian.git
cd Tree.js-Proyect-JJK-giuliodori-abecian
git checkout contencion
npm install
cp .env.example .env.local   # opcional: completar con la Web App de Firebase
npm run dev                  # http://localhost:3000
```

Otros comandos:

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (también sirve para verificar que todo compila) |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint con las reglas de Next y React 19 |

> Si tu sistema operativo tiene activado "reducir movimiento", el sitio arranca con **Reducir efectos: sí** (sin parpadeos ni glitches). Se cambia con el botón de arriba a la derecha.

## 3. Historia y decisiones de guion

Todo lo que sigue ya está acordado y escrito en `data/cases.js` y `data/endings.js`.

### Ambientación

- **Fecha:** jueves 15/03/2018, 23:47. Tres meses antes del capítulo 1 del manga, así no pisa la historia de Yuji. No hay spoilers posteriores a Shibuya.
- **Lugar:** Depósito B3, subsuelo del Colegio Jujutsu de Tokio, Sala de Catalogación.
- **Protagonista:** la persona usuaria es una **Ventana** (personal de apoyo sin técnica propia), el operador **V. N.º 0417**. Llega con la **orden de mantenimiento OM-2018-0311**, que le encarga controlar los sellos del **lote 2018-B3**.
- **Por qué una Ventana:** los sellos se degradan y hay que renovarlos (un mantenimiento legal). Se lo asignan a alguien con poca energía maldita y fácil de reemplazar.

### Los dedos

| Expediente | Caja | Origen | Sellos (orden de retiro) |
| --- | --- | --- | --- |
| EXP-01 | B3-04 | Santuario derrumbado, Okutama (Tokio) | punta → nudillo → base |
| EXP-02 | B3-08 | Túnel ferroviario clausurado, Nagano | base → punta |
| EXP-03 | B3-13 | Depósito portuario, Yokohama | nudillo → medio → punta → base (sin orden documentado: hay que deducirlo) |
| EXP-00 | B3-11 | Sin registro | Aparece cuando se archivan los tres |

Al despegar cada sello, el residuo muestra un **flashback en paneles de manga** sobre el pasado de ese dedo. Los flashbacks esconden **9 detalles** (uno por sello): un emblema cosido, la caja B3-11, la Ventana anterior N.º 0391 dada de baja, la junta de superiores, el permiso que no tiene copia en el archivo central, etc.

### El encubrimiento

- Un **clan** escondió un cuarto dedo en la caja **B3-11**, que en el sistema figura vacía. Su marca es un **emblema de tres hojas** (provisorio: el clan todavía no tiene nombre ni diseño final).
- Un superior ligado a ese clan es quien emitió la orden de mantenimiento.

### Finales

- **Voto Vinculante (final verdadero, canon):** si la Ventana registró al menos **6 de 9 detalles** y el residuo en la bóveda es **3 o menos**, Sukuna le ofrece un pacto. La Ventana olvida todo y uno de los dedos termina, años después, como amuleto en una secundaria de Sendai (el punto de partida del manga).
- **Ejecutado (final malo, una trampa):** si no hay pacto o se rechaza. El superior borra la autorización (en la interfaz, la orden de mantenimiento se tacha y desaparece del registro), así la apertura de los sellos queda como no autorizada. Los residuos en las manos de la Ventana sirven de prueba y la ejecutan para eliminar la evidencia del encubrimiento.

### Ideas descartadas (y por qué)

- **Final "Recipiente" (comerse el dedo):** no es canon. Una persona común muere si come un dedo.
- **Que la energía de Sukuna "contamine" a la Ventana:** no es canon. Se reemplazó por la trampa legal del final Ejecutado.
- **Una maldición menor que entra a la bóveda:** no es canon, salvo que la manipule Kenjaku. Kenjaku queda, como mucho, como insinuación.
- **SEÑAL 88:** era solo el ejemplo del boilerplate de la cátedra. Se reemplazó entero por Contención.

## 4. Recorrido del usuario

```
Bóveda B3 (/) ──► estanterías: buscar y abrir la caja ──► "Llevar a la mesa"
      │                                                          │
      └─► terminal (a la derecha de la mesa) ──► /acceso ──► login
                                                                 │
mesa: "Inspeccionar" ──► /expediente/01 ──► 02 ──► 03 ──► /expediente/00 ──► /final/voto | /final/ejecutado
                                                                                       │
                                  "Nueva inspección" (conserva los finales desbloqueados) ◄┘
```

1. **Intro:** una tarjeta con la premisa y el botón "Entrar a la bóveda" (se recuerda por sesión).
2. **Bóveda:** la persona recorre la sala, busca los dedos en las cajas, abre la caja y lleva el dedo a la mesa.
3. **Terminal:** se identifica (anónimo, Google o email). Desde la pantalla también puede ver el lote, el registro, la barrera y el protocolo.
4. **Mesa:** "Inspeccionar" abre el expediente del dedo que está en la bandeja.
5. **Expediente:** retira los sellos en orden, lee los flashbacks, encuentra los detalles y archiva.
6. **EXP-00 y final:** con los tres archivados se habilita la B3-11. En el EXP-00 la orden se tacha sola y se decide el final.

## 5. Rutas

| Ruta | Contenido | Tipo de componente |
| --- | --- | --- |
| `/` | Bóveda B3 en 3D (entrada a la experiencia) | Server (`app/page.js`, arma la intro) + `Vault` / `VaultRoom3D` (cliente) |
| `/acceso` | Login anónimo, Google y email/contraseña | Server + `AuthPanel` (cliente) |
| `/indice` | Índice de expedientes, ajustes y registro de actividad | Server + `CaseIndex` (cliente) |
| `/expediente/[id]` | **Ruta dinámica**: `01`, `02`, `03` y `00`. Metadata por expediente | Server + `CaseFile` / `FinalArchive` (cliente) |
| `/final/[ending]` | **Ruta dinámica**: `voto` y `ejecutado` | Server + `NewRunButton` (cliente) |
| `/creditos` | Créditos y referencias | Server |

- Las rutas dinámicas usan `generateStaticParams`, `dynamicParams = false` y `generateMetadata` (en Next 16 `params` es una promesa: se hace `await params`).
- `app/loading.js` muestra el canto del velo (`VeilLoading`), `app/error.js` un error en tono institucional y `app/not-found.js` el 404.
- Los componentes con Three.js se cargan con `next/dynamic` y `ssr: false`.

## 6. Mecánica

- **Despegar un sello:** mantener presionado el ofuda en la escena 3D durante 0,9 s (`HOLD_MS` en `Reliquary3D.js`). Si se suelta antes (después de 0,16 s), el sello se **arranca**.
- **Orden:** los sellos se retiran en orden inverso al de colocación. El informe de recuperación lo dice en EXP-01 y EXP-02. En EXP-03 hay que deducirlo con la **luz rasante**, que delata la tinta fresca, y con las pistas de cada residuo.
- **Residuo en bóveda (`leak`):** +1 por cada sello arrancado y +1 por cada sello fuera de orden. Intensifica el aura, las partículas y el parpadeo del fluorescente.
- **Memoria (`memory`):** los 9 detalles ocultos en los flashbacks. Son botones dentro del panel de manga.
- **Influencia (0 a 3):** cantidad de dedos archivados. La interfaz se degrada en CSS (atributo `data-influence`): glitches, bordes rojos y manchas. En la bóveda también sube la luz roja y la pantalla de la terminal se corrompe.
- **Desbloqueo:** cada expediente se habilita al archivar el anterior. El EXP-00 aparece con los tres archivados.
- **Finales:** `canOfferVow(progress)` en `data/endings.js` (memoria ≥ 6 y residuo ≤ 3).

## 7. La bóveda 3D

Es la portada (`/`). La escena vive en `components/VaultRoom3D.js` y los objetos se construyen en `three/vault*.js`. `components/Vault.js` es la capa de interfaz: decide qué significa cada acción y a dónde navega.

### Vistas e interacción

- **Cinco vistas** (`VIEWS` en `VaultRoom3D.js`): centro, estantería izquierda, estantería derecha, mesa y terminal. La cámara pasa de una a otra con interpolación suave.
- **Arrastrar** gira la mirada dentro de límites. Un **click** acerca la cámara al objeto o interactúa con él (raycasting con prioridad a las cajas).
- **Moverse sin 3D:** una barra de botones permite hacer todo sin el canvas (accesibilidad y celular).

### Estanterías y cajas (`three/vaultShelf.js`)

- Estanterías industriales de acero pintado (parantes en L perforados, cruces de refuerzo, bulones, tablones con polvo, portaetiquetas y una hoja de inventario donde la B3-11 está tachada a mano).
- Quince cajas tipo *kiri-bako*, cada una con su propia textura (tono, manchas, rayones, goteos y desgaste distintos, según una semilla por código), herrajes de hierro, cordón *sanada-himo* con nudo, etiqueta con sello hanko y paño de seda adentro.
- Las cajas con dedos tienen ofuda sobre la tapa, una tarjeta colgante y **brillo**: luz roja interior, rendija luminosa entre caja y tapa, grietas emisivas en la madera y un halo. La intensidad depende del estado del expediente (pendiente, bloqueado, archivado o revelado) y pulsa.
- Al abrir una caja, se desliza hacia afuera, se abre la tapa y el dedo se eleva para que se vea.
- La **B3-11** no está a la vista: hay un contorno punteado y una marca limpia en el polvo. Aparece cuando se archivan los tres expedientes.
- Relleno: biblioratos, rollos *makimono* y cajas de archivo de cartón.

### Mesa de inspección (`three/vaultTable.js`)

Madera barnizada con cajón y patas ahusadas, alfombra cuadriculada en centímetros, bandeja laqueada con terciopelo, cuaderno con anotaciones, planilla en tabla con clip, lupa, pinza, pincel, sello hanko, ofudas nuevos, taza de té, lupa articulada y taburete. La lámpara colgante esmaltada tiene un cono de luz falso (malla aditiva) y polvo suspendido.

### Computadora (`three/vaultTerminal.js`)

- Escritorio metálico con cajonera, monitor CRT beige con pantalla curva, teclado con teclas individuales (`InstancedMesh`), mouse, gabinete con LED de actividad, teléfono, archivador y un panel divisorio con corcho (protocolo, calendario de marzo de 2018 con el 15 marcado, turnos donde la N.º 0391 figura de baja y la foto del emblema), reloj detenido a las 23:47 y silla.
- **La pantalla es una interfaz propia**, dibujada en canvas (`drawTerminalScreen`) y clickeable: el raycast devuelve la coordenada UV, que se convierte a píxeles del canvas y se compara con las zonas clickeables (*hotspots*) que devuelve el dibujo.
  - **F1 Sesión:** identificación requerida o ficha del operador.
  - **F2 Lote 2018-B3:** tabla con EXP-01 a 03 y la B3-11, con su estado. Un click en una fila abre el expediente.
  - **F3 Registro:** últimas entradas del registro de actividad.
  - **F4 Barrera:** osciloscopio animado y barras de residuo, influencia y detalles.
  - **F5 Protocolo:** instrucciones de inspección.
- Acciones que devuelve la pantalla: `tab:<id>`, `login`, `index` y `case:<id>`. Las resuelve `activate()` en `Vault.js`.

### Sala (`three/vaultRoom.js`)

Piso de baldosas vinílicas gastadas con el área de inspección pintada, paredes de concreto con humedad y grietas, zócalo y franja pintada, cielorraso manchado, caños con uniones y válvula, bandeja de cables, tres artefactos fluorescentes (uno por quemarse), **puerta circular de la bóveda** sellada con ofudas cruzados, cadena y candado, **shimenawa** con *shide*, ofudas pegados en las paredes, extintor, rejillas de ventilación, salida de emergencia, escalera y papeles en el piso.

### Texturas procedurales (`three/proctex.js`)

No hay imágenes externas (salvo el modelo del dedo). Todo se genera en canvas al cargar la escena: ruido de valor periódico con fbm, campos compartidos (veta, nubes y poros) que cada objeto reutiliza con otro desplazamiento, y capas de manchas, rayones, anillos de taza, óxido, grietas y suciedad en los bordes. Cada generador devuelve `map` y, según el caso, `bumpMap`, `roughnessMap` y `metalnessMap`. Con la semilla, cada objeto queda distinto.

## 8. Three.js: qué se usa y dónde

Three.js directo (r186), sin React Three Fiber.

| Técnica | Dónde |
| --- | --- |
| `WebGLRenderer`, `PerspectiveCamera`, ACES tone mapping, sombras `PCFShadowMap` | `VaultRoom3D.js`, `Reliquary3D.js` |
| `setPixelRatio(Math.min(devicePixelRatio, 2))` y `ResizeObserver` | ambos componentes 3D |
| Bucle con `requestAnimationFrame` y `THREE.Timer` (`Clock` está deprecado en r186) | ambos |
| Raycasting: cajas, mesa, terminal, UV de la pantalla, sellos | `VaultRoom3D.js`, `Reliquary3D.js` |
| Luces: `HemisphereLight`, `PointLight` (fluorescente, cajas, pantalla), `SpotLight` (lámpara, estanterías), luz rasante `DirectionalLight` | escenas |
| Geometrías: `LatheGeometry`, `TubeGeometry`, `ShapeGeometry`, `InstancedMesh`, geometrías unidas con `mergeGeometries` | `three/*` |
| **Modelo glTF:** `GLTFLoader` con respaldo procedural | `three/fingerModel.js` |
| **Recursos propios:** shader de aura (fresnel + ruido), partículas con shader, texturas procedurales | `auraShader.js`, `particles.js`, `proctex.js` |
| `CanvasTexture` dinámica (pantalla de la terminal y ofudas) | `vaultTerminal.js`, `ofuda.js` |
| Sellos que se adaptan al modelo: envolvente convexa de la sección y UV por longitud de arco | `fingerModel.js` (`fitBandToProfile`) |
| `dispose()` de geometrías, materiales, texturas y renderer al desmontar, y `forceContextLoss()` | ambos componentes 3D |

**Patrón React + Three:** la escena se crea una sola vez en un `useEffect` vacío. Los props cambiantes se copian a un objeto `live` (un `useRef`) que el bucle lee en cada cuadro, así React no recrea la escena. Para cambios puntuales (por ejemplo, el dedo de la mesa) hay funciones en `live.current` (`sync`, `setTable`).

## 9. Estado, datos y persistencia

### Datos (`data/`)

- `cases.js`: `SETTING` (fecha, lote, orden), `CASES` (cada expediente con `id`, `code`, `box`, `title`, `place`, `length`, `order`, cadena de custodia y `seals`; cada sello tiene `id`, `label`, `x` en cm, `ink` seca o fresca, `inscription`, `hint` y `flashback` con `panels` y `hidden`), `VAULT_BOXES`, `HIDDEN_BOX`, `MEMORY_TOTAL`, `getCase`, `getCaseByBox` y `nextCaseId`.
- `endings.js`: `ENDINGS`, `VOW_MEMORY_REQUIRED = 6`, `VOW_LEAK_LIMIT = 3`, `canOfferVow` y `getEnding`.

### Estado (`hooks/useProgress.js`)

`ProgressProvider` envuelve toda la app (en `app/layout.js`) y `useProgress()` expone:

- `progress`: `{ cases, leak, memory, log, decisions, ending, endingsUnlocked }`.
- `hydrated`, `authReady`, `user`, `signedIn`, `operator`, `persistence` (`'nube' | 'local' | 'offline'`), `firebaseEnabled` e `influence`.
- `settings` y `setSettings` (`reduceEffects`, `sound`).
- Acciones: `peelSeal`, `markSeal`, `findMemory`, `archiveCase`, `decide`, `finish`, `resetRun` y `auth` (anónimo, Google, email, salir).
- `isCaseUnlocked(progress, id)`.

El progreso se guarda siempre en localStorage (`contencion:progress:v1`). Con sesión de Firebase, también se sincroniza en Firestore (con escritura diferida). El indicador del encabezado (`PersistenceBadge`) muestra el estado real: **ARCHIVO CENTRAL**, **REGISTRO LOCAL** o **SIN ENLACE**.

En la bóveda, `sessionStorage` recuerda si ya se pasó la intro (`contencion:entered`) y qué dedo quedó sobre la mesa (`contencion:table`).

## 10. Firebase

1. Crear un proyecto y una Web App en Firebase Console.
2. Habilitar **Anonymous**, **Google** y **Email/Password** en Authentication (y agregar el dominio del deploy en "Dominios autorizados").
3. Crear la base de Cloud Firestore y publicar `firestore.rules`.
4. Copiar `.env.example` a `.env.local`, completarlo y reiniciar el servidor.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Configuración de la Web App |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de Authentication |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Proyecto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

**Modelo en Firestore:**

- `users/{uid}`: perfil (`userId`, `email`, `displayName`, `photoURL`, `isAnonymous`, `authProvider`, `lastLoginAt`).
- `progress/{uid}`: `userId`, `cases`, `leak`, `memory`, `log`, `decisions`, `ending`, `endingsUnlocked` y `updatedAt`.

**Reglas:** cada usuario solo lee y escribe su propio documento, y en cada escritura se exige `userId == request.auth.uid`.

> Los archivos `.env*` están en `.gitignore`. Nunca subir las claves al repo.

## 11. Estructura del código

```
app/
  layout.js               fuentes (next/font), metadata global, ProgressProvider
  page.js                 portada: intro + <Vault />
  acceso/ indice/ creditos/
  expediente/[id]/        ruta dinámica de expedientes (01, 02, 03, 00)
  final/[ending]/         ruta dinámica de finales (voto, ejecutado)
  loading.js error.js not-found.js
  globals.css             estilos, degradación por influencia, bóveda, responsive
components/
  Vault.js                interfaz de la bóveda: HUD, tarjetas, navegación sin 3D, acciones
  VaultRoom3D.js          escena de la bóveda (cámara, luces, raycasting, animaciones)
  Reliquary3D.js          escena del dedo en cada expediente (sellos, luz rasante, aura)
  CaseFile.js             expediente: informe, controles sin 3D, archivo
  MangaFlashback.js       paneles de manga con detalles ocultos
  FinalArchive.js         EXP-00: la orden se tacha, oferta del pacto
  CaseIndex.js AuthPanel.js Terminal.js NewRunButton.js VeilLoading.js
three/
  vault.js                punto de entrada (reexporta los módulos de la sala)
  vaultRoom.js            sala: piso, paredes, puerta sellada, caños, utilería
  vaultShelf.js           estanterías, cajas, brillo de los dedos, relleno
  vaultTable.js           mesa de inspección, lámpara y relicario de la mesa
  vaultTerminal.js        computadora e interfaz de la pantalla
  proctex.js              texturas procedurales
  fonts.js                nombres reales de las fuentes de next/font para el canvas
  fingerModel.js          carga del .glb y ajuste de los sellos al modelo
  finger.js               dedo procedural (respaldo)
  ofuda.js auraShader.js particles.js scenery.js
data/                     cases.js, endings.js
hooks/useProgress.js      estado narrativo y persistencia local/remota
lib/                      firebase.js, sound.js (Web Audio)
public/models/            sukuna-finger.glb y su licencia
firestore.rules
```

> `GUIA-THREEJS.md` es la guía del boilerplate original. Explica `ThreeArtifact.js`, un componente que ya no existe, pero los conceptos siguen sirviendo.

## 12. Cumplimiento de la consigna TP6

| Requisito | Cómo se cumple |
| --- | --- |
| Next.js App Router | `app/` con layout, rutas estáticas y dinámicas |
| Ruta dinámica | `/expediente/[id]` y `/final/[ending]` |
| Server y Client Components | páginas Server; escenas, auth y progreso en cliente (`'use client'`) |
| Metadata | `metadata` global y por página; `generateMetadata` en rutas dinámicas |
| Estados de carga y error | `loading.js`, `error.js`, `not-found.js` |
| Three.js directo | sin R3F, en `components/*3D.js` y `three/` |
| Interacción con raycasting | cajas, mesa, terminal (UV de la pantalla), sellos |
| Límite de pixel ratio | `Math.min(devicePixelRatio, 2)` |
| Liberar recursos | `dispose()` completo y `forceContextLoss()` |
| Recurso propio | shader de aura, partículas con shader, texturas procedurales, interfaz en canvas |
| Firebase Auth | anónimo, Google, email/contraseña |
| Firestore por usuario con reglas | `progress/{uid}`, `users/{uid}`, `firestore.rules` |
| Indicador real de persistencia | `PersistenceBadge` (nube, local, offline) |
| Accesibilidad | controles sin 3D, flashbacks en DOM con foco y Escape, "Reducir efectos", sonido apagado por defecto, `prefers-reduced-motion` |
| Responsive | media queries a 1180 px y 760 px; FOV más abierto en vertical |
| Documentación | este README y los créditos |

## 13. Cómo extender el proyecto

- **Cambiar textos, pistas o flashbacks:** todo está en `data/cases.js`. Un sello nuevo necesita `id`, `x` (posición en cm sobre el dedo, entre −L/2 y L/2), `ink`, `inscription` y `flashback.hidden` con un `id` único. Actualizar también `order`.
- **Agregar un expediente:** sumarlo a `CASES` con una `box` libre de `VAULT_BOXES` y agregar el `id` a `generateStaticParams` (se toma de `CASES`). La caja muestra el dedo y brilla sola, porque `getCaseByBox` la reconoce.
- **Nueva pestaña en la terminal:** agregarla a `SCREEN_TABS` y escribir su función de dibujo en `vaultTerminal.js`. Para que algo sea clickeable, se empuja `{ x, y, w, h, action }` a `hotspots`, y la acción se resuelve en `activate()` de `Vault.js`.
- **Nueva vista de cámara:** agregarla a `VIEWS` en `VaultRoom3D.js` y a la barra "Moverse sin 3D" en `Vault.js`.
- **Nueva textura:** agregar un generador en `proctex.js` que devuelva `{ map, bumpMap, roughnessMap }`. Conviene reutilizar `grainField`, `cloudField` y `poreField` con `drawField` en lugar de recorrer píxeles.
- **Texto en canvas:** usar `font('mono' | 'sans' | 'brush', tamaño, peso)` de `three/fonts.js`. `next/font` registra las fuentes con nombres generados y el canvas no las encuentra por su nombre.

## 14. Convenciones y advertencias

- **Next.js 16 no es el Next que conocés:** cambian APIs y convenciones (por ejemplo, `params` asíncrono). Antes de tocar rutas, leer la guía en `node_modules/next/dist/docs/` (lo indica `AGENTS.md`).
- **React 19 + eslint-config-next:** las reglas `react-hooks` son estrictas (sin `setState` sincrónico en efectos, sin leer refs durante el render, sin memoización manual innecesaria). Correr `npm run lint` antes de subir.
- **Three r186:** `THREE.Clock` está deprecado (se usa `THREE.Timer`) y `PCFSoftShadowMap` ya no existe (se usa `PCFShadowMap`).
- **Todo lo que se crea, se libera:** cualquier geometría, material o textura nueva tiene que quedar dentro de la escena para que la recorra `disposeObject`.
- **Modelo del dedo:** la licencia CC BY-NC-ND no permite modificarlo. Se puede escalar, iluminar y poner sellos encima, pero no editar la malla ni las texturas (tampoco achicarlas). Pesa unos 18 MB.
- **Rendimiento:** las texturas se generan al cargar la bóveda (alrededor de un segundo en una GPU común). Si hace falta aligerar, bajar la resolución de los generadores en `proctex.js`.
- **Ramas:** trabajar en `contencion` o en ramas que salgan de ella y abrir PR. No subir nada a `main` sin acordarlo, ni usar `push --force`.
- **No correr `npm audit fix --force`:** baja `eslint-config-next` a la versión 14 y rompe el lint. Las 5 alertas que marca `npm audit` son de herramientas de desarrollo (`braces`, vía ESLint): `npm audit --omit=dev` da 0 vulnerabilidades en lo que llega al sitio.
- Los textos del sitio están en español rioplatense (voseo).

## 15. Pendientes

- [ ] **Deploy** (Vercel u otro). Cargar las variables de Firebase en el hosting y agregar el dominio en Authentication.
- [ ] Verificar el login con Google y la sincronización en Firestore con el `.env` real del equipo.
- [ ] Confirmar la fecha (marzo de 2018) y el emblema del clan (hoy es un provisorio de "tres hojas"). Definir el nombre del clan.
- [ ] Probar la bóveda en celulares y en computadoras con GPU modesta (fluidez y tiempo de carga).
- [ ] Revisar si hace falta una pantalla de carga con progreso mientras baja el modelo de 18 MB.
- [ ] Cuando esté aprobado, unir `contencion` en `main` con un PR.

## 16. Historial de trabajo

| Commit | Qué se hizo |
| --- | --- |
| `82973fb` | Se reemplaza la demo SEÑAL 88 por Contención: rutas, expedientes, flashbacks, mecánica de sellos, finales y Firebase |
| `02bced8` | Bóveda B3 en 3D como entrada: estanterías, mesa y terminal |
| `7be88e4` | Carga del modelo del dedo de Sketchfab con `GLTFLoader` (respaldo procedural) y créditos |
| `342ad2a` | Se agrega el modelo `public/models/sukuna-finger.glb` (sin modificar) |
| `318ebde`, `7c9884d` | Sellos ofuda ajustados a la forma real del modelo, sin estirar la textura |
| `528486d` | Mejora visual de la bóveda: texturas procedurales, cajas y estanterías detalladas, brillo de los dedos, mesa, sala y terminal con interfaz clickeable |

Antes de programar se hizo un análisis del prototipo 2D (errores y propuestas), que llevó a las decisiones de la sección 3.

## 17. Créditos

- *Jujutsu Kaisen* © Gege Akutami / Shueisha. No se usa arte oficial.
- Modelo del dedo: ["Sukuna's finger"](https://sketchfab.com/3d-models/sukunas-finger-0094c76440e3447a900797ede9bad5bf) de André Souza ([@asouza](https://sketchfab.com/asouza)), licencia [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Se usa sin modificar la malla ni las texturas (ver `public/models/sukuna-finger-LICENSE.txt`).
- Santuario de la expansión de dominio: ["Malevolent_shrine jjk cc"](https://sketchfab.com/3d-models/malevolent-shrine-jjk-cc-df9a59de87944a65b8d77847d1008c4d) de Tyo155q ([@Tyo155q](https://sketchfab.com/Tyo155q)), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptado: texturas reducidas y atributos sin uso eliminados (ver `public/models/malevolent-shrine-LICENSE.txt`).
- Sukuna de la expansión de dominio: ["Sukuna Free Fire Skin"](https://sketchfab.com/3d-models/sukuna-free-fire-skin-81a53ae2b8604c40843bda9490cef39e) de rocklee.ff ([@rocklee.ff123](https://sketchfab.com/rocklee.ff123)), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptado: materiales con luz, otra pose de brazos y cabeza animada (ver `public/models/sukuna-LICENSE.txt`). Es una skin del juego Free Fire: el diseño original probablemente sea de Garena.
- Tipografías: Zen Kaku Gothic New, IBM Plex Mono y Yuji Syuku (Google Fonts, SIL OFL).
- Three.js (MIT), Next.js (MIT), Firebase JS SDK (Apache 2.0).
- Sonido generado con Web Audio API. Texturas generadas en canvas.
- Referencias: sitio de *Requiem for a Dream* (Hi-ReS!, 2000) y *A Journal of Insomnia* (NFB, 2013).
