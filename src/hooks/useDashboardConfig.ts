import { useState, useCallback } from 'react';

export const ALL_DASHBOARD_CARDS = [
    { id: 'summary', title: 'Riepilogo Categorie' },
    { id: 'insights', title: 'Budget & Insights' },
    { id: 'categoryPie', title: 'Spese per Categoria' },
    { id: 'trend', title: 'Andamento Patrimoniale' },
    { id: 'goals', title: 'Obiettivi di Risparmio' },
    { id: 'goals', title: 'Obiettivi di Risparmio' }
] as const;

export type DashboardCardId = typeof ALL_DASHBOARD_CARDS[number]['id'];

export const useDashboardConfig = () => {
    const [items, setItems] = useState<string[]>(() => {
        const saved = localStorage.getItem('dashboard_order_safe');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Ensure only valid and unique keys
                    const valid = parsed.filter(id => ALL_DASHBOARD_CARDS.some(c => c.id === id));
                    // Check if new default items are missing (migration)


                    const unique = Array.from(new Set(valid));
                    return unique.length > 0 ? unique : ALL_DASHBOARD_CARDS.map(c => c.id);
                }
            } catch (e) {
                console.error('Error parsing dashboard config', e);
            }
        }
        // Default order
        return ['summary', 'insights', 'categoryPie', 'trend', 'goals'];
    });

    const toggleCard = useCallback((id: string) => {
        setItems(prev => {
            const isVisible = prev.includes(id);
            let next;
            if (isVisible) {
                next = prev.filter(i => i !== id);
            } else {
                next = [...prev, id];
            }
            localStorage.setItem('dashboard_order_safe', JSON.stringify(next));
            return next;
        });
    }, []);

    const saveOrder = useCallback((newOrder: string[]) => {
        setItems(newOrder);
        localStorage.setItem('dashboard_order_safe', JSON.stringify(newOrder));
    }, []);

    return { items, toggleCard, saveOrder };
};
