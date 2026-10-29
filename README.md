# Contención: Expediente de una Ventana

Experiencia web transmedia inspirada en *Jujutsu Kaisen*. TP6 de Programación III (UMAI). Proyecto académico, sin fines comerciales.

**Premisa:** una Ventana del Colegio Jujutsu de Tokio entra al Depósito B3 para controlar los sellos de tres dedos de Sukuna. Mientras los abre, descubre lo que los superiores esconden en la bóveda.

Este README es también la **memoria descriptiva del proyecto**: qué se decidió, qué está hecho, cómo está armado y qué falta. Está pensado para que cualquier integrante del equipo pueda clonar el repo y seguir trabajando sin tener que preguntar.

---

## Índice

1. [Estado actual](#1-estado-actual)
2. [Inicio rápido](#2-inicio-rápido)
3. [Novedades de la última etapa (rama `Shoacoo`)](#3-novedades-de-la-última-etapa-rama-shoacoo)
4. [Historia y decisiones de guion](#4-historia-y-decisiones-de-guion)
5. [Recorrido del usuario](#5-recorrido-del-usuario)
6. [Rutas](#6-rutas)
7. [Mecánica](#7-mecánica)
8. [La bóveda 3D](#8-la-bóveda-3d)
   - [La interfaz CustodiaOS (V3.2)](#la-interfaz-custodiaos-v32)
9. [El final del Voto: expansión de dominio](#9-el-final-del-voto-expansión-de-dominio)
10. [Three.js: qué se usa y dónde](#10-threejs-qué-se-usa-y-dónde)
11. [Estado, datos y persistencia](#11-estado-datos-y-persistencia)
12. [Firebase](#12-firebase)
13. [Modelos 3D](#13-modelos-3d)
14. [Estructura del código](#14-estructura-del-código)
15. [Cumplimiento de la consigna TP6](#15-cumplimiento-de-la-consigna-tp6)
16. [Cómo extender el proyecto](#16-cómo-extender-el-proyecto)
17. [Convenciones y advertencias](#17-convenciones-y-advertencias)
18. [Pendientes](#18-pendientes)
19. [Historial de trabajo](#19-historial-de-trabajo)
20. [Créditos](#20-créditos)

---

## 1. Estado actual

- **Rama principal: `main`.** Tiene el proyecto completo y al día.
- Otras ramas:
  - `Shoacoo`: donde se hizo la última etapa (interfaz V3.2, sello envolvente, recorrido guiado). Quedó igual que `main`.
  - `jugika`: la etapa anterior (inspección en la mesa y expansión de dominio).
  - `contencion`: el estado anterior a `jugika`.
  - `backup-senal88`: el boilerplate original de la cátedra (demo "SEÑAL 88"), por si hace falta consultarlo.
- La experiencia completa funciona de punta a punta: bóveda 3D, recorrido guiado, login, inspección de los tres dedos, sellos con flashbacks, expediente final, expansión de dominio y los dos finales.
- `npm run build` y `npm run lint` pasan sin errores (Next.js genera 12 páginas estáticas).
- **Aviso de Next.js 16.4.0:** la versión instalada tiene una vulnerabilidad conocida. `npm run dev` y `npm run build` muestran el aviso y la primera vez se cortan: hay que volver a correr el comando. La actualización (`next upgrade`) está pendiente.
- Sin variables de Firebase, todo funciona en modo local (localStorage). Con un `.env.local` válido, el progreso se guarda en Firestore, **pero hoy las reglas del proyecto de Firebase están vencidas** (ver [Firebase](#12-firebase)).
- Falta el deploy (ver [Pendientes](#18-pendientes)).

## 2. Inicio rápido

Requiere **Node.js 20 o superior**.

```bash
git clone https://github.com/Shoacoo/Tree.js-Proyect-JJK-giuliodori-abecian.git
cd Tree.js-Proyect-JJK-giuliodori-abecian
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
| `node scripts/build-domain-models.cjs . <fuentes>` | Regenera los modelos de la expansión de dominio (ver [Modelos 3D](#13-modelos-3d)) |

> Si tu sistema operativo tiene activado "reducir movimiento", el sitio arranca con **Reducir efectos: sí** (sin parpadeos ni glitches). Se cambia con el botón de arriba a la derecha.

**Para probar rápido sin Firebase:** si no hay `.env.local`, en `/acceso` alcanza con escribir un nombre de operador. Para llegar al final del Voto hay que conseguir 6 detalles ocultos o más con 3 de residuo o menos (la resolución completa está en la [sección 7](#7-mecánica)).

## 3. Novedades de la última etapa (rama `Shoacoo`)

Resumen para ponerse al día. Cada punto está explicado en detalle en su sección.

| Qué | Dónde se explica | Archivos principales |
| --- | --- | --- |
| **Interfaz nueva, versión V3.2 del Figma ("CustodiaOS"):** sistema burocrático de oficina en grises, con rojo y amarillo como acento, DM Mono y Space Grotesk, menú lateral, barra de estado y atajos de teclado. Sin kanji en la interfaz. | [La interfaz CustodiaOS](#la-interfaz-custodiaos-v32) | `components/Shell.js`, `components/IndexScreens.js`, `app/globals.css`, `lib/readings.js` |
| **El sistema tiene 7 pestañas:** sesión, lote, registro, barrera, protocolo, formularios y ayuda. La pantalla de la computadora de la bóveda se redibujó igual que en el Figma. | [Computadora](#computadora-threevaultterminaljs) | `components/CaseIndex.js`, `three/vaultTerminal.js` |
| **Se arranca en la bóveda:** la portada es una tarjeta de bienvenida sobre la sala 3D. Al sistema se entra desde la computadora de la bóveda. | [5. Recorrido](#5-recorrido-del-usuario) | `components/Vault.js`, `app/page.js` |
| **Recorrido guiado de la primera partida:** 19 carteles; lo que todavía no se explicó queda bloqueado. | [5. Recorrido](#5-recorrido-del-usuario) | `data/tour.js`, `hooks/useTour.js`, `components/TourCard.js` |
| **Sello como en el anime:** el dedo va envuelto entero en tiras de papel con símbolos. Cada sello es un tramo y se retira por separado. Los ofudas de cajas y paredes imitan papel real envejecido. | [7. Mecánica](#7-mecánica) | `three/ofuda.js`, `three/fingerModel.js` |
| **Sin WebGL la página no se cae:** si el navegador bloquea el 3D, aparece un aviso con salida al sistema. Una pérdida de contexto baja la calidad automática. | [10. Three.js](#detalles-de-implementación-que-conviene-conocer) | `three/renderer.js`, `components/Vault.js` |

### Etapa anterior (rama `jugika`)

| Qué | Dónde se explica | Archivos principales |
| --- | --- | --- |
| **La inspección se hace en la mesa de la bóveda.** El dedo se analiza ahí: se gira, se acerca con lupa, se retiran los sellos y se archiva, sin cambiar de pantalla. | [8. Mesa e inspección](#mesa-de-inspección-y-vista-de-cerca) | `components/Vault.js`, `components/VaultRoom3D.js`, `components/InspectionPanel.js`, `three/vaultTable.js` |
| **Libretas a los costados de la mesa:** expediente, residuos leídos, planilla de control y expedientes archivados, para leer y cruzar pistas. | [8. Libretas](#libretas-de-la-mesa) | `components/InspectionNotes.js`, `three/vaultTable.js` |
| **Los sellos muestran su estado real** (Intacto, Fisurado, Dañado) y registrarlo mal tiene consecuencias. | [7. Mecánica](#7-mecánica) | `data/cases.js`, `three/ofuda.js`, `components/SealStatePicker.js`, `hooks/useProgress.js` |
| **La bóveda se enturbia a medida que se avanza:** niebla roja, luz que baja, latido, miasma en el piso, sonido. | [8. Atmósfera](#atmósfera-según-el-avance) | `hooks/useProgress.js` (`getCorruption`), `components/VaultRoom3D.js`, `three/miasma.js`, `lib/sound.js` |
| **Salida de emergencia para cerrar sesión**, con confirmación. | [8. Salida](#salida-de-emergencia-cerrar-sesión) | `three/vaultRoom.js`, `components/Vault.js` |
| **La cámara de la terminal se acerca de frente a la pantalla** para que el menú se lea. | [8. Computadora](#computadora-threevaultterminaljs) | `components/VaultRoom3D.js` (`VIEWS.terminal`) |
| **Final del Voto con la expansión de dominio de Sukuna**, con modelos de Sketchfab, sonido sintetizado y respaldo procedural. | [9. Expansión de dominio](#9-el-final-del-voto-expansión-de-dominio) | `components/DomainExpansion.js`, `components/Domain3D.js`, `three/domainModels.js`, `three/domain.js` |
| **Arreglos del dedo:** ya no se ven los sellos a través del dedo y al girarlo no atraviesa la bandeja. | [10. Three.js](#detalles-de-implementación-que-conviene-conocer) | `three/fingerModel.js`, `three/finger.js`, `components/Reliquary3D.js` |

## 4. Historia y decisiones de guion

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

- **Voto Vinculante (final verdadero, canon):** si la Ventana registró al menos **6 de 9 detalles** y el residuo en la bóveda es **3 o menos**, Sukuna le ofrece un pacto. Al aceptarlo, la Ventana entra en la **expansión de dominio de Sukuna** (ver [sección 9](#9-el-final-del-voto-expansión-de-dominio)). Después olvida todo y uno de los dedos termina, años después, como amuleto en una secundaria de Sendai (el punto de partida del manga).
- **Ejecutado (final malo, una trampa):** si no hay pacto o se rechaza. El superior borra la autorización (en la interfaz, la orden de mantenimiento se tacha y desaparece del registro), así la apertura de los sellos queda como no autorizada. Los residuos en las manos de la Ventana sirven de prueba y la ejecutan para eliminar la evidencia del encubrimiento.

### Ideas descartadas (y por qué)

- **Final "Recipiente" (comerse el dedo):** no es canon. Una persona común muere si come un dedo.
- **Que la energía de Sukuna "contamine" a la Ventana:** no es canon. Se reemplazó por la trampa legal del final Ejecutado. Lo que sí se agregó es que la **bóveda** se enturbia a medida que se abren los sellos: es el ambiente, no la persona.
- **Una maldición menor que entra a la bóveda:** no es canon, salvo que la manipule Kenjaku. Kenjaku queda, como mucho, como insinuación.
- **SEÑAL 88:** era solo el ejemplo del boilerplate de la cátedra. Se reemplazó entero por Contención.

## 5. Recorrido del usuario

```
Bóveda B3 (/) ──► estanterías: buscar y abrir la caja ──► "Llevar a la mesa"
      │                                                          │
      └─► terminal (a la derecha de la mesa) ──► /acceso ──► login
                                                                 │
mesa ──► "Inspeccionar de cerca": sellos, residuos, planilla ──► archivar ──► siguiente dedo
                                                                 │
              con los tres archivados ──► caja B3-11 ──► /expediente/00
                                                                 │
                     Voto aceptado ──► expansión de dominio ──► /final/voto
                     sin Voto o rechazado ─────────────────────► /final/ejecutado
                                                                 │
                     "Nueva inspección" (conserva los finales desbloqueados)
```

1. **Intro:** una tarjeta de bienvenida sobre la bóveda 3D, con la premisa y las teclas [ENTER] Entrar, [S] Sonido, [R] Efectos y [C] Créditos (se recuerda por sesión).
2. **Bóveda:** la persona recorre la sala, busca los dedos en las cajas, abre la caja y lleva el dedo a la mesa.
3. **Terminal:** en la computadora de la bóveda se identifica (anónimo, Google o email) y entra al sistema de expedientes (`/indice`), con sus 7 pestañas. La misma pantalla se puede usar dentro del 3D.
4. **Mesa:** "Inspeccionar de cerca" baja la cámara sobre la bandeja. Ahí retira los sellos en orden, lee cada residuo, registra el estado del sello y consulta las libretas. Al archivar, el dedo vuelve a su caja y un aviso dice dónde está el siguiente.
5. **La bóveda cambia:** con cada sello y cada dedo archivado la sala se oscurece y se tiñe de rojo; al volver de otra pantalla se nota el cambio y aparece un aviso.
6. **EXP-00 y final:** con los tres archivados aparece la B3-11. Su dedo lleva al EXP-00, donde la orden se tacha sola y se decide el final.

> La pantalla `/expediente/[id]` de cada dedo sigue existiendo (se llega desde el lote del sistema) y tiene la misma mecánica que la mesa de la bóveda.

### Recorrido guiado

La primera partida es un **recorrido guiado**: 19 carteles con una explicación breve de cada parte, en un orden fijo.

| Dónde | Pasos |
| --- | --- |
| Bóveda | bienvenida, mirar la sala, ir a la estantería derecha, abrir la caja B3-04, llevar el dedo a la mesa, ir a la terminal y entrar |
| Sistema | sesión, lote, registro, barrera, protocolo, formularios, ayuda y abrir EXP-01 |
| Expediente | visor, retirar un sello, registrar su estado, lecturas y archivar |

- Hasta completar cada paso, **lo que viene después queda bloqueado**: los botones y clicks en 3D de la bóveda (aparece un aviso), las pestañas del menú (marcadas "bloq."), la apertura de expedientes y el retiro de sellos.
- Los pasos de explicación se cierran con **[ENTER] Entendido**. Los de acción avanzan solos cuando se hacen (abrir la caja, identificarse, retirar un sello…). El elemento del paso se resalta en amarillo (atributo `data-tour`).
- El paso se guarda en el progreso (`progress.tour`), así que se retoma donde quedó y se sincroniza con Firestore. "Nueva inspección" no lo reinicia.
- Se puede **saltar** desde el cartel y **repetir** desde Formularios ([T] Repetir el recorrido).
- Archivos: `data/tour.js` (los pasos: texto, qué se permite y cuándo se completa), `hooks/useTour.js` (estado y bloqueos) y `components/TourCard.js` (el cartel). Cada pantalla llama a `useTour()` con lo que pasa en ella.

## 6. Rutas

| Ruta | Contenido | Tipo de componente |
| --- | --- | --- |
| `/` | Bóveda B3 en 3D: exploración, inspección en la mesa, libretas, terminal | Server (`app/page.js`, arma la intro) + `Vault` / `VaultRoom3D` (cliente) |
| `/acceso` | Login anónimo, Google y email/contraseña | Server + `AuthPanel` (cliente) |
| `/indice` | Sistema de expedientes con 7 pestañas en el hash (`/indice#registro`): sesión, lote, registro, barrera, protocolo, formularios y ayuda | Server + `CaseIndex` / `IndexScreens` (cliente) |
| `/expediente/[id]` | **Ruta dinámica**: `01`, `02`, `03` y `00`. Metadata por expediente. `00` es el expediente final con la expansión de dominio | Server + `CaseFile` / `FinalArchive` (cliente) |
| `/final/[ending]` | **Ruta dinámica**: `voto` y `ejecutado`, como documento oficial con su anexo | Server + `EndingActions` (cliente) |
| `/creditos` | Créditos y referencias (incluye los modelos de Sketchfab) | Server |

- Las rutas dinámicas usan `generateStaticParams`, `dynamicParams = false` y `generateMetadata` (en Next 16 `params` es una promesa: se hace `await params`).
- `app/loading.js` muestra el canto del velo (`VeilLoading`), `app/error.js` un error en tono institucional y `app/not-found.js` el 404.
- Los componentes con Three.js se cargan con `next/dynamic` y `ssr: false`.
- Todas las pantallas fuera de la bóveda usan el mismo marco (`components/Shell.js`): menú lateral, contenido y barra de estado.

## 7. Mecánica

- **El dedo va envuelto entero** en tiras de papel cruzadas con símbolos en tinta, como en el anime. Cada sello es un **tramo** del dedo (los tramos se reparten el largo según la posición `x` de cada sello y se cortan en diagonal), así que juntos cubren todo el dedo y se sacan por partes.
- **Despegar un sello:** mantener presionado el papel de su tramo durante 0,9 s (`HOLD_MS`). Si se suelta antes (después de 0,16 s), el sello se **arranca**. Se mide el tiempo real, así funciona igual con pocos cuadros por segundo. Todos los sellos tienen también un botón "Retirar" (sin 3D).
- **Orden:** los sellos se retiran en orden inverso al de colocación. El informe de recuperación lo dice en EXP-01 y EXP-02. En EXP-03 hay que deducirlo con la **luz rasante**, que delata la tinta fresca, y con las pistas de cada residuo.
- **Estado de cada sello:** cada sello tiene un estado real (`condition` en `data/cases.js`) que se ve en el papel:
  - **Intacto:** papel parejo y claro, filetes enteros, símbolos nítidos.
  - **Fisurado:** grietas finas que cruzan el papel, canto deshilachado.
  - **Dañado:** papel partido y quemado, con pedazos que faltan (se ve el dedo por debajo).
  
  Después de retirar un sello, la planilla pide registrar en qué estado estaba ([1] Intacto, [2] Fisurado, [3] Dañado) y muestra la tira desplegada junto con la guía. Si el estado registrado no coincide, avisa cuál era y suma 1 de residuo.
- **Residuo en bóveda (`leak`):** +1 por cada sello arrancado, +1 por cada sello fuera de orden y +1 por cada estado mal registrado. Intensifica el aura, las partículas y la corrupción de la sala.
- **Memoria (`memory`):** los 9 detalles ocultos en los flashbacks. Son palabras con un subrayado punteado sutil dentro del panel de manga; tocarlas las registra.
- **Influencia (0 a 3):** cantidad de dedos archivados. La interfaz se degrada en CSS (atributo `data-influence`): glitches, bordes rojos y manchas. La pantalla de la terminal también se corrompe.
- **Corrupción (0 a 1):** `getCorruption(progress)`. Cada dedo pesa igual: suma con cada sello retirado y completa al archivarlo; el residuo agrega hasta un 15 %. Maneja la atmósfera de la bóveda (ver [sección 8](#atmósfera-según-el-avance)).
- **Desbloqueo:** cada expediente se habilita al archivar el anterior. La B3-11 y el EXP-00 aparecen con los tres archivados.
- **Finales:** `canOfferVow(progress)` en `data/endings.js` (memoria ≥ 6 y residuo ≤ 3).

### Resolución completa (spoiler, para probar)

| Expediente | Orden de retiro | Estado real de cada sello | Palabras ocultas |
| --- | --- | --- | --- |
| EXP-01 | punta → nudillo → base | punta Intacto · nudillo Intacto · base Fisurado | "uno solo", "emblema cosido", "algo más" |
| EXP-02 | base → punta | base Intacto · punta Dañado | "veinte años", "B3-11" |
| EXP-03 | nudillo → medio → punta → base | nudillo Intacto · medio Dañado · punta Fisurado · base Fisurado | "Desde tu terminal", "junta de superiores", "permiso", "nombre que conocés" |

## 8. La bóveda 3D

Es la portada (`/`). La escena vive en `components/VaultRoom3D.js` y los objetos se construyen en `three/vault*.js`. `components/Vault.js` es la capa de interfaz: decide qué significa cada acción y a dónde navega.

### Vistas e interacción

- **Seis vistas** (`VIEWS` en `VaultRoom3D.js`): centro, estantería izquierda, estantería derecha, mesa, **inspección de cerca** (`inspect`) y terminal. La cámara pasa de una a otra con interpolación suave.
- **Arrastrar** gira la mirada dentro de límites (en la vista `inspect`, gira el dedo). Un **click** acerca la cámara al objeto o interactúa con él (raycasting con prioridad a cajas, sellos y libretas).
- **Moverse sin 3D:** una barra de botones permite hacer todo sin el canvas (accesibilidad y celular). Incluye "Inspección de cerca" y "Salida · cerrar sesión" cuando corresponde.

### Estanterías y cajas (`three/vaultShelf.js`)

- Estanterías industriales de acero pintado (parantes en L perforados, cruces de refuerzo, bulones, tablones con polvo, portaetiquetas y una hoja de inventario donde la B3-11 está tachada a mano).
- Quince cajas tipo *kiri-bako*, cada una con su propia textura (tono, manchas, rayones, goteos y desgaste distintos, según una semilla por código), herrajes de hierro, cordón *sanada-himo* con nudo, etiqueta con sello hanko y paño de seda adentro.
- Las cajas con dedos tienen ofuda sobre la tapa, una tarjeta colgante y **brillo**: luz roja interior, rendija luminosa entre caja y tapa, grietas emisivas en la madera y un halo. La intensidad depende del estado del expediente (pendiente, bloqueado, archivado o revelado) y pulsa.
- Al abrir una caja, se desliza hacia afuera, se abre la tapa y el dedo se eleva para que se vea.
- La **B3-11** no está a la vista: hay un contorno punteado y una marca limpia en el polvo. Aparece cuando se archivan los tres expedientes.

### Mesa de inspección y vista de cerca

- Mesa de madera barnizada (`three/vaultTable.js`) con alfombra cuadriculada, bandeja laqueada con terciopelo, lupa, pinza, pincel, sello hanko, ofudas nuevos, taza de té, lupa articulada, taburete y lámpara colgante con cono de luz falso.
- **"Inspeccionar de cerca"** (vista `inspect`) baja la cámara sobre la bandeja. En pantallas anchas el dedo se corre a la izquierda para no quedar tapado por el panel; en vertical, la cámara se aleja y el dedo queda arriba del panel.
- En la mesa se puede:
  - **Girar el dedo** arrastrando, para ver el otro lado de los sellos. El dedo **rueda apoyado sobre el terciopelo**: nunca atraviesa la bandeja.
  - **Acercar** con la rueda (hacia el sello que está bajo el puntero) o con los botones; la **Lupa** de cada sello centra la cámara en él.
  - **Luz rasante:** la tinta fresca brilla apenas.
  - **Retirar sellos:** el sello sube, gira, se desvanece y queda apoyado detrás de la bandeja. Se abre su residuo (flashback) y después la planilla para registrar el estado.
  - **Archivar:** el dedo vuelve a su caja y un aviso indica dónde está el siguiente.
- El panel de la derecha (`components/InspectionPanel.js`) tiene todos los controles también sin 3D.
- El dedo de la mesa se arma solo al cambiar de dedo; los sellos que se retiran después se animan (no se reconstruye en cada cambio de progreso).

### Libretas de la mesa

- A la izquierda: la **libreta del expediente** (abierta, con datos, custodia e informe del dedo que está en la bandeja) y las **carpetas de los expedientes archivados**. A la derecha: la **planilla de control** con un renglón por sello y una referencia impresa de los estados.
- Sus textos se dibujan en canvas y se reescriben con el progreso (solo cuando algo cambia).
- Al tocarlas (o con los botones "Libreta", "Planilla", "Archivados") se abre un panel de lectura (`components/InspectionNotes.js`) con pestañas: **Expediente**, **Residuos** (los paneles leídos, con las palabras ocultas para encontrar), **Planilla** (estado de cada sello, "no coincide" si se registró mal y guía de reconocimiento) y **Archivados** (informe y residuos de los dedos ya archivados, para cruzar pistas).

### Atmósfera según el avance

Con la corrupción (0 a 1) la sala se vuelve más turbia, de forma gradual:

- La niebla se cierra y se tiñe de rojo; la luz ambiente baja y se enrojece; el fluorescente alumbra menos y parpadea más.
- La puerta sellada late con una luz roja (un latido de ~68 por minuto) y, pasada la mitad del recorrido, se escapan brasas por su borde.
- **Miasma:** niebla roja a ras del piso con un shader propio de ruido fbm deformado (`three/miasma.js`). No se dibuja mientras la corrupción es 0. Usa 2 capas en calidad alta y 1 en baja.
- Velo de bordes oscuros y rojos sobre el canvas (`.vault-canvas__veil`), cámara con un vaivén lento y cajas que brillan más.
- **Sonido:** si está activado, `setHumDread()` agrega al zumbido un gruñido grave que late.
- Al volver de otra pantalla, la sala arranca como estaba y se oscurece en unos segundos (el último nivel visto se guarda en `sessionStorage`), con un aviso según el nivel.
- Con "Reducir efectos" la sala se oscurece igual, pero sin latidos, parpadeos ni movimiento de cámara.

### Salida de emergencia: cerrar sesión

- La puerta verde de la pared izquierda (非常口) se ilumina al pasar el puntero y, al tocarla, pide confirmación ("Cerrar sesión" / "Quedarme"; Escape o click afuera cancelan).
- Confirmar cierra la sesión de Firebase o la del operador local, vuelve la cámara al centro y avisa "Sesión cerrada". Sin sesión, la puerta indica que hay que identificarse en la terminal.

### Computadora (`three/vaultTerminal.js`)

- Escritorio metálico con cajonera, monitor CRT beige con pantalla curva, teclado con teclas individuales (`InstancedMesh`), mouse, gabinete con LED de actividad, teléfono, archivador y un panel divisorio con corcho (protocolo, calendario de marzo de 2018 con el 15 marcado, turnos donde la N.º 0391 figura de baja y la foto del emblema), reloj detenido a las 23:47 y silla.
- La vista de la terminal deja la cámara **de frente a la pantalla, a unos 42 cm**, corrida para que la tarjeta de la esquina no la tape. El giro con el puntero está acotado para no salirse de la pantalla.
- **La pantalla es una interfaz propia**, dibujada en canvas (`drawTerminalScreen`) y clickeable: el raycast devuelve la coordenada UV, que se convierte a píxeles del canvas y se compara con las zonas clickeables (*hotspots*) que devuelve el dibujo.
  - Tiene el mismo diseño que la interfaz web (V3.2), dibujado 1:1 con el frame de 1024 × 768 del Figma: menú lateral con las 7 pestañas, contenido y barra de estado.
  - **Sesión:** identificación requerida o escritorio del operador. **Lote:** tabla con EXP-01 a 03 y la B3-11 y el detalle de la fila. **Registro**, **Barrera** (porcentaje, medidor de 30 celdas y lecturas), **Protocolo**, **Formularios** y **Ayuda**.
  - Se redibuja dos veces por segundo, sin `shadowBlur` (el brillo es un halo en capas, más liviano para la GPU).
- Acciones que devuelve la pantalla: `tab:<id>`, `login#…`, `index`, `index:<pestaña>`, `case:<id>` y `exit`. Las resuelve `activate()` en `Vault.js`.

### La interfaz CustodiaOS (V3.2)

Diseño en el Figma del equipo, página "Interfaz v3.2 · Tipografía amigable". Ambientación: un sistema de oficina burocrático, sobrio, nada "anime".

- **Colores** (`:root` en `app/globals.css`): tinta `#141415`, fondo `#262628`, marco `#3A3A3C`, papel `#EDEDEB`, claro `#C6C6C8`, amarillo `#D9AE3A` y rojo `#B8322A`. Predominan los grises; rojo y amarillo son acento. **Sin kanji ni letras japonesas en la interfaz.**
- **Tipografías:** DM Mono para el texto y Space Grotesk para títulos y números. Paneles con radio de 6 px, teclas y etiquetas de 2 px, y líneas de escaneo suaves.
- **Componentes** (`components/Shell.js`): `Shell` (marco), `Key` (tecla "[ENTER] Ingresar", que puede ser botón o link), `Tag`, `Cells` (medidor de cuadraditos), `ScreenHead`, `PersistenceBadge`, `useHotkeys` (atajos que no se disparan mientras se escribe) y `useHash` / `goHash` (pestañas del sistema en el hash).
- **Pantallas del sistema:** `components/IndexScreens.js` (Desk, Lot, Log, Barrier, Protocol, Forms, Help). Las lecturas compartidas con la pantalla 3D (barrera, registro, nombre del operador) están en `lib/readings.js`.
- Responsive: el marco se reacomoda a 1100, 900 y 640 px.

### Sala (`three/vaultRoom.js`)

Piso de baldosas vinílicas gastadas con el área de inspección pintada, paredes de concreto con humedad y grietas, zócalo y franja pintada, cielorraso manchado, caños con uniones y válvula, bandeja de cables, tres artefactos fluorescentes (uno por quemarse), **puerta circular de la bóveda** sellada con ofudas cruzados, cadena y candado, **shimenawa** con *shide*, ofudas pegados en las paredes, extintor, rejillas de ventilación, salida de emergencia, escalera y papeles en el piso.

### Texturas procedurales (`three/proctex.js`)

No hay imágenes externas en la bóveda (salvo el modelo del dedo). Todo se genera en canvas al cargar la escena: ruido de valor periódico con fbm, campos compartidos (veta, nubes y poros) que cada objeto reutiliza con otro desplazamiento, y capas de manchas, rayones, anillos de taza, óxido, grietas y suciedad en los bordes. Cada generador devuelve `map` y, según el caso, `bumpMap`, `roughnessMap` y `metalnessMap`. Con la semilla, cada objeto queda distinto. Los ofudas (`three/ofuda.js`) también tienen semilla, así un sello se ve igual en la mesa, en la escena del expediente y en la planilla.

## 9. El final del Voto: expansión de dominio

Al tocar **"Aceptar el Voto"** en el EXP-00 se abre una escena a pantalla completa antes de ir a `/final/voto`. El final queda guardado apenas se acepta, aunque se saltee la escena.

**Secuencia** (unos 13 segundos, `components/DomainExpansion.js`):

1. **Oscuridad** con 領域展開. Dura lo necesario para que terminen de cargar los modelos: mínimo 3,8 s y como mucho 9 s.
2. **Se enciende el altar:** las velas sobre los cráneos y una luz que entra por las fauces del santuario. Sukuna espera parado adentro, con la cabeza gacha. Se revela el santuario en rojo y aparece 伏魔御廚子.
3. **Te mira:** levanta la cabeza y se le encienden los ojos.
4. **La risa:** la cámara se le acerca de golpe a la cara; la cabeza se sacude con la risa.
5. **Apagón:** negro total, solo quedan los ojos rojos un instante. Después pasa al final.

**Cómo está armada:**

- `DomainExpansion.js` maneja el tiempo y el sonido, y se monta con un **portal** fuera del marco de la terminal (si no, el grano y los temblores de la terminal afectan la escena). Bloquea el scroll de la página mientras dura.
- `Domain3D.js` dibuja la escena con las fases `dark`, `lit`, `laugh` y `off`.
- `three/domainModels.js` carga y prepara los modelos (ver [sección 13](#13-modelos-3d)): materiales, pose de los brazos, brillo de los ojos pegado al hueso de la cabeza y funciones para mover la cabeza y respirar.
- `three/domain.js` es el **respaldo procedural** (santuario, montaña de cráneos, Sukuna sentado, altar, charco y cielo). Se usa si los modelos no cargan. El altar, el charco y el cielo se usan siempre.
- `components/FinalArchive.js` empieza a descargar los modelos apenas aparece la oferta del Voto, mientras se lee.
- **Sonido** sintetizado con Web Audio (`createDomainAudio()` en `lib/sound.js`): drone grave, golpe al encender el altar, una risa grave hecha con formantes y eco, y corte total en el apagón. Suena aunque el sonido del juego esté apagado, porque arranca con el click de "Aceptar el Voto", como una cinemática.
- **Controles:** "Saltar escena" (o Escape) y "Silenciar". Sin sonido, la risa aparece como subtítulo. Con "Reducir efectos" no hay temblores ni parpadeos. Para lectores de pantalla, cada fase se describe en una región `aria-live`.

## 10. Three.js: qué se usa y dónde

Three.js directo (r186), sin React Three Fiber.

| Técnica | Dónde |
| --- | --- |
| `WebGLRenderer`, `PerspectiveCamera`, ACES tone mapping, sombras `PCFShadowMap` | `VaultRoom3D.js`, `Reliquary3D.js`, `Domain3D.js` |
| Límite de pixel ratio y `ResizeObserver` | los tres componentes 3D |
| Bucle con `requestAnimationFrame` y `THREE.Timer` (`Clock` está deprecado en r186) | los tres |
| Raycasting: cajas, mesa, libretas, sellos, puerta de salida, terminal (UV de la pantalla) | `VaultRoom3D.js`, `Reliquary3D.js` |
| Luces: `HemisphereLight`, `PointLight`, `SpotLight`, luz rasante | escenas |
| Geometrías: `LatheGeometry`, `TubeGeometry`, `ShapeGeometry`, `InstancedMesh`, geometrías unidas con `mergeGeometries` | `three/*` |
| **Modelos glTF** con `GLTFLoader` y respaldo procedural: dedo, santuario y Sukuna (con esqueleto) | `three/fingerModel.js`, `three/domainModels.js` |
| **Recursos propios:** shader de aura (fresnel + ruido), partículas con shader, shader de miasma (fbm deformado), cielo del dominio, texturas procedurales | `auraShader.js`, `particles.js`, `miasma.js`, `domain.js`, `proctex.js` |
| `CanvasTexture` dinámica: pantalla de la terminal, ofudas con su estado, libretas y planilla | `vaultTerminal.js`, `ofuda.js`, `vaultTable.js` |
| Envoltura que sigue la forma del modelo: secciones medidas cada 0,25 cm (envolvente convexa), sin picos y suavizadas | `fingerModel.js` (`fitBandToProfile`), `ofuda.js` (`buildWrapGeometry`) |
| Renderer compartido que no tira la página si no hay WebGL | `three/renderer.js` (`createRenderer`) |
| `dispose()` de geometrías, materiales, texturas y renderer al desmontar, y `forceContextLoss()` | los tres componentes 3D |

**Patrón React + Three:** la escena se crea una sola vez en un `useEffect` vacío. Los props cambiantes se copian a un objeto `live` (un `useRef`) que el bucle lee en cada cuadro, así React no recrea la escena. Para cambios puntuales hay funciones en `live.current` (`sync`, `setTable`) y, para los botones de zoom y lupa, un `apiRef` (`zoomIn`, `zoomOut`, `reset`, `focus`).

### Detalles de implementación que conviene conocer

- **Sellos a través del dedo:** el modelo del dedo viene marcado como semitransparente (`alphaMode: BLEND`) aunque su textura es opaca. Con ese modo Three no escribe la profundidad del dedo y la mitad de atrás de los sellos se veía a través. `loadFingerModel()` lo dibuja opaco (no se toca la malla ni las texturas).
- **El dedo no atraviesa la mesa:** `sampleFingerPoints()` toma unos 700 puntos de la superficie visible del dedo; en cada cuadro `lowestPoint()` busca el más bajo con la rotación del momento y el dedo se apoya sobre el terciopelo (`TRAY_FLOOR`) o el fieltro (`Reliquary3D.js`). Si cambia la forma (el modelo reemplaza al procedural), `fingerShapeKey()` lo detecta y se vuelven a tomar los puntos.
- **Sin WebGL:** `createRenderer()` devuelve `null` si el navegador no da un contexto (sin GPU, o bloqueado después de perder el contexto varias veces). La bóveda muestra "La bóveda no se pudo mostrar" con [ENTER] Ir al sistema; el expediente sigue con los botones de cada sello. Una pérdida de contexto real (no la de la limpieza) baja la calidad automática. Si la GPU no puede enlazar los shaders y no hay log, se avisa una sola vez en lugar de un error por material.
- **Modelos en caché:** los modelos de la expansión de dominio se cargan una vez y se reutilizan. Al desmontar la escena se sacan antes de liberar recursos, para no destruir la caché.

## 11. Estado, datos y persistencia

### Datos (`data/`)

- `tour.js`: los pasos del recorrido guiado (`TOUR`) y el orden de las pestañas (`TOUR_TABS`).
- `cases.js`: `SETTING` (fecha, lote, orden), `CASES` (cada expediente con `id`, `code`, `box`, `title`, `place`, `length`, `order`, cadena de custodia y `seals`; cada sello tiene `id`, `label`, `x` en cm, `ink` seca o fresca, **`condition`** (estado real), `inscription`, `hint` y `flashback` con `panels` y `hidden`), `SEAL_STATES`, `SEAL_STATE_GUIDE`, `VAULT_BOXES`, `HIDDEN_BOX`, `MEMORY_TOTAL`, `getCase`, `getCaseByBox` y `nextCaseId`.
- `endings.js`: `ENDINGS`, `VOW_MEMORY_REQUIRED = 6`, `VOW_LEAK_LIMIT = 3`, `canOfferVow` y `getEnding`.

### Estado (`hooks/useProgress.js`)

`ProgressProvider` envuelve toda la app (en `app/layout.js`) y `useProgress()` expone:

- `progress`: `{ cases, leak, memory, log, decisions, ending, endingsUnlocked, tour }`.
- `hydrated`, `authReady`, `user`, `signedIn`, `operator`, `persistence` (`'nube' | 'local' | 'offline'`), `firebaseEnabled`, `influence` y **`corruption`**.
- `settings` y `setSettings` (`reduceEffects`, `sound`).
- Acciones: `peelSeal` y `markSeal` (devuelven el resultado para dar feedback en el momento: arrancado, fuera de orden, no coincide), `findMemory`, `archiveCase`, `decide`, `finish`, `resetRun` (conserva los finales y el paso del recorrido), `setTour` y `auth` (anónimo, Google, email, salir, operador local).
- `isCaseUnlocked(progress, id)` y `getCorruption(progress)`.

El progreso se guarda siempre en localStorage (`contencion:progress:v1`). Con sesión de Firebase, también se sincroniza en Firestore (con escritura diferida). El indicador del encabezado (`PersistenceBadge`) muestra el estado real: **ARCHIVO CENTRAL**, **REGISTRO LOCAL** o **SIN ENLACE**.

En la bóveda, `sessionStorage` recuerda si ya se pasó la intro (`contencion:entered`), qué dedo quedó sobre la mesa (`contencion:table`) y el último nivel de corrupción visto (`contencion:corruption-seen`).

## 12. Firebase

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

> **Estado al 29/10/2026:** el proyecto de Firebase que usa el `.env` del equipo tiene publicadas las reglas de **modo de prueba**, que vencieron el 19/09/2026. Desde entonces Firestore rechaza todo con "Missing or insufficient permissions" (el juego sigue andando con el progreso local). Hay que publicar `firestore.rules` del repo. Como el repo no tiene `firebase.json`, se hace desde una carpeta aparte con un `firebase.json` mínimo (`{"firestore":{"rules":"firestore.rules"}}`) y una copia de las reglas: `firebase deploy --only firestore:rules --project <id del .env>`. Verificar antes el ID del proyecto contra `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
>
> También se vio que el login anónimo falló con un error 400: revisar que el proveedor **Anonymous** esté habilitado.

> Los archivos `.env*` están en `.gitignore`. Nunca subir las claves al repo.

## 13. Modelos 3D

Están en `public/models/`, cada uno con su archivo de licencia al lado.

| Archivo | Qué es | Peso | Licencia | Cambios |
| --- | --- | --- | --- | --- |
| `sukuna-finger.glb` | El dedo (mesa, cajas, expediente) | 18 MB | CC BY-NC-ND 4.0 | Ninguno en el archivo. En la escena se dibuja opaco |
| `malevolent-shrine.glb` | Santuario de la expansión de dominio | 9,5 MB | CC BY 4.0 | Optimizado: texturas a 1024 px en JPEG (512 px las de metal/rugosidad), sin tangentes ni UVs que no se usan, índices de 16 bits. Original: 50 MB |
| `sukuna.glb` | Sukuna de la expansión de dominio | 1,3 MB | CC BY 4.0 | Materiales "unlit" cambiados por materiales con luz (si no, se veía brillante en la oscuridad) |

- En la escena, a Sukuna se le bajan los brazos (venía con los brazos abiertos) y se le anima la cabeza con su esqueleto (`bone_Head_071`). Mide unos 2,25 m y está parado dentro de las fauces del santuario (medidas en `LAYOUT` de `three/domainModels.js`).
- **Para regenerar los modelos de la expansión de dominio:** descomprimir los zips de Sketchfab en una carpeta con dos subcarpetas, `shrine/` y `sukuna/`, y correr `node scripts/build-domain-models.cjs . <esa carpeta>`. Usa `sharp`, que ya viene instalado con Next. Escribe los `.glb` y copia las licencias en `public/models/`.

## 14. Estructura del código

```
app/
  layout.js               fuentes (next/font), metadata global, ProgressProvider
  page.js                 portada: intro + <Vault />
  acceso/ indice/ creditos/
  expediente/[id]/        ruta dinámica de expedientes (01, 02, 03, 00)
  final/[ending]/         ruta dinámica de finales (voto, ejecutado)
  loading.js error.js not-found.js
  globals.css             estilos, degradación por influencia, bóveda, inspección,
                          libretas, expansión de dominio, responsive
components/
  Vault.js                interfaz de la bóveda: HUD, tarjetas, navegación sin 3D, inspección,
                          salida, avisos de corrupción
  VaultRoom3D.js          escena de la bóveda (vistas, luces, atmósfera, raycasting, sellos, dedo)
  InspectionPanel.js      panel de la mesa: herramientas, sellos, planilla, archivar
  InspectionNotes.js      libretas: expediente, residuos, planilla y archivados
  SealStatePicker.js      planilla del estado de un sello (con la imagen del sello desplegado)
  Reliquary3D.js          escena del dedo en /expediente/[id] (sellos, luz rasante, aura)
  Shell.js                marco de la interfaz V3.2 y sus piezas (Key, Tag, Cells, ScreenHead, atajos)
  IndexScreens.js         las 7 pestañas del sistema de expedientes
  TourCard.js             cartel del recorrido guiado
  CaseFile.js             pantalla del expediente: visor, sellos, planilla, lecturas, archivo
  MangaFlashback.js       paneles de manga con detalles ocultos
  FinalArchive.js         EXP-00: la orden se tacha, oferta del pacto, precarga de modelos
  DomainExpansion.js      secuencia, sonido y controles de la expansión de dominio
  Domain3D.js             escena de la expansión de dominio
  CaseIndex.js AuthPanel.js EndingActions.js VeilLoading.js
three/
  vault.js                punto de entrada (reexporta los módulos de la sala)
  vaultRoom.js            sala: piso, paredes, puerta sellada, salida, caños, utilería
  vaultShelf.js           estanterías, cajas, brillo de los dedos, relleno
  vaultTable.js           mesa, libretas, planilla, carpetas, relicario de la mesa
  vaultTerminal.js        computadora e interfaz de la pantalla
  miasma.js               shader de la niebla roja del piso
  domain.js               expansión de dominio procedural (respaldo, altar, cielo, charco)
  domainModels.js         carga y preparación de los modelos del santuario y de Sukuna
  proctex.js              texturas procedurales
  fonts.js                nombres reales de las fuentes de next/font para el canvas
  fingerModel.js          carga del .glb del dedo y ajuste de los sellos al modelo
  finger.js               dedo procedural (respaldo) y apoyo del dedo sobre la mesa
  ofuda.js                envoltura del dedo (tiras con símbolos, un tramo por sello) y ofudas de papel
  renderer.js             WebGLRenderer compartido (null si no hay WebGL) y avisos de la GPU
  auraShader.js particles.js scenery.js quality.js optimize.js
data/                     cases.js, endings.js, tour.js (pasos del recorrido guiado)
hooks/                    useProgress.js (estado narrativo y persistencia), useQuality.js, useTour.js
lib/                      firebase.js, sound.js (Web Audio: zumbido, papel, dominio), readings.js
public/models/            modelos .glb y sus licencias
scripts/                  build-domain-models.cjs (optimiza los modelos de Sketchfab)
firestore.rules
```

> `GUIA-THREEJS.md` es la guía del boilerplate original. Explica `ThreeArtifact.js`, un componente que ya no existe, pero los conceptos siguen sirviendo.

## 15. Cumplimiento de la consigna TP6

| Requisito | Cómo se cumple |
| --- | --- |
| Next.js App Router | `app/` con layout, rutas estáticas y dinámicas |
| Ruta dinámica | `/expediente/[id]` y `/final/[ending]` |
| Server y Client Components | páginas Server; escenas, auth y progreso en cliente (`'use client'`) |
| Metadata | `metadata` global y por página; `generateMetadata` en rutas dinámicas |
| Estados de carga y error | `loading.js`, `error.js`, `not-found.js`; texto de carga en cada escena 3D |
| Tres escenas o capítulos, con inicio, progresión y cierre | bóveda e intro, tres expedientes, EXP-00 con la expansión de dominio y dos finales |
| Coleccionables | 9 detalles ocultos en los residuos; estados de los sellos en la planilla |
| Desbloqueo y cambio de estado | expedientes que se habilitan en orden, caja B3-11, bóveda que se enturbia, final según memoria y residuo |
| Feedback visual y sonoro | brillo, partículas, avisos, latido, sonido de papel, zumbido y escena del dominio |
| Three.js directo | sin R3F, en `components/*3D.js` y `three/` |
| Interacción con raycasting | cajas, mesa, libretas, sellos, salida, terminal (UV de la pantalla) |
| Límite de pixel ratio | `setPixelRatio(Math.min(devicePixelRatio, …))` en cada escena |
| Liberar recursos | `dispose()` completo y `forceContextLoss()` |
| Recurso propio | shaders de aura y miasma, partículas con shader, texturas procedurales, interfaz en canvas, sellos con estado, escena procedural del dominio |
| Firebase Auth | anónimo, Google, email/contraseña |
| Firestore por usuario con reglas | `progress/{uid}`, `users/{uid}`, `firestore.rules` |
| Indicador real de persistencia | `PersistenceBadge` (nube, local, offline) |
| Accesibilidad | controles sin 3D para todo (moverse, cajas, sellos, lupa, libretas, salida), atajos de teclado en toda la interfaz, recorrido guiado, aviso si no hay WebGL, diálogos con foco y Escape, "Reducir efectos", subtítulos y descripciones en la expansión de dominio, `prefers-reduced-motion` |
| Responsive | marco de la interfaz a 1100, 900 y 640 px; bóveda a 1180 y 760 px; FOV más abierto y cámaras ajustadas en vertical |
| Documentación | este README y los créditos |

## 16. Cómo extender el proyecto

- **Cambiar textos, pistas o flashbacks:** todo está en `data/cases.js`. Un sello nuevo necesita `id`, `x` (posición en cm sobre el dedo, entre −L/2 y L/2), `ink`, `condition`, `inscription` y `flashback.hidden` con un `id` único. Actualizar también `order`.
- **Cambiar el estado de un sello o su aspecto:** `condition` en `data/cases.js`; la envoltura del dedo está en `drawWrap()` y `sealSpan()` de `three/ofuda.js` (las grietas y desgarros, en `damage()`); la guía de reconocimiento en `SEAL_STATE_GUIDE`.
- **Que registrar mal un estado no penalice:** quitar el `+1` de `leak` en `markSeal` (`hooks/useProgress.js`).
- **Agregar un expediente:** sumarlo a `CASES` con una `box` libre de `VAULT_BOXES` y agregar el `id` a `generateStaticParams` (se toma de `CASES`). La caja muestra el dedo y brilla sola, porque `getCaseByBox` la reconoce.
- **Ajustar la atmósfera:** la fórmula está en `getCorruption()` y los efectos en el bucle de `VaultRoom3D.js` (colores `CLEAN` y `CURSED`, niebla, luces, miasma, latido).
- **Cambiar el recorrido guiado:** los pasos están en `TOUR` de `data/tour.js`. Cada uno tiene `where` (`vault`, `index` o `case`), `title`, `text` y, o bien `ack: true` (se cierra con Entendido), o bien `done(estado)`. En la bóveda, `allow` lista las acciones permitidas (`navigate:right`, `box:B3-04`, `carry:01`, `activate:terminal`…). Para resaltar algo, se le pone `data-tour="…"` y se usa ese nombre en `target`.
- **Nueva pestaña en la terminal:** agregarla a `SCREEN_TABS` y escribir su función de dibujo en `vaultTerminal.js`. Para que algo sea clickeable, se empuja `{ x, y, w, h, action }` a `hotspots`, y la acción se resuelve en `activate()` de `Vault.js`.
- **Nueva vista de cámara:** agregarla a `VIEWS` en `VaultRoom3D.js` y a la barra "Moverse sin 3D" en `Vault.js`.
- **Ajustar la expansión de dominio:** los tiempos en `TIMELINE` de `DomainExpansion.js`; las cámaras (`MODEL_CAMERA`), las luces y la intensidad de cada una (`power`) en `Domain3D.js`; la ubicación de Sukuna, el altar y la garganta en `LAYOUT` de `three/domainModels.js`.
- **Nueva textura:** agregar un generador en `proctex.js` que devuelva `{ map, bumpMap, roughnessMap }`. Conviene reutilizar `grainField`, `cloudField` y `poreField` con `drawField` en lugar de recorrer píxeles.
- **Texto en canvas:** usar `font('mono' | 'display' | 'sans' | 'brush', tamaño, peso)` de `three/fonts.js`. `next/font` registra las fuentes con nombres generados y el canvas no las encuentra por su nombre.

## 17. Convenciones y advertencias

- **Next.js 16 no es el Next que conocés:** cambian APIs y convenciones (por ejemplo, `params` asíncrono). Antes de tocar rutas, leer la guía en `node_modules/next/dist/docs/` (lo indica `AGENTS.md`).
- **React 19 + eslint-config-next:** las reglas `react-hooks` son estrictas (sin `setState` sincrónico en efectos, sin leer refs durante el render, sin memoización manual innecesaria). Correr `npm run lint` antes de subir.
- **Three r186:** `THREE.Clock` está deprecado (se usa `THREE.Timer`) y `PCFSoftShadowMap` ya no existe (se usa `PCFShadowMap`).
- **Todo lo que se crea, se libera:** cualquier geometría, material o textura nueva tiene que quedar dentro de la escena para que la recorra `disposeObject`. Excepción: los modelos en caché del dominio, que se sacan de la escena antes de liberar.
- **Modelo del dedo:** la licencia CC BY-NC-ND no permite modificarlo. Se puede escalar, iluminar, dibujarlo opaco y poner sellos encima, pero no editar la malla ni las texturas (tampoco achicarlas).
- **Modelos del dominio:** son CC BY: se pueden adaptar dando crédito e indicando los cambios (ya está en `/creditos`). Si se regeneran, mantener los créditos.
- **Rendimiento:** las texturas de la bóveda se generan al cargar (alrededor de un segundo en una GPU común). La calidad automática (`hooks/useQuality.js`) baja sola si la PC no llega a ~30 cuadros por segundo. El miasma usa menos capas en calidad baja.
- **Ramas:** trabajar en ramas que salgan de `main` y llevarlas a `main` cuando estén probadas. No usar `push --force`.
- **Diseño:** la interfaz sigue la V3.2 del Figma: burocrática, en grises, rojo y amarillo como acento y sin kanji. Usar los colores de `:root` y los componentes de `Shell.js` en lugar de estilos sueltos.
- **Next.js 16.4.0:** muestra un aviso de vulnerabilidad al arrancar y el primer `npm run dev` o `npm run build` se corta: se vuelve a correr y sigue. No actualizar sin acordarlo con el equipo.
- **Archivos de lock:** hay `package-lock.json` y `yarn.lock`. Conviene usar `npm` y borrar `yarn.lock` antes del deploy, para que el hosting no se confunda de gestor de paquetes.
- **No correr `npm audit fix --force`:** baja `eslint-config-next` a la versión 14 y rompe el lint. Las 5 alertas que marca `npm audit` son de herramientas de desarrollo (`braces`, vía ESLint): `npm audit --omit=dev` da 0 vulnerabilidades en lo que llega al sitio.
- `.claude/launch.json` sirve para levantar el servidor de desarrollo desde Claude Code; no afecta al sitio.
- Los textos del sitio están en español rioplatense (voseo).

## 18. Pendientes

- [ ] **Deploy** (Vercel u otro). Cargar las variables de Firebase en el hosting y agregar el dominio en Authentication.
- [ ] **Publicar `firestore.rules`** en el proyecto de Firebase del `.env` (las reglas de prueba vencieron el 19/09/2026) y habilitar el login **Anonymous**.
- [ ] Verificar el login con Google y la sincronización en Firestore con el `.env` real del equipo.
- [ ] **Actualizar Next.js** (la 16.4.0 tiene una vulnerabilidad conocida).
- [ ] Decidir la fecha: el código dice marzo de 2018 y el Figma V3.2 ambienta alrededor de 2006 (cuando Gojo y Geto eran alumnos).
- [ ] Decidir si se sacan los kanji que quedan en la escena 3D (carteles y ofudas de la sala, efectos de sonido del manga, expansión de dominio). La interfaz ya no tiene.
- [ ] Probar el recorrido guiado en celulares (el cartel va abajo y puede tapar parte de la pantalla).
- [ ] Dejar un solo archivo de lock (`package-lock.json`).
- [ ] Escuchar la risa sintetizada de la expansión de dominio y ajustarla si hace falta (tono, duración, volumen).
- [ ] Confirmar el emblema del clan (hoy es un provisorio de "tres hojas") y definir su nombre.
- [ ] Probar la bóveda y la expansión de dominio en celulares y en computadoras con GPU modesta (fluidez y tiempo de carga).
- [ ] Revisar si hace falta una pantalla de carga con progreso mientras bajan los modelos (dedo de 18 MB y santuario de 9,5 MB).
- [ ] En ventanas de menos de 760 px de ancho, la tarjeta de la terminal puede tapar parte de la pantalla: evaluar achicarla.

## 19. Historial de trabajo

| Commit | Qué se hizo |
| --- | --- |
| `82973fb` | Se reemplaza la demo SEÑAL 88 por Contención: rutas, expedientes, flashbacks, mecánica de sellos, finales y Firebase |
| `02bced8` | Bóveda B3 en 3D como entrada: estanterías, mesa y terminal |
| `7be88e4` | Carga del modelo del dedo de Sketchfab con `GLTFLoader` (respaldo procedural) y créditos |
| `342ad2a` | Se agrega el modelo `public/models/sukuna-finger.glb` (sin modificar) |
| `318ebde`, `7c9884d` | Sellos ofuda ajustados a la forma real del modelo, sin estirar la textura |
| `528486d` | Mejora visual de la bóveda: texturas procedurales, cajas y estanterías detalladas, brillo de los dedos, mesa, sala y terminal con interfaz clickeable |
| `5eda15a` | Optimización 3D: sombras bajo demanda, menos luces, piezas unidas y calidad automática |
| `db6800a` | Se crea la rama `jugika` (con `yarn.lock` y la configuración de lanzamiento) |
| `d89a392` | Inspección en la mesa con libretas, estados de los sellos, atmósfera según el avance, salida para cerrar sesión, expansión de dominio con modelos de Sketchfab y arreglos del dedo |
| `194f51c` | Cámara de la terminal más cerca y de frente a la pantalla |
| `a89bc85` | README completo para el equipo, script de los modelos y `jugika` llevada a `main` |
| `bdb6808` | Interfaz V3.2 del Figma ("CustodiaOS") en la web y en la pantalla de la computadora: marco común, 7 pestañas, atajos de teclado |
| `909ee49` | La portada vuelve a arrancar en la bóveda; avisos de la GPU agrupados |
| `4ba3c41` | Sin WebGL la página sigue andando (`three/renderer.js`); pantalla de la terminal más liviana |
| `aad59f2` | Sello como en el anime (dedo envuelto entero, un tramo por sello) y recorrido guiado de la primera partida |
| (siguiente) | README al día y `Shoacoo` llevada a `main` |

Antes de programar se hizo un análisis del prototipo 2D (errores y propuestas), que llevó a las decisiones de la sección 4.

## 20. Créditos

- *Jujutsu Kaisen* © Gege Akutami / Shueisha. No se usa arte oficial.
- Modelo del dedo: ["Sukuna's finger"](https://sketchfab.com/3d-models/sukunas-finger-0094c76440e3447a900797ede9bad5bf) de André Souza ([@asouza](https://sketchfab.com/asouza)), licencia [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Se usa sin modificar la malla ni las texturas (ver `public/models/sukuna-finger-LICENSE.txt`).
- Santuario de la expansión de dominio: ["Malevolent_shrine jjk cc"](https://sketchfab.com/3d-models/malevolent-shrine-jjk-cc-df9a59de87944a65b8d77847d1008c4d) de Tyo155q ([@Tyo155q](https://sketchfab.com/Tyo155q)), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptado: texturas reducidas y atributos sin uso eliminados (ver `public/models/malevolent-shrine-LICENSE.txt`).
- Sukuna de la expansión de dominio: ["Sukuna Free Fire Skin"](https://sketchfab.com/3d-models/sukuna-free-fire-skin-81a53ae2b8604c40843bda9490cef39e) de rocklee.ff ([@rocklee.ff123](https://sketchfab.com/rocklee.ff123)), licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptado: materiales con luz, otra pose de brazos y cabeza animada (ver `public/models/sukuna-LICENSE.txt`). Es una skin del juego Free Fire: el diseño original probablemente sea de Garena.
- Tipografías: DM Mono, Space Grotesk, Zen Kaku Gothic New y Yuji Syuku (Google Fonts, SIL OFL).
- Three.js (MIT), Next.js (MIT), Firebase JS SDK (Apache 2.0).
- Sonido generado con Web Audio API. Texturas generadas en canvas.
- Referencias: sitio de *Requiem for a Dream* (Hi-ReS!, 2000) y *A Journal of Insomnia* (NFB, 2013).
