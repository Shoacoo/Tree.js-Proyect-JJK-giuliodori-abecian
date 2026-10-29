'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Key, PersistenceBadge, useHotkeys } from '@/components/Shell';
import { SETTING } from '@/data/cases';
import { useProgress } from '@/hooks/useProgress';

const ERRORS = {
  'auth/invalid-credential': 'Credenciales incorrectas.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Ingresá con tu contraseña.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
  'auth/operation-not-allowed': 'Ese método de acceso no está habilitado en Firebase.',
  'auth/network-request-failed': 'Sin enlace con el archivo central. Revisá la conexión.',
};

const METHODS = [
  { id: 'anon', key: '1', label: 'Anónimo', value: 'anónimo' },
  { id: 'google', key: '2', label: 'Google', value: 'cuenta de Google' },
  { id: 'email', key: '3', label: 'Correo' },
];

const LOT = SETTING.lot.replace(/^LOTE /, '');

// "> operador: ▮", el campo de la terminal. Sin input muestra el valor fijo del método elegido.
function TermField({ prompt, value, onChange, inputRef, ...input }) {
  if (onChange) {
    return (
      <label className="term-field">
        <span className="term-field__prompt">&gt; {prompt}:</span>
        <span className="term-field__input">
          {value ? null : <span className="cursor" aria-hidden="true" />}
          <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} {...input} />
        </span>
      </label>
    );
  }
  return (
    <div className="term-field">
      <span className="term-field__prompt">&gt; {prompt}:</span>
      <span className="term-field__value">{value}</span>
      <span className="cursor" aria-hidden="true" />
    </div>
  );
}

export default function AuthPanel() {
  const router = useRouter();
  const { auth, firebaseEnabled, signedIn, authReady } = useProgress();
  const [method, setMethod] = useState('anon');
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localName, setLocalName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const emailRef = useRef(null);

  useEffect(() => {
    if (authReady && signedIn) router.replace('/indice');
  }, [authReady, signedIn, router]);

  const choose = (id) => {
    setMethod(id);
    setError(null);
    if (id === 'email') requestAnimationFrame(() => emailRef.current?.focus());
  };

  useHotkeys({
    ...(firebaseEnabled ? Object.fromEntries(METHODS.map((m) => [m.key, () => choose(m.id)])) : {}),
    Enter: () => formRef.current?.requestSubmit(),
    Escape: () => router.push('/'),
  });

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(ERRORS[err.code] ?? 'No se pudo ingresar. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (!firebaseEnabled) auth.enterLocal(localName || 'Ventana');
    else if (method === 'anon') run(auth.anonymous);
    else if (method === 'google') run(auth.google);
    else run(() => (mode === 'signin' ? auth.emailSignIn(email, password) : auth.emailSignUp(email, password)));
  };

  const current = METHODS.find((m) => m.id === method);

  return (
    <form ref={formRef} className="auth" onSubmit={submit}>
      <p className="auth__lead">Toda inspección del Depósito B3 queda registrada a nombre del operador.</p>

      {!firebaseEnabled ? (
        <TermField
          prompt="operador"
          value={localName}
          onChange={setLocalName}
          aria-label="Nombre del operador"
          autoComplete="nickname"
          autoFocus
        />
      ) : method === 'email' ? (
        <div className="auth__fields">
          <TermField
            prompt="correo"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={setEmail}
            inputRef={emailRef}
            aria-label="Correo"
          />
          <TermField
            prompt="clave"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={setPassword}
            aria-label="Contraseña"
          />
          <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? '¿No tenés credencial? Crear una' : 'Ya tengo credencial'}
          </button>
        </div>
      ) : (
        <TermField prompt="operador" value={current.value} />
      )}

      {firebaseEnabled ? (
        <div className="keys" role="group" aria-label="Método de identificación">
          {METHODS.map((m) => (
            <Key key={m.id} k={m.key} variant={method === m.id ? 'fill' : 'outline'} aria-pressed={method === m.id} onClick={() => choose(m.id)}>
              {m.label}
            </Key>
          ))}
        </div>
      ) : (
        <p className="auth__note">Firebase no está configurado en este deploy: el progreso se guarda en este navegador.</p>
      )}

      <div className="panel panel--alert notice" role={error ? 'alert' : 'status'}>
        <span className="notice__mark" aria-hidden="true">
          !
        </span>
        <span>{error ?? `Sin sesión. El lote ${LOT} está bloqueado.`}</span>
      </div>

      <div className="auth__foot">
        <Key k="ENTER" variant="fill" type="submit" disabled={busy}>
          {busy ? 'Ingresando…' : method === 'email' && mode === 'signup' && firebaseEnabled ? 'Crear credencial' : 'Ingresar'}
        </Key>
        <PersistenceBadge />
      </div>
    </form>
  );
}
