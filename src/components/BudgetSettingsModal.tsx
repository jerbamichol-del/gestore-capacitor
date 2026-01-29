import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Budgets } from '../types';
import { CategoryService } from '../services/category-service'; // ✅ Import
import { XMarkIcon, CheckCircleIcon } from './icons';
import { getCategoryStyle } from '../utils/categoryStyles';

interface BudgetSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (budgets: Budgets) => void;
    currentBudgets: Budgets;
}

const BudgetSettingsModal: React.FC<BudgetSettingsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentBudgets,
}) => {
    const [localBudgets, setLocalBudgets] = useState<Budgets>(currentBudgets);
    const [categoriesList, setCategoriesList] = useState<any[]>([]);

    useEffect(() => {
        const load = () => setCategoriesList(CategoryService.getCategories());
        load();
        window.addEventListener('categories-updated', load);
        return () => window.removeEventListener('categories-updated', load);
    }, []);

    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalBudgets(currentBudgets);
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsAnimating(false);
        }
    }, [isOpen, currentBudgets]);

    const handleInputChange = (category: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setLocalBudgets(prev => ({
            ...prev,
            [category]: numValue
        }));
    };

    const handleSave = () => {
        onSave(localBudgets);
        onClose();
    };

    if (!isOpen) return null;

    const categories = categoriesList.map(c => c.name);

    return createPortal(
        <div
            className={`fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-midnight rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all duration-300 flex flex-col max-h-[90vh] ${isAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Imposta Budget Mensili</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                    {/* Total Budget */}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">🌍</span>
                            <label className="text-base font-bold text-indigo-900 dark:text-indigo-300">Budget Mensile Totale</label>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-bold">€</span>
                            <input
                                type="number"
                                value={localBudgets['total'] || ''}
                                onChange={e => handleInputChange('total', e.target.value)}
                                placeholder="Nessun limite"
                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-midnight-card text-lg font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 opacity-60">Limiti per Categoria</label>
                        {categories.map(cat => {
                            const style = getCategoryStyle(cat);
                            const Icon = style.Icon;
                            return (
                                <div key={cat} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 group hover:border-indigo-200 dark:hover:border-electric-violet/30 transition-colors">
                                    <div className={`p-2 rounded-xl ${style.bgColor} ${style.color}`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{cat}</p>
                                    </div>
                                    <div className="relative w-32">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">€</span>
                                        <input
                                            type="number"
                                            value={localBudgets[cat] || ''}
                                            onChange={e => handleInputChange(cat, e.target.value)}
                                            placeholder="∞"
                                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-midnight-card text-right font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex-shrink-0">
                    <button
                        onClick={handleSave}
                        className="w-full py-3 rounded-xl bg-indigo-600 dark:btn-electric text-white font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        Salva Budget
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BudgetSettingsModal;
