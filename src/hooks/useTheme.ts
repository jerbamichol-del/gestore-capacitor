import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as Theme) || 'system';
        }
        return 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        // Also toggle body for some specific smooth transitions if needed, but root is standard for Tailwind
        const body = window.document.body;

        const applyTheme = (targetTheme: 'dark' | 'light') => {
            if (targetTheme === 'dark') {
                root.classList.add('dark');
                // Optional: Sync body class if not fully using inheritance
            } else {
                root.classList.remove('dark');
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
            return 'light'; // system -> light
        });
    };

    return { theme, setTheme, toggleTheme };
}
