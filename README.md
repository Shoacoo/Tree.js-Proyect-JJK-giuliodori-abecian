# Contención: Expediente de una Ventana

Experiencia web transmedia inspirada en *Jujutsu Kaisen*. TP6, Programación III (UMAI). Proyecto académico, sin fines comerciales.

**Premisa:** una Ventana del Colegio Jujutsu de Tokio abre los sellos de tres dedos de Sukuna y descubre lo que los superiores esconden en el Depósito B3.

## Sinopsis

Marzo de 2018, tres meses antes del capítulo 1. La persona usuaria es una Ventana (personal de apoyo, sin técnica propia) asignada por una orden de mantenimiento al Depósito B3. Su tarea es controlar la integridad de los sellos de tres dedos de Sukuna. Al despegar cada ofuda, el residuo del sello muestra un flashback en paneles de manga sobre el pasado de ese dedo. Los flashbacks esconden detalles: un emblema de tres hojas, una caja que no figura en ningún registro, una Ventana anterior que fue dada de baja.

Al archivar los tres dedos aparece el EXP-00: la caja B3-11, que guardaba un cuarto dedo escondido por un clan. En ese momento la orden de mantenimiento desaparece del registro y la apertura de los sellos pasa a figurar como no autorizada.

## Recorrido

```
/  ->  /acceso  ->  /indice  ->  /expediente/01  ->  /expediente/02  ->  /expediente/03  ->  /expediente/00  ->  /final/[ending]
                     ^                                                                                         |
                     +----------------------------- Nueva inspección (conserva los finales) <-------------------+
```

| Ruta | Contenido | Componentes |
| --- | --- | --- |
| `/` | Bóveda B3 en 3D: estanterías con cajas, mesa de inspección y terminal. Premisa en la intro | Server + `Vault` / `VaultRoom3D` (cliente) |
| `/acceso` | Login anónimo, Google y email/contraseña | Server + `AuthPanel` (cliente) |
| `/indice` | Índice de expedientes, ajustes y registro de actividad | `CaseIndex` (cliente: depende del progreso) |
| `/expediente/[id]` | Ruta dinámica: 01, 02, 03 y 00. Metadata por expediente | Server + `CaseFile` / `FinalArchive` (cliente) |
| `/final/[ending]` | Ruta dinámica: `voto` y `ejecutado` | Server + `NewRunButton` (cliente) |
| `/creditos` | Créditos y referencias | Server |

Estados de carga (`loading.js`, el canto del velo), error (`error.js`) y 404 (`not-found.js`) en tono institucional.

## Bóveda B3

La experiencia empieza dentro del depósito. La persona usuaria recorre la sala (arrastrar para mirar, click para acercarse), busca los dedos en las cajas de las estanterías (B3-04, B3-08 y B3-13), abre la caja y lleva el dedo a la mesa de inspección. A la derecha de la mesa está la terminal B3-T02: ahí se identifica y accede al índice. Inspeccionar el dedo sobre la mesa abre su expediente. La caja B3-11 figura vacía hasta archivar los tres dedos. La pantalla de la terminal es una interfaz propia, dibujada en canvas y clickeable por raycasting (coordenadas UV): sesión, lote 2018-B3 con el estado de cada expediente, registro de actividad, monitor de la barrera y protocolo. Todo se puede hacer también con los botones "Moverse sin 3D".

La sala usa texturas procedurales generadas en canvas (`three/proctex.js`): madera de cada caja con manchas, rayones y desgaste propios, acero pintado con saltaduras y óxido, concreto con humedad y grietas, baldosas gastadas, papel envejecido. Las cajas con dedos tienen luz interior, grietas emisivas y una rendija que brilla según el estado del expediente.

## Mecánica

- **Coleccionables:** los tres dedos (expedientes archivados) y nueve detalles ocultos en los flashbacks.
- **Desbloqueo:** cada expediente se habilita al archivar el anterior; el EXP-00 aparece con los tres archivados.
- **Despegar un sello:** mantener presionado el ofuda en la escena 3D. Soltar antes lo **arranca**. Los sellos se retiran en orden inverso al de colocación (el informe lo dice; en el EXP-03 hay que deducirlo con la luz rasante, que delata la tinta fresca, y con las pistas de cada residuo).
- **Residuo en bóveda:** sube con cada sello arrancado o retirado fuera de orden. Intensifica el aura, las partículas y el parpadeo del fluorescente.
- **Influencia (0 a 3):** dedos archivados. La interfaz se degrada en CSS: glitches, bordes rojos, manchas.
- **Finales:**
  - **Voto Vinculante** (verdadero): con al menos 6 de 9 detalles y residuo 3 o menos, Sukuna ofrece un pacto. El operador olvida todo y un dedo termina como amuleto en una secundaria de Sendai.
  - **Ejecutado:** si no hay pacto o se rechaza. Un superior ligado al clan borra la autorización, los residuos en las manos del operador sirven de prueba y lo ejecutan para eliminar la evidencia.

