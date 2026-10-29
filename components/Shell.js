'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import TourCard from '@/components/TourCard';
import { CASES } from '@/data/cases';
import { useProgress } from '@/hooks/useProgress';
import { handle } from '@/lib/readings';

// Interfaz V3.2 ("Tipografía amigable" en el Figma): ventana gris, panel lateral con el menú
// del sistema, contenido y barra de estado. La usan todas las páginas fuera de la bóveda 3D.

export const OS_VERSION = 'CustodiaOS v2.0.6';

const PERSISTENCE_LABEL = {
  nube: 'ARCHIVO CENTRAL · nube',
  local: 'REGISTRO LOCAL · equipo',
  offline: 'SIN ENLACE · offline',
};

export function PersistenceBadge() {
  const { persistence, firebaseEnabled } = useProgress();
  return (
    <span
      className={`persistence persistence--${persistence}`}
      role="status"
      title={firebaseEnabled ? undefined : 'Firebase no está configurado: el progreso se guarda en este navegador.'}
    >
      <span className="persistence__dot" aria-hidden="true" />
      {PERSISTENCE_LABEL[persistence]}
    </span>
  );
}

export { handle };

// Pestañas del índice en el hash de la URL (/indice#registro). Next cambia la URL con
// pushState, que no dispara "hashchange": por eso también se avisa con un evento propio.
const HASH_EVENT = 'contencion:hash';

function subscribeHash(callback) {
  window.addEventListener('hashchange', callback);
  window.addEventListener(HASH_EVENT, callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener(HASH_EVENT, callback);
  };
}

export function useHash() {
  return useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => '',
  );
}

export function goHash(id) {
  window.history.pushState(null, '', `#${id}`);
  window.dispatchEvent(new Event(HASH_EVENT));
}

