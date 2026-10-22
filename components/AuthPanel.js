'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PersistenceBadge } from '@/components/Terminal';
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

export default function AuthPanel() {
  const router = useRouter();
  const { auth, firebaseEnabled, signedIn, authReady } = useProgress();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localName, setLocalName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authReady && signedIn) router.replace('/indice');
  }, [authReady, signedIn, router]);

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

  const submitEmail = (event) => {
    event.preventDefault();
    run(() => (mode === 'signin' ? auth.emailSignIn(email, password) : auth.emailSignUp(email, password)));
  };

  if (!firebaseEnabled) {
    return (
      <section className="auth">
        <h2 className="title">Identificación</h2>
        <p className="muted">
          Firebase no está configurado en este deploy. El progreso se guarda en este navegador (registro local).
        </p>
        <form
          className="auth__form"
          onSubmit={(event) => {
            event.preventDefault();
            auth.enterLocal(localName || 'Ventana');
          }}
        >
          <label className="field">
            NOMBRE DEL OPERADOR
            <input value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="Abecian" />
          </label>
          <button type="submit" className="btn btn--primary btn--block">
            Ingresar al depósito
          </button>
        </form>
        <PersistenceBadge />
      </section>
    );
  }

  return (
    <section className="auth">
      <div className="auth__head">
        <h2 className="title">Identificación</h2>
        <span className="stamp stamp--round" aria-hidden="true">検</span>
      </div>
      <form className="auth__form" onSubmit={submitEmail}>
        <label className="field">
          CORREO
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ventana@jujutsu-high.jp" />
        </label>
        <label className="field">
          CONTRASEÑA
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {mode === 'signin' ? 'Ingresar al depósito' : 'Crear credencial'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? '¿No tenés credencial? Crear una' : 'Ya tengo credencial'}
        </button>
      </form>
      <div className="divider">O</div>
      <button type="button" className="btn btn--block" disabled={busy} onClick={() => run(auth.google)}>
        Continuar con Google
      </button>
      <button type="button" className="btn btn--ghost btn--block" disabled={busy} onClick={() => run(auth.anonymous)}>
        Entrar sin registro (anónimo)
      </button>
      {error ? (
        <p className="feedback feedback--bad" role="alert">
          {error}
        </p>
      ) : null}
      <div className="auth__status">
        <div className="label">ESTADO DE REGISTRO</div>
        <PersistenceBadge />
      </div>
    </section>
  );
}
