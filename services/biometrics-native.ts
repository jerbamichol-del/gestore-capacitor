import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export interface BiometricResult {
  success: boolean;
  error?: string;
}

// Funzioni helper per snooze (manteniamo compatibilità con codice esistente)
const BIO_SNOOZE_KEY = 'bio.snooze';
export const isBiometricSnoozed = () => {
  try {
    return sessionStorage.getItem(BIO_SNOOZE_KEY) === '1';
  } catch {
    return false;
  }
};

export const setBiometricSnooze = () => {
  try {
    sessionStorage.setItem(BIO_SNOOZE_KEY, '1');
  } catch {}
};

export const clearBiometricSnooze = () => {
  try {
    sessionStorage.removeItem(BIO_SNOOZE_KEY);
  } catch {}
};

/**
 * Check if biometric authentication is available on the device
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to Web Crypto API for PWA
    return window.PublicKeyCredential !== undefined;
  }

  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (error) {
    console.error('Biometric availability check failed:', error);
    return false;
  }
}

/**
 * Get supported biometric types
 */
export async function getBiometricType(): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) {
    return ['fingerprint']; // Generic for web
  }

  try {
    const result = await NativeBiometric.isAvailable();
    const types: string[] = [];
    
    if (result.biometryType === BiometryType.FACE_ID) {
      types.push('faceId');
    } else if (result.biometryType === BiometryType.TOUCH_ID) {
      types.push('touchId');
    } else if (result.biometryType === BiometryType.FINGERPRINT) {
      types.push('fingerprint');
    }
    
    return types;
  } catch (error) {
    console.error('Get biometric type failed:', error);
    return [];
  }
}

/**
 * Check if biometrics is enabled (stored in localStorage)
 */
export function isBiometricsEnabled(): boolean {
  try {
    return localStorage.getItem('biometric_enabled') === '1';
  } catch {
    return false;
  }
}

/**
 * Enable biometrics (set flag in localStorage)
 */
export function enableBiometrics(): void {
  try {
    localStorage.setItem('biometric_enabled', '1');
  } catch {}
}

/**
 * Disable biometrics
 */
export function disableBiometrics(): void {
  try {
    localStorage.removeItem('biometric_enabled');
  } catch {}
}

/**
 * Set biometrics opt-out flag
 */
export function setBiometricsOptOut(optOut: boolean): void {
  try {
    if (optOut) {
      localStorage.setItem('biometric_opt_out', '1');
    } else {
      localStorage.removeItem('biometric_opt_out');
    }
  } catch {}
}

/**
 * Authenticate user with biometrics
 */
export async function authenticateWithBiometrics(
  reason: string = 'Conferma la tua identità'
): Promise<BiometricResult> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to Web Crypto API
    return authenticateWithWebCrypto(reason);
  }

  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Autenticazione',
      subtitle: reason,
      description: 'Usa la tua impronta o Face ID',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Biometric authentication failed:', error);
    return {
      success: false,
      error: error.message || 'Autenticazione fallita',
    };
  }
}

/**
 * Unlock with biometric (wrapper compatibile con codice esistente)
 */
export async function unlockWithBiometric(
  reason: string = 'Sblocca con impronta / FaceID'
): Promise<boolean> {
  const result = await authenticateWithBiometrics(reason);
  return result.success;
}

/**
 * Register biometric (abilita biometria)
 */
export async function registerBiometric(
  reason: string = 'Configura autenticazione biometrica'
): Promise<void> {
  const result = await authenticateWithBiometrics(reason);
  if (result.success) {
    enableBiometrics();
  } else {
    throw new Error(result.error || 'Registrazione fallita');
  }
}

/**
 * Fallback for PWA using Web Crypto API
 */
async function authenticateWithWebCrypto(
  reason: string
): Promise<BiometricResult> {
  try {
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: new Uint8Array(32),
      timeout: 60000,
      userVerification: 'required',
    };

    await navigator.credentials.get({ publicKey });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Autenticazione web fallita',
    };
  }
}

/**
 * Setup biometric authentication (enrollment)
 */
export async function setupBiometric(): Promise<BiometricResult> {
  const available = await isBiometricsAvailable();
  
  if (!available) {
    return {
      success: false,
      error: 'Biometria non disponibile su questo dispositivo',
    };
  }

  // Test authentication
  return authenticateWithBiometrics('Configura autenticazione biometrica');
}
