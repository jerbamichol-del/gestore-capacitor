// services/biometrics.ts
// Biometria adattata per Capacitor: usa il plugin nativo invece di WebAuthn

import { Capacitor } from '@capacitor/core';
import NativeBiometric from 'capacitor-native-biometric';

const KEY_ENABLED = 'bio.enabled';
const KEY_OPTOUT = 'bio.optOut';
const KEY_SNOOZE = 'bio.snooze'; // sessionStorage

const isNative = Capacitor.isNativePlatform();

// ——— Snooze helpers ———
export function isBiometricSnoozed(): boolean {
  try {
    return sessionStorage.getItem(KEY_SNOOZE) === '1';
  } catch {
    return false;
  }
}

export function setBiometricSnooze(): void {
  try {
    sessionStorage.setItem(KEY_SNOOZE, '1');
  } catch {}
}

export function clearBiometricSnooze(): void {
  try {
    sessionStorage.removeItem(KEY_SNOOZE);
  } catch {}
}

export function canAutoPromptBiometric(): boolean {
  try {
    return (
      !isBiometricSnoozed() &&
      localStorage.getItem(KEY_ENABLED) === '1'
    );
  } catch {
    return false;
  }
}

// Supporto dispositivo
export async function isBiometricsAvailable(): Promise<boolean> {
  if (isNative) {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  // Fallback PWA/Browser (WebAuthn)
  if (!('PublicKeyCredential' in window)) return false;
  try {
    const ok = await (window as any).PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable?.();
    return !!ok;
  } catch {
    return false;
  }
}

// Stato locale
export function isBiometricsEnabled(): boolean {
  return localStorage.getItem(KEY_ENABLED) === '1';
}

// Opt-out prompt
export function isBiometricsOptedOut(): boolean {
  return localStorage.getItem(KEY_OPTOUT) === '1';
}

export function setBiometricsOptOut(v: boolean) {
  if (v) localStorage.setItem(KEY_OPTOUT, '1');
  else localStorage.removeItem(KEY_OPTOUT);
}

// Disabilita
export function disableBiometrics() {
  localStorage.removeItem(KEY_ENABLED);
  clearBiometricSnooze();
}

// Registra biometria
export async function registerBiometric(displayName = 'Utente'): Promise<boolean> {
  if (!(await isBiometricsAvailable())) {
    throw new Error('Biometria non disponibile su questo dispositivo');
  }

  if (isNative) {
    // Capacitor: verifica semplicemente che funzioni
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Abilita autenticazione biometrica',
        title: 'Gestore Spese',
        subtitle: 'Configurazione',
        description: displayName,
      });
      localStorage.setItem(KEY_ENABLED, '1');
      clearBiometricSnooze();
      setBiometricsOptOut(false);
      return true;
    } catch (err) {
      throw new Error('Registrazione biometrica annullata o fallita');
    }
  }

  // Fallback PWA: WebAuthn passkey (codice originale)
  const RP_ID = location.hostname;
  const toB64Url = (buf: ArrayBuffer) => {
    const b = String.fromCharCode(...new Uint8Array(buf));
    return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const fromB64Url = (s: string) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const arr = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
    return arr.buffer;
  };

  let userIdStr = localStorage.getItem('bio.userId');
  if (!userIdStr) {
    const rnd = crypto.getRandomValues(new Uint8Array(32));
    userIdStr = toB64Url(rnd.buffer);
    localStorage.setItem('bio.userId', userIdStr);
  }
  const userId = fromB64Url(userIdStr);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: 'Gestore Spese', id: RP_ID },
    user: {
      id: new Uint8Array(userId),
      name: 'local@gestore',
      displayName,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
  };

  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Creazione passkey annullata');

  const credIdB64 = toB64Url(cred.rawId);
  localStorage.setItem('bio.credId', credIdB64);
  localStorage.setItem(KEY_ENABLED, '1');
  clearBiometricSnooze();
  setBiometricsOptOut(false);
  return true;
}

// Sblocco
export async function unlockWithBiometric(reason = 'Sblocca Gestore Spese'): Promise<boolean> {
  if (!(await isBiometricsAvailable())) {
    throw new Error('Biometria non disponibile');
  }

  if (isNative) {
    // Capacitor: usa plugin nativo
    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Gestore Spese',
        subtitle: 'Autenticazione',
        description: reason,
      });
      clearBiometricSnooze();
      return true;
    } catch (e: any) {
      const name = String(e?.name || '');
      const msg = String(e?.message || '');
      // Annullo/timeout → snooze
      if (
        name === 'NotAllowedError' ||
        name === 'AbortError' ||
        /timeout/i.test(msg) ||
        /cancel/i.test(msg)
      ) {
        setBiometricSnooze();
      }
      throw e;
    }
  }

  // Fallback PWA: WebAuthn
  const credIdB64 = localStorage.getItem('bio.credId');
  if (!credIdB64) throw new Error('Biometria non configurata');

  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
  } catch {}

  const fromB64Url = (s: string) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const arr = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
    return arr.buffer;
  };

  const allowId = fromB64Url(credIdB64);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const RP_ID = location.hostname;

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: [{ id: new Uint8Array(allowId), type: 'public-key' }],
  };

  try {
    const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
    if (!assertion) {
      setBiometricSnooze();
      const err = new DOMException('User cancelled', 'NotAllowedError');
      throw err;
    }
    clearBiometricSnooze();
    return true;
  } catch (e: any) {
    const name = String(e?.name || '');
    const msg = String(e?.message || '');
    if (name === 'NotAllowedError' || name === 'AbortError' || /timeout/i.test(msg)) {
      setBiometricSnooze();
    }
    throw e;
  }
}

// Suggerire offerta attivazione?
export async function shouldOfferBiometricEnable(): Promise<boolean> {
  const supported = await isBiometricsAvailable();
  return supported && !isBiometricsEnabled() && !isBiometricsOptedOut();
}
