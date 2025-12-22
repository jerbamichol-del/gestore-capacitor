import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

/**
 * Hook per usare la Camera nativa di Capacitor
 * Compatibile con PWA (fallback a input file)
 */
export const useCamera = () => {
  const isNative = Capacitor.isNativePlatform();

  const takePicture = async (): Promise<string | null> => {
    try {
      if (isNative) {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        return image.dataUrl || null;
      } else {
        // Fallback PWA: usa input file
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            } else {
              resolve(null);
            }
          };
          input.click();
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  };

  const selectFromGallery = async (): Promise<string | null> => {
    try {
      if (isNative) {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos
        });
        return image.dataUrl || null;
      } else {
        // Fallback PWA
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            } else {
              resolve(null);
            }
          };
          input.click();
        });
      }
    } catch (error) {
      console.error('Gallery error:', error);
      return null;
    }
  };

  return { takePicture, selectFromGallery, isNative };
};

/**
 * Hook per feedback tattile (haptics)
 */
export const useHaptics = () => {
  const isNative = Capacitor.isNativePlatform();

  const impact = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isNative) return;
    try {
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      };
      await Haptics.impact({ style: styleMap[style] });
    } catch (error) {
      console.error('Haptics error:', error);
    }
  };

  const vibrate = async (duration: number = 100) => {
    if (!isNative) {
      // Fallback PWA
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
      }
      return;
    }
    try {
      await Haptics.vibrate({ duration });
    } catch (error) {
      console.error('Vibrate error:', error);
    }
  };

  const notification = async () => {
    if (!isNative) return;
    try {
      await Haptics.notification();
    } catch (error) {
      console.error('Notification haptics error:', error);
    }
  };

  return { impact, vibrate, notification, isNative };
};

/**
 * Hook per gestire il pulsante back di Android
 */
export const useBackButton = (handler: () => boolean | void) => {
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;

    const backButtonListener = App.addListener('backButton', () => {
      const shouldExit = handler();
      if (shouldExit) {
        App.exitApp();
      }
    });

    return () => {
      backButtonListener.then(listener => listener.remove());
    };
  }, [handler, isNative]);
};

/**
 * Hook per rilevare se l'app è nativa o PWA
 */
export const useIsNative = () => {
  return Capacitor.isNativePlatform();
};
