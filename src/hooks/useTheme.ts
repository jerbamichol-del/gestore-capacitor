import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as Theme) || 'system';
        }
        return 'system';
    });

    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;

        const applyTheme = (targetTheme: 'dark' | 'light') => {
            if (targetTheme === 'dark') {
                root.classList.add('dark');
                setIsDark(true);
            } else {
                root.classList.remove('dark');
                setIsDark(false);
            }
        };

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleSystemChange = (e: MediaQueryListEvent) => {
            if (theme === 'system') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleSystemChange);

        if (theme === 'system') {
            applyTheme(mediaQuery.matches ? 'dark' : 'light');
        } else {
            applyTheme(theme);
        }

        localStorage.setItem('theme', theme);

        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'system';
            return 'light';
        });
    };

    const value: ThemeContextType = { theme, setTheme, toggleTheme, isDark };

    return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
