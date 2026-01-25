import React from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckIcon } from './icons/CheckIcon';
import { useTheme, AccentTheme } from '../hooks/useTheme';

interface ThemePickerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ThemePreset {
    id: AccentTheme;
    name: string;
    colors: {
        bg: string;
        card: string;
        accent: string;
        accentGradient: string;
    };
    isDark: boolean;
}

const THEME_PRESETS: ThemePreset[] = [
    // Light Themes
    {
        id: 'mint-garden',
        name: 'Mint Garden',
        isDark: false,
        colors: {
            bg: '#F2F4F2',
            card: '#FFFFFF',
            accent: '#2D5A27',
            accentGradient: 'linear-gradient(135deg, #2D5A27, #3A7D34)',
        },
    },
    {
        id: 'ocean-breeze',
        name: 'Ocean Breeze',
        isDark: false,
        colors: {
            bg: '#f0f9ff',
            card: '#FFFFFF',
            accent: '#0284c7',
            accentGradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
        },
    },
    {
        id: 'sunset-coral',
        name: 'Sunset Coral',
        isDark: false,
        colors: {
            bg: '#fff7ed',
            card: '#FFFFFF',
            accent: '#f97316',
            accentGradient: 'linear-gradient(135deg, #f97316, #fb923c)',
        },
    },
    {
        id: 'royal-gold',
        name: 'Royal Gold',
        isDark: false,
        colors: {
            bg: '#fefce8',
            card: '#FFFFFF',
            accent: '#ca8a04',
            accentGradient: 'linear-gradient(135deg, #ca8a04, #fbbf24)',
        },
    },
    // Dark Themes
    {
        id: 'midnight-electric',
        name: 'Midnight Electric',
        isDark: true,
        colors: {
            bg: '#0F172A',
            card: '#1E293B',
            accent: '#A855F7',
            accentGradient: 'linear-gradient(135deg, #A855F7, #EC4899)',
        },
    },
    {
        id: 'cyber-neon',
        name: 'Cyber Neon',
        isDark: true,
        colors: {
            bg: '#0c0a09',
            card: '#1c1917',
            accent: '#22d3ee',
            accentGradient: 'linear-gradient(135deg, #22d3ee, #a5f3fc)',
        },
    },
    {
        id: 'deep-ocean',
        name: 'Deep Ocean',
        isDark: true,
        colors: {
            bg: '#020617',
            card: '#0f172a',
            accent: '#3b82f6',
            accentGradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
        },
    },
    {
        id: 'dark-forest',
        name: 'Dark Forest',
        isDark: true,
        colors: {
            bg: '#052e16',
            card: '#14532d',
            accent: '#22c55e',
            accentGradient: 'linear-gradient(135deg, #22c55e, #4ade80)',
        },
    },
];

const ThemeCard: React.FC<{
    preset: ThemePreset;
    isSelected: boolean;
    onClick: () => void;
}> = ({ preset, isSelected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 transition-all duration-200 ${isSelected
                    ? 'border-indigo-500 dark:border-electric-violet ring-2 ring-indigo-500/30 dark:ring-electric-violet/30 scale-[1.02]'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            style={{ backgroundColor: preset.colors.bg }}
        >
            {/* Mini Preview */}
            <div className="absolute inset-2 flex flex-col gap-1.5">
                {/* Header bar */}
                <div
                    className="h-3 rounded-full opacity-80"
                    style={{ background: preset.colors.accentGradient }}
                />
                {/* Card preview */}
                <div
                    className="flex-1 rounded-lg shadow-sm"
                    style={{ backgroundColor: preset.colors.card }}
                >
                    <div className="p-2 space-y-1.5">
                        <div
                            className="h-2 w-3/4 rounded-full opacity-60"
                            style={{ backgroundColor: preset.colors.accent }}
                        />
                        <div
                            className="h-1.5 w-1/2 rounded-full opacity-30"
                            style={{ backgroundColor: preset.isDark ? '#94a3b8' : '#64748b' }}
                        />
                    </div>
                </div>
                {/* Button preview */}
                <div
                    className="h-4 rounded-lg"
                    style={{ background: preset.colors.accentGradient }}
                />
            </div>

            {/* Theme Name */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                <p className="text-[10px] font-bold text-white text-center truncate">{preset.name}</p>
            </div>

            {/* Selected Checkmark */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 dark:bg-electric-violet flex items-center justify-center shadow-lg">
                    <CheckIcon className="w-4 h-4 text-white" />
                </div>
            )}
        </button>
    );
};

const ThemePicker: React.FC<ThemePickerProps> = ({ isOpen, onClose }) => {
    const { accent, setAccent, isDark } = useTheme();

    if (!isOpen) return null;

    const lightThemes = THEME_PRESETS.filter((t) => !t.isDark);
    const darkThemes = THEME_PRESETS.filter((t) => t.isDark);

    const handleSelectTheme = (preset: ThemePreset) => {
        setAccent(preset.id);
    };

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-white dark:bg-midnight transition-colors">
            {/* Header */}
            <div
                className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Scegli Tema</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <XMarkIcon className="w-6 h-6 text-slate-500" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Light Themes */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">☀️</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Temi Chiari</h3>
                        {!isDark && (
                            <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                Attivo
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {lightThemes.map((preset) => (
                            <ThemeCard
                                key={preset.id}
                                preset={preset}
                                isSelected={accent === preset.id}
                                onClick={() => handleSelectTheme(preset)}
                            />
                        ))}
                    </div>
                </div>

                {/* Dark Themes */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🌙</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Temi Scuri</h3>
                        {isDark && (
                            <span className="text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                Attivo
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {darkThemes.map((preset) => (
                            <ThemeCard
                                key={preset.id}
                                preset={preset}
                                isSelected={accent === preset.id}
                                onClick={() => handleSelectTheme(preset)}
                            />
                        ))}
                    </div>
                </div>

                {/* Info */}
                <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
                    <p>Il tema selezionato verrà applicato automaticamente.</p>
                    <p className="text-xs mt-1">Usa il toggle ☀️/🌙 nell'header per cambiare modalità.</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ThemePicker;
