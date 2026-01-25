import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from './icons/formatters';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { createPortal } from 'react-dom';

export interface SavingsGoal {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline?: string; // YYYY-MM-DD
    color: string;
    createdAt: string;
}

interface SavingsGoalsCardProps {
    totalBalance: number; // Current total balance from accounts
}

const STORAGE_KEY = 'savings_goals';
const GOAL_COLORS = [
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#EF4444', // Red
];

const loadGoals = (): SavingsGoal[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

const saveGoals = (goals: SavingsGoal[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
};

const SavingsGoalsCard: React.FC<SavingsGoalsCardProps> = ({ totalBalance }) => {
    const [goals, setGoals] = useState<SavingsGoal[]>(loadGoals);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalAnimating, setIsModalAnimating] = useState(false);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [currentAmount, setCurrentAmount] = useState('');
    const [deadline, setDeadline] = useState('');
    const [selectedColor, setSelectedColor] = useState(GOAL_COLORS[0]);

    useEffect(() => {
        saveGoals(goals);
    }, [goals]);

    useEffect(() => {
        if (isModalOpen) {
            const t = setTimeout(() => setIsModalAnimating(true), 10);
            return () => clearTimeout(t);
        } else {
            setIsModalAnimating(false);
        }
    }, [isModalOpen]);

    const openAddModal = () => {
        setEditingGoal(null);
        setName('');
        setTargetAmount('');
        setCurrentAmount('');
        setDeadline('');
        setSelectedColor(GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)]);
        setIsModalOpen(true);
    };

    const openEditModal = (goal: SavingsGoal) => {
        setEditingGoal(goal);
        setName(goal.name);
        setTargetAmount(goal.targetAmount.toString());
        setCurrentAmount(goal.currentAmount.toString());
        setDeadline(goal.deadline || '');
        setSelectedColor(goal.color);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        const target = parseFloat(targetAmount.replace(',', '.'));
        const current = parseFloat(currentAmount.replace(',', '.')) || 0;

        if (!name.trim() || isNaN(target) || target <= 0) return;

        if (editingGoal) {
            setGoals(prev => prev.map(g =>
                g.id === editingGoal.id
                    ? { ...g, name: name.trim(), targetAmount: target, currentAmount: current, deadline: deadline || undefined, color: selectedColor }
                    : g
            ));
        } else {
            const newGoal: SavingsGoal = {
                id: `goal-${Date.now()}`,
                name: name.trim(),
                targetAmount: target,
                currentAmount: current,
                deadline: deadline || undefined,
                color: selectedColor,
                createdAt: new Date().toISOString(),
            };
            setGoals(prev => [...prev, newGoal]);
        }

        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        setGoals(prev => prev.filter(g => g.id !== id));
    };

    const handleAddToGoal = (goalId: string, amount: number) => {
        setGoals(prev => prev.map(g =>
            g.id === goalId
                ? { ...g, currentAmount: Math.min(g.currentAmount + amount, g.targetAmount) }
                : g
        ));
    };

    const totalSaved = useMemo(() =>
        goals.reduce((acc, g) => acc + g.currentAmount, 0),
        [goals]
    );

    const renderGoalItem = (goal: SavingsGoal) => {
        const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
        const isComplete = progress >= 100;
        const remaining = goal.targetAmount - goal.currentAmount;

        return (
            <div
                key={goal.id}
                className="relative p-4 rounded-xl bg-sunset-cream/50 dark:bg-slate-800/50 border border-slate-200 dark:border-electric-violet/20 transition-all hover:shadow-md cursor-pointer group"
                onClick={() => openEditModal(goal)}
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                            style={{ backgroundColor: goal.color }}
                        >
                            {isComplete ? <CheckCircleIcon className="w-6 h-6" /> : goal.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white">{goal.name}</h4>
                            {goal.deadline && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Scadenza: {new Date(goal.deadline).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(goal.id); }}
                        className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Elimina obiettivo"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="mb-2">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                            {formatCurrency(goal.currentAmount)}
                        </span>
                        <span className="text-sm font-bold" style={{ color: goal.color }}>
                            {formatCurrency(goal.targetAmount)}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                                width: `${progress}%`,
                                backgroundColor: goal.color,
                                boxShadow: isComplete ? `0 0 12px ${goal.color}` : 'none'
                            }}
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className={`font-medium ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {isComplete ? '🎉 Obiettivo raggiunto!' : `Mancano ${formatCurrency(remaining)}`}
                    </span>
                    <span className="font-bold" style={{ color: goal.color }}>
                        {progress.toFixed(0)}%
                    </span>
                </div>

                {!isComplete && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-electric-violet/10 flex gap-2">
                        {[10, 50, 100].map(amount => (
                            <button
                                key={amount}
                                onClick={(e) => { e.stopPropagation(); handleAddToGoal(goal.id, amount); }}
                                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                +€{amount}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const modal = isModalOpen && createPortal(
        <div
            className={`fixed inset-0 z-[6000] flex justify-center items-center p-4 bg-midnight/60 backdrop-blur-md transition-opacity duration-300 ${isModalAnimating ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsModalOpen(false)}
        >
            <div
                className={`midnight-card rounded-2xl shadow-2xl w-full max-w-md border border-transparent dark:border-electric-violet/30 transform transition-all duration-300 ${isModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b dark:border-slate-800">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                            {editingGoal ? 'Modifica Obiettivo' : 'Nuovo Obiettivo'}
                        </h2>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <XMarkIcon className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome obiettivo</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Es. Vacanza estiva, iPhone..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Obiettivo (€)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                placeholder="1000"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Già risparmiato (€)</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={currentAmount}
                                onChange={(e) => setCurrentAmount(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scadenza (opzionale)</label>
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream dark:bg-midnight-card text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-electric-violet focus:ring-1 focus:ring-indigo-500 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Colore</label>
                        <div className="flex gap-3">
                            {GOAL_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setSelectedColor(color)}
                                    className={`w-10 h-10 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-electric-violet scale-110' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Seleziona colore ${color}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="flex-1 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || !targetAmount}
                        className="flex-1 py-3 rounded-xl font-semibold text-white bg-indigo-600 dark:btn-electric hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {editingGoal ? 'Salva' : 'Crea'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            <div className="midnight-card p-6 md:rounded-2xl shadow-xl transition-all duration-300">
                <div className="flex items-center gap-4 mb-4 pr-8">
                    <button
                        onClick={openAddModal}
                        className="p-2 rounded-full bg-indigo-100 dark:bg-electric-violet/20 text-indigo-600 dark:text-electric-violet hover:bg-indigo-200 dark:hover:bg-electric-violet/30 transition-colors flex-shrink-0"
                        aria-label="Aggiungi obiettivo"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Obiettivi di Risparmio</h3>
                        {goals.length > 0 && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Totale risparmiato: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSaved)}</span>
                            </p>
                        )}
                    </div>
                </div>

                {goals.length === 0 ? (
                    <div className="py-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <span className="text-3xl">🎯</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mb-2">Nessun obiettivo impostato</p>
                        <button
                            onClick={openAddModal}
                            className="text-indigo-600 dark:text-electric-violet font-semibold hover:underline"
                        >
                            Crea il tuo primo obiettivo
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {goals.map(renderGoalItem)}
                    </div>
                )}
            </div>

            {modal}
        </>
    );
};

export default SavingsGoalsCard;
