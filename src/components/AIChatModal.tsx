import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Expense, Account } from '../types';
import { CategoryService } from '../services/category-service'; // ✅ Import
import { XMarkIcon, PaperAirplaneIcon } from './icons';
import { formatCurrency } from './icons/formatters';
import { parseLocalYYYYMMDD } from '../utils/date';
import { getCategoryStyle } from '../utils/categoryStyles';

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    expenses: Expense[];
    accounts: Account[];
}

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    data?: any; // For rich widgets
    type?: 'text' | 'summary' | 'list';
};

const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose, expenses, accounts }) => {
    const [categoriesList, setCategoriesList] = useState<any[]>([]);
    useEffect(() => {
        const load = () => setCategoriesList(CategoryService.getCategories());
        load();
        window.addEventListener('categories-updated', load);
        return () => window.removeEventListener('categories-updated', load);
    }, []);

    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', text: 'Ciao! Sono il tuo assistente finanziario. Chiedimi cose come "Quanto ho speso in sushi?" o "Totale trasporti mese scorso".' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // API Key handling
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
            if (!apiKey && messages.length === 1) {
                setMessages(prev => [...prev, {
                    id: 'api-prompt',
                    role: 'assistant',
                    text: 'Per usare l\'intelligenza avanzata (Gemini), inserisci la tua API Key. Altrimenti userò la modalità "Offline Deterministica" (limitata).',
                }]);
                setShowApiKeyInput(true);
            }
        }
    }, [isOpen]); // Intentionally removed messages dependency to avoid loop

    const saveApiKey = (key: string) => {
        localStorage.setItem('gemini_api_key', key);
        setApiKey(key);
        setShowApiKeyInput(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Ottimo! Ora userò Gemini AI per risponderti.' }]);
    };

    const processQueryLocal = (q: string) => {
        // ... (Previous local logic) ...
        let responseText = "Non ho capito bene. Prova a chiedermi 'spese cibo' o 'totale mese'.";
        let responseType: 'text' | 'summary' | 'list' = 'text';
        let responseData: any = null;

        const now = new Date();
        let filtered = [...expenses];
        let timeFilter = 'all';

        if (q.includes('mese scorso')) {
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            filtered = filtered.filter(e => {
                const d = parseLocalYYYYMMDD(e.date);
                return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
            });
            timeFilter = 'last_month';
        } else if (q.includes('questo mese') || q.includes('mese corrent')) {
            filtered = filtered.filter(e => {
                const d = parseLocalYYYYMMDD(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
            timeFilter = 'this_month';
        } else if (q.includes('anno')) {
            filtered = filtered.filter(e => {
                const d = parseLocalYYYYMMDD(e.date);
                return d.getFullYear() === now.getFullYear();
            });
            timeFilter = 'year';
        }

        const allCats = categoriesList.map(c => c.name);
        let foundCat = allCats.find(c => q.includes(c.toLowerCase()));

        if (!foundCat) {
            const keywords = q.split(' ').filter(w => w.length > 3 && !['quanto', 'speso', 'totale', 'lista', 'dove', 'come'].includes(w));
            if (keywords.length > 0) {
                filtered = filtered.filter(e => keywords.some(k =>
                    (e.description || '').toLowerCase().includes(k) ||
                    (e.category || '').toLowerCase().includes(k) ||
                    (e.subcategory || '').toLowerCase().includes(k)
                ));
                if (filtered.length > 0) responseText = `Ho trovato ${filtered.length} movimenti per "${keywords.join(' ')}". (Modalità Offline)`;
            }
        } else {
            filtered = filtered.filter(e => (e.category || '').toLowerCase() === foundCat!.toLowerCase());
            responseText = `Ecco le spese per ${foundCat} (Modalità Offline).`;
        }

        const total = filtered.reduce((acc, e) => acc + Number(e.amount), 0);

        if (q.includes('totale') || q.includes('quanto ho speso')) {
            responseText = `Il totale è ${formatCurrency(total)}.`;
            responseType = 'summary';
            responseData = { total, count: filtered.length, top: filtered.slice(0, 3) };
        } else if (q.includes('lista') || q.includes('mostrami') || q.includes('vediamo')) {
            responseText = `Ecco la lista dei movimenti (${filtered.length}):`;
            responseType = 'list';
            responseData = filtered.slice(0, 10);
        } else {
            if (filtered.length > 0 && filtered.length < expenses.length) {
                responseText = `Ho trovato ${filtered.length} movimenti che totalizzano ${formatCurrency(total)}.`;
                responseType = 'list';
                responseData = filtered.slice(0, 5);
            } else if (filtered.length === 0) {
                responseText = "Non ho trovato nessuna spesa corrispondente (Modalità Offline).";
            }
        }

        return { text: responseText, type: responseType, data: responseData };
    };

    const processQueryGemini = async (q: string) => {
        try {
            // Prepare context (simplify expenses to reduce tokens)
            const contextExpenses = expenses.slice(0, 100).map(e => ({ // Last 100 txs
                d: e.date,
                a: e.amount,
                c: e.category,
                s: e.description, // s for string/desc
                t: e.type
            }));

            const prompt = `
Sei un assistente finanziario personale smart.
Ecco le ultime ${contextExpenses.length} transazioni dell'utente (formato ridotto: d=date, a=amount, c=category, s=description, t=type):
${JSON.stringify(contextExpenses)}

Domanda utente: "${q}"

Rispondi in italiano, in modo amichevole e sintetico.
Se l'utente chiede totali o somme, calcolali con precisione basandoti SOLO sui dati forniti.
Usa formattazione Markdown (grassetti). non dilungarti troppo.
`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Non ho potuto generare una risposta.";
            return { text: aiText, type: 'text' as const, data: null };

        } catch (error: any) {
            console.error("Gemini Error:", error);
            return { text: `Errore AI: ${error.message}. Uso fallback locale... \n\n` + processQueryLocal(q).text, type: 'text' as const, data: null };
        }
    };

    const processQuery = async (query: string) => {
        setIsTyping(true);
        const q = query.toLowerCase();

        // Check if we use AI or Local
        if (apiKey) {
            const result = await processQueryGemini(query); // Pass original query case
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: result.text,
                type: result.type,
                data: result.data
            }]);
            setIsTyping(false);
        } else {
            setTimeout(() => {
                const result = processQueryLocal(q);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: result.text,
                    type: result.type,
                    data: result.data
                }]);
                setIsTyping(false);
            }, 600);
        }
    };

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: input }]);
        const q = input;
        setInput('');
        processQuery(q);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[7000] flex flex-col bg-slate-50 dark:bg-black/95 transition-opacity duration-300">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-midnight border-b border-slate-200 dark:border-electric-violet/20 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
                        AI
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Assistant {apiKey ? 'Gemini' : '(Offline)'}</h3>
                        <p className="text-xs text-green-500 font-medium">{apiKey ? '• Connesso a Gemini Flash' : '• Modalità Locale'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowApiKeyInput(!showApiKeyInput)} className="text-xs text-indigo-500 font-bold px-2">API KEY</button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <XMarkIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-black/50">
                {showApiKeyInput && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30 mb-4 animate-fade-in-down">
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">Imposta Gemini API Key</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">Ottienila gratis su aistudio.google.com. I dati verranno inviati a Google per l'elaborazione.</p>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                placeholder="Incolla API Key qui..."
                                className="flex-1 px-3 py-2 rounded-lg text-sm border border-amber-300 dark:border-amber-600 bg-white dark:bg-black/40 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                onKeyDown={(e) => { if (e.key === 'Enter') saveApiKey((e.target as HTMLInputElement).value) }}
                            />
                            <button
                                onClick={(e) => saveApiKey((e.currentTarget.previousSibling as HTMLInputElement).value)}
                                className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600"
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-white dark:bg-midnight-card text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-electric-violet/10'
                            }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                            {/* Data Widgets */}
                            {msg.type === 'summary' && msg.data && (
                                <div className="mt-3 bg-slate-50 dark:bg-black/20 rounded-xl p-3 border border-slate-100 dark:border-white/5">
                                    <p className="text-3xl font-black text-indigo-600 dark:text-electric-violet mb-2">{formatCurrency(msg.data.total)}</p>
                                    <p className="text-xs text-slate-500 mb-2">{msg.data.count} movimenti trovati</p>
                                    <div className="space-y-1">
                                        {msg.data.top.map((e: Expense) => (
                                            <div key={e.id} className="flex justify-between text-xs py-1 border-b border-slate-200 dark:border-white/5 last:border-0 text-slate-600 dark:text-slate-400">
                                                <span className="truncate max-w-[120px]">{e.description}</span>
                                                <span className="font-mono">{formatCurrency(e.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {msg.type === 'list' && msg.data && (
                                <div className="mt-3 space-y-2">
                                    {msg.data.map((e: Expense) => {
                                        const Style = getCategoryStyle(e.category);
                                        return (
                                            <div key={e.id} className="flex items-center gap-3 bg-slate-50 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                                                <Style.Icon className="w-8 h-8 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{e.description}</p>
                                                    <p className="text-[10px] opacity-70 truncate">{e.date} • {e.category}</p>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-white">{formatCurrency(e.amount)}</span>
                                            </div>
                                        );
                                    })}
                                    {msg.data.length >= 5 && <p className="text-[10px] text-center opacity-50 mt-1">Primi 5 risultati mostrati</p>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-white dark:bg-midnight-card px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400 animation-delay-200"></span>
                            <span className="w-2 h-2 rounded-full bg-slate-400 animation-delay-400"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-midnight border-t border-slate-200 dark:border-electric-violet/20 flex gap-2 items-end">
                <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={apiKey ? "Chiedi a Gemini..." : "Scrivi un comando..."}
                    className="flex-1 bg-slate-100 dark:bg-midnight-card border-none rounded-2xl py-3 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none max-h-32 min-h-[50px] custom-scrollbar"
                    rows={1}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="p-3 bg-indigo-600 dark:bg-electric-violet text-white rounded-full hover:bg-indigo-700 dark:hover:bg-electric-violet/80 transition-all disabled:opacity-50 disabled:scale-95 shadow-md flex-shrink-0"
                >
                    <PaperAirplaneIcon className="w-6 h-6 transform rotate-45 -ml-1 mt-0.5" />
                </button>
            </div>
        </div>,
        document.body
    );
};

export default AIChatModal;
