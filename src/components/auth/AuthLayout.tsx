import React from 'react';
import { AppLogoIcon } from '../icons/AppLogoIcon';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/** Imposta --vh per altezze corrette su mobile e in iframe */
const useStableViewportHeight = () => {
  React.useEffect(() => {
    const setVH = () => {
      const h = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
      document.documentElement.style.setProperty('--vh', `${h}px`);
    };
    setVH();
    addEventListener('resize', setVH);
    addEventListener('orientationchange', setVH);
    window.visualViewport?.addEventListener('resize', setVH);
    return () => {
      removeEventListener('resize', setVH);
      removeEventListener('orientationchange', setVH);
      window.visualViewport?.removeEventListener('resize', setVH);
    };
  }, []);
};

/** Rileva se siamo in iframe (AI Studio). Forzabile via ?studio=1 o window.__FORCE_STUDIO__ */
const useIsStudio = () => {
  const [isStudio, setIsStudio] = React.useState<boolean>(false);
  React.useEffect(() => {
    let forced =
      (typeof (window as any).__FORCE_STUDIO__ === 'boolean' && (window as any).__FORCE_STUDIO__) ||
      new URLSearchParams(location.search).has('studio');

    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true; // cross-origin → presumiamo iframe
    }
    setIsStudio(forced || inIframe);
  }, []);
  return isStudio;
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="midnight-card p-6 rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.12)] border border-transparent dark:border-electric-violet/30 relative overflow-visible opacity-100 transition-colors duration-300">
    {children}
  </div>
);

const Header: React.FC = () => (
  <div className="text-center">
    <div className="mx-auto mb-3 w-[120px] h-[120px]">
      <AppLogoIcon
        style={{ width: '100%', height: '100%' }}
        aria-label="Logo Gestore Spese"
      />
    </div>
    <h1 className="text-[28px] font-extrabold text-sunset-text dark:text-white m-0 transition-colors">
      Gestore Spese
    </h1>
  </div>
);

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  useStableViewportHeight();
  const isStudio = useIsStudio();

  // Used only for dynamic height calculation that tailwind doesn't easily support with --vh
  const heightStyle: React.CSSProperties = {
    minHeight: 'calc(var(--vh, 1vh) * 100)',
    height: '100dvh',
  };

  const containerStyle = {
    ...heightStyle,
    ...(isStudio ? { position: 'fixed', inset: 0 } : {})
  } as React.CSSProperties;

  return (
    <div
      style={containerStyle}
      className="bg-[var(--sunset-cream, #FFF8F0)] dark:bg-midnight font-sans flex flex-col p-4 overflow-auto overflow-x-hidden touch-manipulation transition-colors duration-300"
    >
      <div className="flex flex-1 items-center justify-center relative overflow-visible">
        <div className="w-full max-w-[480px]">
          <div className="flex flex-col items-center mb-8">
            <Header />
          </div>
          <Card>{children}</Card>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
