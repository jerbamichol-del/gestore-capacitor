import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { ChevronLeftIcon } from '../components/icons/ChevronLeftIcon';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';

interface CardConfig {
    id: string;
    label: string;
    description: string;
    emoji: string;
    enabled: boolean;
}

const DEFAULT_CARDS: CardConfig[] = [
    { id: 'summary', label: 'Riepilogo Categorie', description: 'Mostra la distribuzione delle spese per categoria con barre di progresso', emoji: '📊', enabled: true },
    { id: 'categoryPie', label: 'Spese per Categoria', description: 'Grafico a torta interattivo delle categorie di spesa', emoji: '🥧', enabled: true },
    { id: 'trend', label: 'Andamento Patrimonio', description: 'Grafico lineare dell\'andamento del patrimonio nel tempo', emoji: '📈', enabled: true },
    { id: 'insights', label: 'Insights & Budget', description: 'Suggerimenti AI e monitoraggio dei budget impostati', emoji: '💡', enabled: true },
    { id: 'goals', label: 'Obiettivi di Risparmio', description: 'Visualizza i tuoi obiettivi di risparmio e il progresso', emoji: '🎯', enabled: true },
];

interface CardManagerScreenProps {
    isOpen: boolean;
    onClose: () => void;
    onCardsChange?: (enabledCardIds: string[]) => void;
}

const CardManagerScreen: React.FC<CardManagerScreenProps> = ({ isOpen, onClose, onCardsChange }) => {
    const [cards, setCards] = useState<CardConfig[]>(() => {
        const saved = localStorage.getItem('dashboard_cards_config');
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as CardConfig[];
                // Merge with defaults to handle new cards
                return DEFAULT_CARDS.map(defaultCard => {
                    const savedCard = parsed.find(c => c.id === defaultCard.id);
                    return savedCard ? { ...defaultCard, enabled: savedCard.enabled } : defaultCard;
                });
            } catch {
                return DEFAULT_CARDS;
            }
        }
        return DEFAULT_CARDS;
    });

    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Save on change
    useEffect(() => {
        localStorage.setItem('dashboard_cards_config', JSON.stringify(cards));
        // Also update the order array for Dashboard compatibility
        const enabledIds = cards.filter(c => c.enabled).map(c => c.id);
        localStorage.setItem('dashboard_order_safe', JSON.stringify(enabledIds));
        onCardsChange?.(enabledIds);
    }, [cards, onCardsChange]);

    // Swipe handling
    useEffect(() => {
        if (!isOpen) return;
        const container = containerRef.current;
        if (!container) return;

        let startX = 0;
        let startY = 0;
        let isDragging = false;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!isDragging) return;
            isDragging = false;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = Math.abs(startY - endY);

            // Only trigger if horizontal swipe > 50px and not too vertical
            if (Math.abs(diffX) > 50 && diffY < 100) {
                if (diffX > 0 && currentIndex < cards.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                } else if (diffX < 0 && currentIndex > 0) {
                    setCurrentIndex(prev => prev - 1);
                }
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isOpen, currentIndex, cards.length]);

    const toggleCard = (id: string) => {
        setCards(prev => prev.map(card =>
            card.id === id ? { ...card, enabled: !card.enabled } : card
        ));
    };

    const goToNext = () => {
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const goToPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    if (!isOpen) return null;

    const currentCard = cards[currentIndex];
    const enabledCount = cards.filter(c => c.enabled).length;

    return createPortal(
        <div className="fixed inset-0 z-[8500] flex flex-col bg-sunset-cream dark:bg-midnight transition-colors">
            {/* Header */}
            <div
                className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-midnight"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Andamento</h2>
                    <p className="text-xs text-slate-500">{enabledCount} card attive</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <XMarkIcon className="w-6 h-6 text-slate-500" />
                </button>
            </div>

            {/* Carousel Container */}
            <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden">
                {/* Card Preview */}
                <div className="relative w-full max-w-sm">
                    {/* Navigation Arrows */}
                    <button
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 p-3 rounded-full bg-white dark:bg-midnight-card shadow-lg border border-slate-200 dark:border-slate-700 transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                            }`}
                    >
                        <ChevronLeftIcon className="w-6 h-6 text-slate-600 dark:text-white" />
                    </button>

                    <button
                        onClick={goToNext}
                        disabled={currentIndex === cards.length - 1}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 p-3 rounded-full bg-white dark:bg-midnight-card shadow-lg border border-slate-200 dark:border-slate-700 transition-all ${currentIndex === cards.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
                            }`}
                    >
                        <ChevronRightIcon className="w-6 h-6 text-slate-600 dark:text-white" />
                    </button>

                    {/* Card */}
                    <div
                        className={`relative rounded-3xl p-6 shadow-xl border-2 transition-all duration-300 ${currentCard.enabled
                                ? 'bg-white dark:bg-midnight-card border-indigo-500 dark:border-electric-violet'
                                : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 opacity-60'
                            }`}
                    >
                        {/* Remove/Add Button */}
                        <button
                            onClick={() => toggleCard(currentCard.id)}
                            className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentCard.enabled
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                }`}
                        >
                            {currentCard.enabled ? (
                                <XMarkIcon className="w-5 h-5" />
                            ) : (
                                <CheckIcon className="w-5 h-5" />
                            )}
                        </button>

                        {/* Card Content */}
                        <div className="text-center pt-4">
                            <div className="text-6xl mb-4">{currentCard.emoji}</div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                {currentCard.label}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {currentCard.description}
                            </p>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${currentCard.enabled
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}>
                                {currentCard.enabled ? (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        <span>Attiva in Home</span>
                                    </>
                                ) : (
                                    <span>Non visibile in Home</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dots Indicator */}
                <div className="flex gap-2 mt-6">
                    {cards.map((card, index) => (
                        <button
                            key={card.id}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-3 h-3 rounded-full transition-all ${index === currentIndex
                                    ? 'bg-indigo-600 dark:bg-electric-violet scale-110'
                                    : card.enabled
                                        ? 'bg-indigo-300 dark:bg-indigo-800'
                                        : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Footer Instructions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    ← Scorri per navigare tra le card →
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Tocca il pulsante rosso/verde per attivare/disattivare
                </p>
            </div>
        </div>,
        document.body
    );
};

export default CardManagerScreen;
