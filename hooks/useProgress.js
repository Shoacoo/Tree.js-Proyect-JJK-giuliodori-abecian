'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CASES } from '@/data/cases';
import { firebaseEnabled, getFirebase } from '@/lib/firebase';

const STORAGE_KEY = 'contencion:progress:v1';
const LOCAL_OPERATOR_KEY = 'contencion:local-operator';

export function createInitialProgress(endingsUnlocked = []) {
  return {
    cases: Object.fromEntries(
      CASES.map((c) => [
        c.id,
        {
          archived: false,
          seals: Object.fromEntries(c.seals.map((s) => [s.id, { peeled: false, state: null, ripped: false }])),
        },
      ]),
    ),
    leak: 0,
    memory: [],
    log: [],
    decisions: {},
    ending: null,
    endingsUnlocked,
  };
}

function readLocal() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...createInitialProgress(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function writeLocal(progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

function formatOperator(user, localName) {
  if (user?.displayName) {
    const parts = user.displayName.trim().split(/\s+/);
    const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const initial = parts.length > 1 ? `${parts[0][0]}.` : '';
    return `${last.toUpperCase()}${initial ? `, ${initial}` : ''}`;
  }
  if (user?.email) return user.email.split('@')[0].toUpperCase();
  if (localName) return localName.toUpperCase();
  return 'VENTANA N.º 0417';
}

function stamp() {
  return new Date().toLocaleTimeString('es-AR', { hour12: false });
}

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(createInitialProgress);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [online, setOnline] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [localName, setLocalName] = useState(null);
  const [settings, setSettings] = useState({ reduceEffects: false, sound: false });
  const remoteLoaded = useRef(false);

  // Progreso local y preferencias. Se leen después del montaje para que el HTML del servidor
  // y el primer render del cliente coincidan (localStorage no existe en el servidor).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const local = readLocal();
    if (local) setProgress(local);
    try {
      setLocalName(window.localStorage.getItem(LOCAL_OPERATOR_KEY));
      const savedSettings = window.localStorage.getItem('contencion:settings');
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setSettings(savedSettings ? JSON.parse(savedSettings) : { reduceEffects: prefersReduced, sound: false });
    } catch {
      // El navegador bloqueó el almacenamiento: se sigue con los valores por defecto.
    }
    setOnline(navigator.onLine);
    setHydrated(true);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sesión de Firebase y descarga del progreso remoto.
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return undefined;
    return onAuthStateChanged(fb.auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      remoteLoaded.current = false;
      if (!nextUser) return;
      try {
        await setDoc(
          doc(fb.db, 'users', nextUser.uid),
          {
            userId: nextUser.uid,
            email: nextUser.email ?? null,
            displayName: nextUser.displayName ?? null,
            photoURL: nextUser.photoURL ?? null,
            isAnonymous: nextUser.isAnonymous,
            authProvider: nextUser.providerData[0]?.providerId ?? 'anonymous',
            lastLoginAt: serverTimestamp(),
          },
          { merge: true },
        );
        const snapshot = await getDoc(doc(fb.db, 'progress', nextUser.uid));
        if (snapshot.exists()) {
          const remote = snapshot.data();
          delete remote.updatedAt;
          delete remote.userId;
          delete remote.authProvider;
          setProgress({ ...createInitialProgress(), ...remote });
        }
        setSyncError(false);
      } catch (error) {
        console.error('[progress] no se pudo leer Firestore', error);
        setSyncError(true);
      } finally {
        remoteLoaded.current = true;
      }
    });
  }, []);

  // Guardado: siempre en localStorage, y en Firestore cuando hay sesión.
  useEffect(() => {
    if (!hydrated) return undefined;
    writeLocal(progress);
    const fb = getFirebase();
    if (!fb || !user || !remoteLoaded.current) return undefined;
    const timer = setTimeout(async () => {
      try {
        await setDoc(
          doc(fb.db, 'progress', user.uid),
          {
            ...progress,
            userId: user.uid,
            authProvider: user.providerData[0]?.providerId ?? 'anonymous',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setSyncError(false);
      } catch (error) {
        console.error('[progress] no se pudo guardar en Firestore', error);
        setSyncError(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [progress, user, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem('contencion:settings', JSON.stringify(settings));
    } catch {
      // Sin almacenamiento: la preferencia dura hasta recargar.
    }
  }, [settings, hydrated]);

  // El indicador siempre informa el estado real, nunca el de la ficción.
  let persistence = 'local';
  if (!online) persistence = 'offline';
  else if (user && !syncError) persistence = 'nube';

  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Devuelve el resultado en el momento para dar feedback inmediato en la escena.
  const peelSeal = useCallback((caseId, sealId, careful) => {
    const prev = progressRef.current;
    const data = CASES.find((c) => c.id === caseId);
    const current = prev.cases[caseId];
    if (!data || !current || current.seals[sealId]?.peeled) return null;
    const expected = data.order.find((id) => !current.seals[id].peeled);
    const outOfOrder = expected !== sealId;
    const ripped = !careful;
    const leakGain = (outOfOrder ? 1 : 0) + (ripped ? 1 : 0);
    const reasons = [outOfOrder && 'fuera de orden', ripped && 'arrancado'].filter(Boolean).join(', ');
    const next = {
      ...prev,
      leak: prev.leak + leakGain,
      log: [...prev.log, { at: stamp(), text: `EXP-${caseId} · ${sealId} retirado${reasons ? ` (${reasons})` : ''}` }],
      cases: {
        ...prev.cases,
        [caseId]: {
          ...current,
          seals: { ...current.seals, [sealId]: { ...current.seals[sealId], peeled: true, ripped } },
        },
      },
    };
    progressRef.current = next;
    setProgress(next);
    return { outOfOrder, ripped, leakGain };
  }, []);

  // Registrar un estado que no coincide con el sello real deja el objeto mal resellado:
  // se filtra energía. Devuelve el resultado para avisarlo en el momento.
  const markSeal = useCallback((caseId, sealId, state) => {
    const prev = progressRef.current;
    const current = prev.cases[caseId];
    const seal = CASES.find((c) => c.id === caseId)?.seals.find((s) => s.id === sealId);
    if (!seal || !current?.seals[sealId]?.peeled || current.seals[sealId].state) return null;
    const mismatch = Boolean(seal.condition) && seal.condition !== state;
    const next = {
      ...prev,
      leak: prev.leak + (mismatch ? 1 : 0),
      log: [...prev.log, { at: stamp(), text: `EXP-${caseId} · ${sealId} registrado: ${state}${mismatch ? ' (no coincide)' : ''}` }],
      cases: {
        ...prev.cases,
        [caseId]: { ...current, seals: { ...current.seals, [sealId]: { ...current.seals[sealId], state } } },
      },
    };
    progressRef.current = next;
    setProgress(next);
    return { mismatch, actual: seal.condition };
  }, []);

  const findMemory = useCallback((memoryId) => {
    setProgress((prev) =>
      prev.memory.includes(memoryId)
        ? prev
        : { ...prev, memory: [...prev.memory, memoryId], log: [...prev.log, { at: stamp(), text: `Detalle registrado: ${memoryId}` }] },
    );
  }, []);

  const archiveCase = useCallback((caseId) => {
    setProgress((prev) => ({
      ...prev,
      log: [...prev.log, { at: stamp(), text: `EXP-${caseId} archivado` }],
      cases: { ...prev.cases, [caseId]: { ...prev.cases[caseId], archived: true } },
    }));
  }, []);

  const decide = useCallback((key, value) => {
    setProgress((prev) => ({ ...prev, decisions: { ...prev.decisions, [key]: value } }));
  }, []);

  const finish = useCallback((endingId) => {
    setProgress((prev) => ({
      ...prev,
      ending: endingId,
      endingsUnlocked: prev.endingsUnlocked.includes(endingId) ? prev.endingsUnlocked : [...prev.endingsUnlocked, endingId],
    }));
  }, []);

  const resetRun = useCallback(() => {
    setProgress((prev) => createInitialProgress(prev.endingsUnlocked));
  }, []);

  const auth = useMemo(() => {
    const fb = getFirebase();
    return {
      anonymous: () => signInAnonymously(fb.auth),
      google: () => signInWithPopup(fb.auth, new GoogleAuthProvider()),
      emailSignIn: (email, password) => signInWithEmailAndPassword(fb.auth, email, password),
      emailSignUp: (email, password) => createUserWithEmailAndPassword(fb.auth, email, password),
      signOut: () => firebaseSignOut(fb.auth),
      enterLocal: (name) => {
        const clean = name?.trim() || null;
        setLocalName(clean);
        try {
          if (clean) window.localStorage.setItem(LOCAL_OPERATOR_KEY, clean);
        } catch {
          // Sin almacenamiento: el nombre dura hasta recargar.
        }
      },
    };
  }, []);

  const archivedCount = CASES.filter((c) => progress.cases[c.id]?.archived).length;
  const corruption = getCorruption(progress);

  const value = {
    progress,
    hydrated,
    authReady,
    user,
    signedIn: Boolean(user) || (!firebaseEnabled && Boolean(localName)),
    operator: formatOperator(user, localName),
    persistence,
    firebaseEnabled,
    influence: archivedCount,
    corruption,
    settings,
    setSettings,
    peelSeal,
    markSeal,
    findMemory,
    archiveCase,
    decide,
    finish,
    resetRun,
    auth,
  };

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress debe usarse dentro de ProgressProvider');
  return value;
}

export function isCaseUnlocked(progress, caseId) {
  if (caseId === '00') return CASES.every((c) => progress.cases[c.id]?.archived);
  const index = CASES.findIndex((c) => c.id === caseId);
  if (index <= 0) return index === 0;
  return Boolean(progress.cases[CASES[index - 1].id]?.archived);
}

/**
 * Corrupción de la bóveda, de 0 a 1: cuánto se despertó la energía de Sukuna.
 * Cada dedo pesa lo mismo: sube con cada sello retirado y termina de contar al archivarlo.
 * El residuo (sellos arrancados o retirados fuera de orden) la empuja un poco más.
 */
export function getCorruption(progress) {
  const inspected = CASES.reduce((sum, c) => {
    const state = progress.cases[c.id];
    if (state?.archived) return sum + 1;
    const peeled = c.seals.filter((s) => state?.seals?.[s.id]?.peeled).length;
    return sum + (peeled / c.seals.length) * 0.7;
  }, 0) / CASES.length;
  const residue = Math.min(progress.leak ?? 0, 6) / 6;
  return Math.min(1, inspected * 0.85 + residue * 0.15);
}