## Three.js

`components/VaultRoom3D.js` (la sala, `three/vault.js`) y `components/Reliquary3D.js` (el dedo de cada expediente) usan Three.js directo (sin React Three Fiber):

- Escena, `PerspectiveCamera` y `WebGLRenderer` con sombras y tone mapping.
- Geometrías: dedo procedural con `LatheGeometry` deformada con ruido (`three/finger.js`), bandas ofuda (`CylinderGeometry` con `CanvasTexture`), bandeja, mesa y regla en escala real (1 unidad = 1 cm).
- Luces: `SpotLight` cenital de 3200 K, `HemisphereLight`, `PointLight` roja del aura y luz rasante de inspección.
- Recursos propios: shader de aura (`three/auraShader.js`), sistema de partículas con shader (`three/particles.js`) y texturas generadas en canvas.
- Interacción: raycasting para elegir cajas, mesa y terminal, hover y mantener presionado, arrastre para girar, rueda y botones para zoom.
- `requestAnimationFrame`, `ResizeObserver` para adaptar el canvas, `setPixelRatio(Math.min(devicePixelRatio, 2))` y `dispose()` de geometrías, materiales, texturas y renderer al desmontar.

## Accesibilidad

- **Controles sin 3D:** cada sello se puede retirar con un botón, y la luz rasante tiene su equivalente en texto.
- Flashbacks en DOM, con foco al abrir y cierre con Escape; los detalles ocultos son botones.
- "Reducir efectos" desactiva glitches y animaciones (se activa solo si el sistema pide movimiento reducido). Sonido apagado por defecto.

## Firebase

- Authentication: anónima, Google y email/contraseña.
- Firestore: `users/{uid}` (perfil) y `progress/{uid}` con `userId`, `cases`, `leak`, `memory`, `log`, `decisions`, `ending`, `endingsUnlocked` y `updatedAt`.
- `firestore.rules` solo deja leer y escribir el documento propio, y exige `userId == request.auth.uid`.
- El indicador del header muestra siempre el estado real: **ARCHIVO CENTRAL** (nube), **REGISTRO LOCAL** (localStorage) o **SIN ENLACE** (offline). Sin variables de entorno, todo funciona en modo local.

## Instalación

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # completar con la Web App de Firebase
npm run dev
```

1. Crear un proyecto y una Web App en Firebase Console.
2. Habilitar **Anonymous**, **Google** y **Email/Password** en Authentication.
3. Crear la base de Cloud Firestore y publicar `firestore.rules`.
4. Completar `.env.local` y reiniciar el servidor.

### Variables de entorno

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Configuración de la Web App |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de Authentication |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Proyecto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |

## Estructura

```
app/                    rutas (App Router), layout, loading, error, not-found
components/             Vault, VaultRoom3D, Terminal, CaseIndex, CaseFile, Reliquary3D, MangaFlashback, FinalArchive, AuthPanel
three/                  vault (vaultRoom, vaultShelf, vaultTable, vaultTerminal), proctex, fonts, fingerModel, finger, ofuda, auraShader, particles, scenery
data/                   cases.js (expedientes, sellos, flashbacks), endings.js
hooks/useProgress.js    estado narrativo y persistencia local/remota
lib/                    firebase.js, sound.js (Web Audio)
firestore.rules
```

## Créditos

- *Jujutsu Kaisen* © Gege Akutami / Shueisha. No se usa arte oficial.
- Tipografías: Zen Kaku Gothic New, IBM Plex Mono, Yuji Syuku (Google Fonts, SIL OFL).
- Modelo del dedo: ["Sukuna's finger"](https://sketchfab.com/3d-models/sukunas-finger-0094c76440e3447a900797ede9bad5bf) de André Souza (@asouza), [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Se usa sin modificar la malla ni las texturas (`public/models/sukuna-finger.glb`, cargado con `GLTFLoader` en `three/fingerModel.js`; si falta, queda el dedo procedural).
- Three.js (MIT), Next.js (MIT), Firebase JS SDK (Apache 2.0).
- Sonido generado con Web Audio API.
- Referencias: sitio de *Requiem for a Dream* (Hi-ReS!, 2000), *A Journal of Insomnia* (NFB, 2013).

## Deploy

Pendiente.
