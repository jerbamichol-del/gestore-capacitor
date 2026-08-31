// src/services/auto-confirm-service.ts
// Decides how detected transactions are handled: registered automatically or
// queued for manual review. Per-source policy + learned merchant category rules.

export type SourceMode = 'auto' | 'review';

export interface AutoConfirmSettings {
    bank: SourceMode;         // movimenti scaricati dall'API bancaria
    sms: SourceMode;          // transazioni parsate dagli SMS
    notification: SourceMode; // transazioni parse dalle notifiche
}

export interface MerchantRule {
    merchant: string;   // chiave normalizzata del negozio/causale
    category: string;
    subcategory?: string;
    learnedAt: number;
    hits: number;
}

const SETTINGS_KEY = 'auto_confirm_settings';
const RULES_KEY = 'merchant_category_rules';
const MAX_RULES = 200;

const DEFAULT_SETTINGS: AutoConfirmSettings = {
    bank: 'auto',
    sms: 'review',
    notification: 'review'
};

// Parole di rumore da ignorare quando si estrae il "negozio" da una causale bancaria
const NOISE_WORDS = new Set([
    'pagamento', 'pos', 'addebito', 'acquisto', 'carta', 'bonifico', 'ricarica',
    'versamento', 'prelievo', 'autorizzazione', 'operazione', 'online', 'negozio',
    'citta', 'italia', 'it', 'spa', 'srl', 'pago', 'bancomat', 'sdd', 'sepa',
    'dispositivo', 'contactless', 'canale', 'mio', 'via', 'del', 'della', 'dei',
    'dalle', 'dalla', 'per', 'su', 'in', 'da', 'a', 'e', 'il', 'lo', 'la', 'le',
    'un', 'una', 'uno', 'di', 'che', 'con'
]);

const TRANSFER_RE = /bonifico|transfer|trasferiment|girament|top ?up|ricarica|versamento/i;

const KNOWN_BANK_TOKENS = [
    'revolut', 'bbva', 'unicredit', 'intesa', 'sanpaolo', 'poste', 'bancoposta',
    'postepay', 'bnl', 'bnp', 'fineco', 'hype', 'n26', 'wise', 'transferwise',
    'satispay', 'ing', 'mediolanum', 'sella', 'bper', 'carige', 'creval', 'iban'
];

export class AutoConfirmService {

    // ------------------------------------------------------------------
    // Per-source settings
    // ------------------------------------------------------------------

    static getSettings(): AutoConfirmSettings {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const parsed = JSON.parse(raw);
            return {
                bank: parsed.bank === 'review' ? 'review' : 'auto',
                sms: parsed.sms === 'auto' ? 'auto' : 'review',
                notification: parsed.notification === 'auto' ? 'auto' : 'review'
            };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    static setSourceMode(source: keyof AutoConfirmSettings, mode: SourceMode): void {
        const settings = this.getSettings();
        settings[source] = mode;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('auto-confirm-settings-changed'));
    }

    static shouldAutoConfirm(sourceType: string): boolean {
        const s = this.getSettings();
        if (sourceType === 'bank') return s.bank === 'auto';
        if (sourceType === 'sms') return s.sms === 'auto';
        if (sourceType === 'notification') return s.notification === 'auto';
        return false;
    }

    // ------------------------------------------------------------------
    // Merchant category rules (learned when the user categorizes an expense)
    // ------------------------------------------------------------------

    private static normalize(text: string): string {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract a stable merchant key from a bank description:
     * drop noise words and digit runs, keep the first meaningful words.
     * "PAGAMENTO POS 1234 SUPERMERCATO IL GIGANTE" -> "supermercato gigante"
     */
    static extractMerchantKey(description: string): string {
        const words = this.normalize(description)
            .split(' ')
            .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !NOISE_WORDS.has(w));
        return words.slice(0, 3).join(' ');
    }

    private static loadRules(): MerchantRule[] {
        try {
            const raw = localStorage.getItem(RULES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    static findCategoryRule(description: string): MerchantRule | null {
        const norm = this.normalize(description);
        if (!norm) return null;
        const words = norm.split(' ');

        let best: MerchantRule | null = null;
        let bestLen = 0;
        for (const rule of this.loadRules()) {
            const key = this.normalize(rule.merchant);
            if (key.length < 4) continue;

            // Token-based match (immune to noise words between the merchant's
            // words, e.g. "ESSO STAZIONE DI SERVIZIO" vs rule "esso stazione servizio")
            const ruleWords = key.split(' ');
            const allPresent = ruleWords.every(w => words.includes(w));
            if (allPresent && key.length > bestLen) {
                best = rule;
                bestLen = key.length;
            }
        }
        return best;
    }

    static learnCategoryRule(description: string, category: string, subcategory?: string): void {
        const key = this.extractMerchantKey(description);
        if (key.length < 4 || !category || category === 'Da Categorizzare') return;

        try {
            const rules = this.loadRules().filter(r => this.normalize(r.merchant) !== key);
            rules.unshift({ merchant: key, category, subcategory, learnedAt: Date.now(), hits: 0 });
            localStorage.setItem(RULES_KEY, JSON.stringify(rules.slice(0, MAX_RULES)));
            console.log(`🧠 Learned merchant rule: "${key}" -> ${category}${subcategory ? '/' + subcategory : ''}`);
        } catch (e) {
            console.error('Failed to save merchant rule:', e);
        }
    }

    // ------------------------------------------------------------------
    // Transfer suspicion: movements between the user's own accounts must be
    // confirmed manually (which accounts are involved is a user decision).
    // ------------------------------------------------------------------

    static isTransferCandidate(description: string): boolean {
        const desc = this.normalize(description);
        if (!TRANSFER_RE.test(desc)) return false;

        // Mentions one of the user's local account names?
        try {
            const accounts = JSON.parse(localStorage.getItem('accounts_v1') || '[]');
            for (const acc of accounts) {
                const name = this.normalize(acc?.name || '');
                if (name.length >= 4 && desc.includes(name)) return true;
            }
        } catch { /* ignore */ }

        // Or a well-known bank name (transfer to/from own account at another bank)
        return KNOWN_BANK_TOKENS.some(b => desc.includes(b));
    }
}