// Atajos de teclado de las teclas de la interfaz. No se disparan mientras se escribe en un campo,
// ni con Enter o espacio sobre un botón (el navegador ya hace click).
export function useHotkeys(map, enabled = true) {
  const latest = useRef(map);
  useEffect(() => {
    latest.current = map;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return;
      if ((event.key === 'Enter' || event.key === ' ') && target?.closest?.('button, a')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const action = latest.current[key];
      if (!action) return;
      event.preventDefault();
      action(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/**
 * Tecla de la interfaz: "[ENTER] Ingresar". variant: outline (contorno gris), fill (amarillo),
 * red (rojo) o ink (contorno negro, sobre papel o rojo). Con href es un link.
 */
export function Key({ k, children, variant = 'outline', href, onClick, disabled, className = '', ...rest }) {
  const classes = `key key--${variant} ${className}`.trim();
  const label = (
    <>
      {k ? <span className="key__hint">[{k}]</span> : null}
      {children}
    </>
  );
  if (href && !disabled) {
    if (href.startsWith('#')) {
      return (
        <a
          href={href}
          className={classes}
          onClick={(event) => {
            event.preventDefault();
            goHash(href.slice(1));
            onClick?.(event);
          }}
          {...rest}
        >
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} onClick={onClick} {...rest}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {label}
    </button>
  );
}

export function Tag({ tone = 'normal', children }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

// Medidor de cuadraditos: memoria, energía filtrada, sellos verificados.
export function Cells({ value, max, tone = 'y', label }) {
  return (
    <span className="cells" role="img" aria-label={label ?? `${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? `is-${tone}` : ''} />
      ))}
    </span>
  );
}

// Encabezado de cada pantalla: rótulo amarillo y título.
export function ScreenHead({ eyebrow, title, size, tone }) {
  return (
    <header className="screen-head">
      <p className={`eyebrow${tone ? ` eyebrow--${tone}` : ''}`}>{eyebrow}</p>
      {title ? <h1 className={`screen-title${size ? ` screen-title--${size}` : ''}`}>{title}</h1> : null}
    </header>
  );
}

function menuItems(signedIn, logCount, onIndex) {
  const to = (id) => (onIndex ? `#${id}` : `/indice#${id}`);
  return [
    { id: 'sesion', label: 'Sesión', href: signedIn ? to('sesion') : '/acceso' },
    { id: 'lote', label: 'Lote', href: to('lote'), count: CASES.length },
    { id: 'registro', label: 'Registro', href: to('registro'), count: logCount || null },
    { id: 'barrera', label: 'Barrera', href: to('barrera') },
    { id: 'protocolo', label: 'Protocolo', href: to('protocolo') },
    { id: 'formularios', label: 'Formularios', href: to('formularios') },
    { id: 'ayuda', label: 'Ayuda', href: to('ayuda') },
  ];
}

// Link del menú: en /indice cambia de pestaña por el hash; desde otra página navega.
function MenuLink({ href, children, ...rest }) {
  if (!href.startsWith('#')) {
    return (
      <Link href={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        goHash(href.slice(1));
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

const DEFAULT_HINTS = '[TAB] Navegar  [ENTER] Seleccionar  [ESC] Cerrar';

// tour: el recorrido guiado de la pantalla (useTour). Bloquea las pestañas que todavía no se mostraron.
export default function Shell({ active, children, hints = DEFAULT_HINTS, status, tour, tourPaused = false }) {
  const pathname = usePathname();
  const { progress, signedIn, operator, influence, settings, hydrated } = useProgress();
  const onIndex = pathname === '/indice';
  const items = menuItems(signedIn, progress.log.length, onIndex);
  const iconHref = (id) => (onIndex ? `#${id}` : `/indice#${id}`);

  return (
    <div className="shell" data-influence={hydrated ? influence : 0} data-reduce={settings.reduceEffects ? 'true' : 'false'}>
      <a href="#contenido" className="skip">
        Saltar al contenido
      </a>
      <aside className="shell__side">
        <Link href="/" className="shell__logo" aria-label="Contención · volver a la bóveda">
          contención
        </Link>
        <span className="shell__b3" aria-hidden="true">
          B3
        </span>
        <nav className="shell__menu" aria-label="Menú del sistema">
          {items.map((item) =>
            tour?.tabLocked(item.id) && active !== item.id ? (
              <span key={item.id} className="shell__item is-locked" aria-disabled="true" title="Se desbloquea más adelante en el recorrido">
                <span>{item.label}</span>
                <span className="shell__count">bloq.</span>
              </span>
            ) : (
              <MenuLink
                key={item.id}
                href={item.href}
                className={`shell__item${active === item.id ? ' is-active' : ''}`}
                aria-current={active === item.id ? 'page' : undefined}
                data-tour={`menu-${item.id}`}
              >
                <span>{item.label}</span>
                {item.count ? <span className="shell__count">{item.count}</span> : null}
              </MenuLink>
            ),
          )}
        </nav>
        <div className="shell__foot">
          <span>{OS_VERSION}</span>
          <span className="shell__icons">
            {tour?.tabLocked('ayuda') ? (
              <span aria-disabled="true">[?]</span>
            ) : (
              <MenuLink href={iconHref('ayuda')} title="Ayuda" aria-label="Ayuda">
                [?]
              </MenuLink>
            )}
            {tour?.tabLocked('formularios') ? (
              <span aria-disabled="true">[⚙]</span>
            ) : (
              <MenuLink href={iconHref('formularios')} title="Formularios y ajustes" aria-label="Formularios y ajustes">
                [⚙]
              </MenuLink>
            )}
            <Link href="/" title="Salir a la bóveda" aria-label="Salir a la bóveda">
              [⏻]
            </Link>
          </span>
        </div>
      </aside>
      <div className="shell__main">
        <main className="shell__content" id="contenido">
          {children}
        </main>
        <footer className="shell__status">
          <span className="shell__hints">{status ?? hints}</span>
          <span className="shell__op">{signedIn ? handle(operator) : 'sin sesión'}</span>
        </footer>
      </div>
      {tour ? <TourCard tour={tour} paused={tourPaused} /> : null}
      <div className="scanlines" aria-hidden="true" />
    </div>
  );
}
