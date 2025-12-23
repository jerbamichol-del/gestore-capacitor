import { Capacitor } from '@capacitor/core';
import NativeBiometric from 'capacitor-native-biometric';

interface BiometricResult {
  verified: boolean;
  error?: string;
}

export const useBiometric = () => {
  const isNative = Capacitor.isNativePlatform();

  /**
   * Verifica se la biometria è disponibile sul dispositivo
   */
  const isAvailable = async (): Promise<boolean> => {
    if (!isNative) return false;
    
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch (error) {
      console.error('Biometric check error:', error);
      return false;
    }
  };

  /**
   * Verifica l'identità dell'utente con biometria
   */
  const verify = async (reason: string = 'Verifica la tua identità'): Promise<BiometricResult> => {
    if (!isNative) {
      return { verified: false, error: 'Biometria non disponibile su browser' };
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Autenticazione',
        subtitle: 'Gestore Spese',
        description: reason,
      });
      return { verified: true };
    } catch (error: any) {
      console.error('Biometric verification error:', error);
      return { 
        verified: false, 
        error: error.message || 'Verifica biometrica fallita'
      };
    }
  };

  /**
   * Salva credenziali con biometria (opzionale, per login)
   */
  const setCredentials = async (username: string, password: string): Promise<boolean> => {
    if (!isNative) return false;

    try {
      await NativeBiometric.setCredentials({
        username,
        password,
        server: 'com.gestore.spese',
      });
      return true;
    } catch (error) {
      console.error('Set credentials error:', error);
      return false;
    }
  };

  /**
   * Recupera credenziali salvate
   */
  const getCredentials = async (): Promise<{ username: string; password: string } | null> => {
    if (!isNative) return null;

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: 'com.gestore.spese',
      });
      return credentials;
    } catch (error) {
      console.error('Get credentials error:', error);
      return null;
    }
  };

  /**
   * Elimina credenziali salvate
   */
  const deleteCredentials = async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      await NativeBiometric.deleteCredentials({
        server: 'com.gestore.spese',
      });
      return true;
    } catch (error) {
      console.error('Delete credentials error:', error);
      return false;
    }
  };

  return {
    isAvailable,
    verify,
    setCredentials,
    getCredentials,
    deleteCredentials,
    isNative,
  };
};
