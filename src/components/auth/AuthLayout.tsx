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
  <div
    className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-6 relative overflow-visible transition-colors"
  >
    {children}
  </div>
);

const Header: React.FC = () => (
  <div className="text-center relative z-10">
    <div
      className="mx-auto mb-3 w-[120px] h-[120px]"
    >
      <AppLogoIcon
        style={{ width: '100%', height: '100%' }}
        aria-label="Logo Gestore Spese"
      />
    </div>
    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 m-0 transition-colors">
      Gestore Spese
    </h1>
  </div>
);

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  useStableViewportHeight();
  const isStudio = useIsStudio();

  const mainContainerStyle: React.CSSProperties = {
    minHeight: 'calc(var(--vh, 1vh) * 100)',
    height: '100dvh',
    background: '#f1f5f9',
    fontFamily:
      'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif',
    WebkitTapHighlightColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
    overflow: 'auto', // Allow scrolling on small viewports
  };

  if (isStudio) {
    // FIX: Use type assertion as 'position' and 'inset' might not be recognized
    // by the version of TypeScript or React types used in this environment.
    (mainContainerStyle as any).position = 'fixed';
    (mainContainerStyle as any).inset = 0;
  }

  return (
    <div
      style={mainContainerStyle}
      className="bg-slate-100 dark:bg-slate-950 transition-colors"
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center', // Centrato verticalmente
          justifyContent: 'center',
          overflow: 'visible',
          position: 'relative',
        }}
      >
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <Header />
          </div>
          <Card>{children}</Card>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
