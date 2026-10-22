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

---

## 1. Estado actual

- **Rama de trabajo: `contencion`.** Todo el proyecto está ahí. `main` conserva el boilerplate original de la cátedra (demo "SEÑAL 88") y todavía no se tocó.
- La experiencia completa funciona de punta a punta: bóveda 3D, login, tres expedientes con sus sellos y flashbacks, expediente final y los dos finales.
- `npm run lint` y `npm run build` pasan sin errores (Next.js genera 12 páginas estáticas).
- Sin variables de Firebase, todo funciona en modo local (localStorage). Con un `.env.local` válido, el progreso se guarda en Firestore.
- Falta el deploy (ver [Pendientes](#15-pendientes)).

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
- Tipografías: Zen Kaku Gothic New, IBM Plex Mono y Yuji Syuku (Google Fonts, SIL OFL).
- Three.js (MIT), Next.js (MIT), Firebase JS SDK (Apache 2.0).
- Sonido generado con Web Audio API. Texturas generadas en canvas.
- Referencias: sitio de *Requiem for a Dream* (Hi-ReS!, 2000) y *A Journal of Insomnia* (NFB, 2013).
