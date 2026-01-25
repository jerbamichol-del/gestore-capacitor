import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export type AccentTheme =
    // Light variants
    | 'mint-garden'
    | 'ocean-breeze'
    | 'sunset-coral'
    | 'royal-gold'
    // Dark variants
    | 'midnight-electric'
    | 'cyber-neon'
    | 'deep-ocean'
    | 'dark-forest';

interface ThemeContextType {
    mode: ThemeMode;
    accent: AccentTheme;
    setMode: (mode: ThemeMode) => void;
    setAccent: (accent: AccentTheme) => void;
    toggleTheme: () => void;
    isDark: boolean;
    // Legacy compatibility
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

// Default accents for each mode
const DEFAULT_LIGHT_ACCENT: AccentTheme = 'mint-garden';
const DEFAULT_DARK_ACCENT: AccentTheme = 'midnight-electric';

// Theme presets with CSS variables
const ACCENT_CSS_VARS: Record<AccentTheme, Record<string, string>> = {
    // Light Themes
    'mint-garden': {
        '--accent-primary': '#2D5A27',
        '--accent-gradient': 'linear-gradient(135deg, #2D5A27, #3A7D34)',
        '--accent-bg': '#F2F4F2',
        '--accent-card': '#FFFFFF',
        '--accent-border': 'rgba(45, 90, 39, 0.08)',
        '--accent-shadow': 'rgba(45, 90, 39, 0.05)',
    },
    'ocean-breeze': {
        '--accent-primary': '#0284c7',
        '--accent-gradient': 'linear-gradient(135deg, #0284c7, #38bdf8)',
        '--accent-bg': '#f0f9ff',
        '--accent-card': '#FFFFFF',
        '--accent-border': 'rgba(2, 132, 199, 0.08)',
        '--accent-shadow': 'rgba(2, 132, 199, 0.05)',
    },
    'sunset-coral': {
        '--accent-primary': '#f97316',
        '--accent-gradient': 'linear-gradient(135deg, #f97316, #fb923c)',
        '--accent-bg': '#fff7ed',
        '--accent-card': '#FFFFFF',
        '--accent-border': 'rgba(249, 115, 22, 0.08)',
        '--accent-shadow': 'rgba(249, 115, 22, 0.05)',
    },
    'royal-gold': {
        '--accent-primary': '#ca8a04',
        '--accent-gradient': 'linear-gradient(135deg, #ca8a04, #fbbf24)',
        '--accent-bg': '#fefce8',
        '--accent-card': '#FFFFFF',
        '--accent-border': 'rgba(202, 138, 4, 0.08)',
        '--accent-shadow': 'rgba(202, 138, 4, 0.05)',
    },
    // Dark Themes
    'midnight-electric': {
        '--accent-primary': '#A855F7',
        '--accent-gradient': 'linear-gradient(135deg, #A855F7, #EC4899)',
        '--accent-bg': '#0F172A',
        '--accent-card': '#1E293B',
        '--accent-border': 'rgba(168, 85, 247, 0.3)',
        '--accent-shadow': 'rgba(0, 0, 0, 0.37)',
    },
    'cyber-neon': {
        '--accent-primary': '#22d3ee',
        '--accent-gradient': 'linear-gradient(135deg, #22d3ee, #a5f3fc)',
        '--accent-bg': '#0c0a09',
        '--accent-card': '#1c1917',
        '--accent-border': 'rgba(34, 211, 238, 0.3)',
        '--accent-shadow': 'rgba(0, 0, 0, 0.4)',
    },
    'deep-ocean': {
        '--accent-primary': '#3b82f6',
        '--accent-gradient': 'linear-gradient(135deg, #3b82f6, #60a5fa)',
        '--accent-bg': '#020617',
        '--accent-card': '#0f172a',
        '--accent-border': 'rgba(59, 130, 246, 0.3)',
        '--accent-shadow': 'rgba(0, 0, 0, 0.4)',
    },
    'dark-forest': {
        '--accent-primary': '#22c55e',
        '--accent-gradient': 'linear-gradient(135deg, #22c55e, #4ade80)',
        '--accent-bg': '#052e16',
        '--accent-card': '#14532d',
        '--accent-border': 'rgba(34, 197, 94, 0.3)',
        '--accent-shadow': 'rgba(0, 0, 0, 0.4)',
    },
};

// Check if an accent is for dark mode
const isDarkAccent = (accent: AccentTheme): boolean => {
    return ['midnight-electric', 'cyber-neon', 'deep-ocean', 'dark-forest'].includes(accent);
};

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
    const [mode, setMode] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as ThemeMode) || 'system';
        }
        return 'system';
    });

    const [lightAccent, setLightAccent] = useState<AccentTheme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('accent_light') as AccentTheme) || DEFAULT_LIGHT_ACCENT;
        }
        return DEFAULT_LIGHT_ACCENT;
    });

    const [darkAccent, setDarkAccent] = useState<AccentTheme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('accent_dark') as AccentTheme) || DEFAULT_DARK_ACCENT;
        }
        return DEFAULT_DARK_ACCENT;
    });

    const [isDark, setIsDark] = useState(false);

    // Apply theme and CSS variables
    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (targetMode: 'dark' | 'light') => {
            const currentAccent = targetMode === 'dark' ? darkAccent : lightAccent;
            const cssVars = ACCENT_CSS_VARS[currentAccent];

            // Apply dark/light class
            if (targetMode === 'dark') {
                root.classList.add('dark');
                setIsDark(true);
            } else {
                root.classList.remove('dark');
                setIsDark(false);
            }

            // Apply CSS variables
            root.setAttribute('data-accent', currentAccent);
            Object.entries(cssVars).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });

            // Apply body background
            document.body.style.backgroundColor = cssVars['--accent-bg'];
        };

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleSystemChange = (e: MediaQueryListEvent) => {
            if (mode === 'system') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleSystemChange);

        if (mode === 'system') {
            applyTheme(mediaQuery.matches ? 'dark' : 'light');
        } else {
            applyTheme(mode);
        }

        localStorage.setItem('theme', mode);

        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [mode, lightAccent, darkAccent]);

    // Save accent preferences
    useEffect(() => {
        localStorage.setItem('accent_light', lightAccent);
    }, [lightAccent]);

    useEffect(() => {
        localStorage.setItem('accent_dark', darkAccent);
    }, [darkAccent]);

    const toggleTheme = () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const setAccent = (accent: AccentTheme) => {
        if (isDarkAccent(accent)) {
            setDarkAccent(accent);
            // If currently in light mode, switch to dark to show the selected theme
            if (!isDark) {
                setMode('dark');
            }
        } else {
            setLightAccent(accent);
            // If currently in dark mode, switch to light to show the selected theme
            if (isDark) {
                setMode('light');
            }
        }
    };

    // Get current active accent based on mode
    const currentAccent = isDark ? darkAccent : lightAccent;

    const value: ThemeContextType = {
        mode,
        accent: currentAccent,
        setMode,
        setAccent,
        toggleTheme,
        isDark,
        // Legacy compatibility
        theme: mode,
        setTheme: setMode,
    };

    return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
