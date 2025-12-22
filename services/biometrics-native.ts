import { BiometricAuth } from '@capawesome/capacitor-biometric-authentication';
import { Capacitor } from '@capacitor/core';

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Check if biometric authentication is available on the device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to Web Crypto API for PWA
    return window.PublicKeyCredential !== undefined;
  }

  try {
    const result = await BiometricAuth.isAvailable();
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
    const result = await BiometricAuth.isAvailable();
    return result.biometryTypes || [];
  } catch (error) {
    console.error('Get biometric type failed:', error);
    return [];
  }
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
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Annulla',
      iosFallbackTitle: 'Usa codice',
      androidTitle: 'Autenticazione biometrica',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
      allowDeviceCredential: true, // Permette anche PIN/password
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
  const available = await isBiometricAvailable();
  
  if (!available) {
    return {
      success: false,
      error: 'Biometria non disponibile su questo dispositivo',
    };
  }

  // Test authentication
  return authenticateWithBiometrics('Configura autenticazione biometrica');
}
