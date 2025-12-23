// services/biometrics-native.ts
// Servizio nativo per autenticazione biometrica su Android/iOS con Capacitor

import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';

export interface BiometricsResult {
  success: boolean;
  error?: string;
}

/**
 * Verifica se il dispositivo supporta l'autenticazione biometrica
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (error) {
    console.error('Error checking biometrics availability:', error);
    return false;
  }
}

/**
 * Ottiene il tipo di biometria disponibile sul dispositivo
 */
export async function getBiometryType(): Promise<BiometryType | null> {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.biometryType || null;
  } catch (error) {
    console.error('Error getting biometry type:', error);
    return null;
  }
}

/**
 * Richiede l'autenticazione biometrica all'utente
 */
export async function authenticateWithBiometrics(
  reason: string = 'Accedi con la tua impronta digitale o riconoscimento facciale'
): Promise<BiometricsResult> {
  try {
    // Verifica disponibilità
    const available = await isBiometricsAvailable();
    if (!available) {
      return {
        success: false,
        error: 'Autenticazione biometrica non disponibile su questo dispositivo'
      };
    }

    // Richiedi autenticazione
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Autenticazione',
      subtitle: 'Gestore Spese',
      description: reason,
      // Solo fingerprint su Android, face recognition su iOS
      useFallback: false,
      maxAttempts: 3
    });

    return { success: true };
  } catch (error: any) {
    console.error('Biometric authentication error:', error);
    
    // Gestisci errori specifici
    if (error?.code === 10) {
      return { success: false, error: 'Autenticazione annullata' };
    } else if (error?.code === 13) {
      return { success: false, error: 'Troppi tentativi falliti' };
    }
    
    return {
      success: false,
      error: error?.message || 'Autenticazione fallita'
    };
  }
}

/**
 * Salva le credenziali in modo sicuro (per uso futuro)
 */
export async function saveCredentials(server: string, username: string, password: string): Promise<boolean> {
  try {
    await NativeBiometric.setCredentials({
      username,
      password,
      server
    });
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
}

/**
 * Recupera le credenziali salvate (per uso futuro)
 */
export async function getCredentials(server: string): Promise<{ username: string; password: string } | null> {
  try {
    const credentials = await NativeBiometric.getCredentials({ server });
    return credentials;
  } catch (error) {
    console.error('Error getting credentials:', error);
    return null;
  }
}

/**
 * Elimina le credenziali salvate (per uso futuro)
 */
export async function deleteCredentials(server: string): Promise<boolean> {
  try {
    await NativeBiometric.deleteCredentials({ server });
    return true;
  } catch (error) {
    console.error('Error deleting credentials:', error);
    return false;
  }
}
