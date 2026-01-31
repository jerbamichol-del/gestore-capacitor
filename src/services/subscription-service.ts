import { Subscription } from '../types';

const STORAGE_KEY = 'subscriptions';

export class SubscriptionService {
    static async getSubscriptions(): Promise<Subscription[]> {
        const value = localStorage.getItem(STORAGE_KEY);
        return value ? JSON.parse(value) : [];
    }

    static async saveSubscription(subscription: Subscription): Promise<void> {
        const subscriptions = await this.getSubscriptions();
        const index = subscriptions.findIndex(s => s.id === subscription.id);
        if (index !== -1) {
            subscriptions[index] = subscription;
        } else {
            subscriptions.push(subscription);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    }

    static async deleteSubscription(id: string): Promise<void> {
        const subscriptions = await this.getSubscriptions();
        const filtered = subscriptions.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    /**
     * Fetches a company logo using Clearbit's logo API.
     * Includes a map for common services to ensure accuracy.
     */
    static getLogoUrl(name: string): string {
        const cleanName = name.toLowerCase().trim();

        // Map common services to their correct domains
        const domainMap: Record<string, string> = {
            'netflix': 'netflix.com',
            'spotify': 'spotify.com',
            'disney+': 'disneyplus.com',
            'disney plus': 'disneyplus.com',
            'amazon prime': 'amazon.com',
            'prime video': 'primevideo.com',
            'apple music': 'apple.com',
            'apple tv': 'apple.com',
            'icloud': 'apple.com',
            'google one': 'google.com',
            'youtube premium': 'youtube.com',
            'dazn': 'dazn.com',
            'sky': 'sky.it',
            'now tv': 'nowtv.com',
            'paramount+': 'paramountplus.com',
            'hulu': 'hulu.com',
            'adobe': 'adobe.com',
            'microsoft 365': 'microsoft.com',
            'office 365': 'microsoft.com',
            'dropbox': 'dropbox.com',
            'nintendo switch online': 'nintendo.com',
            'playstation plus': 'playstation.com',
            'xbox game pass': 'xbox.com',
            'linkedin': 'linkedin.com',
            'chatgpt': 'openai.com',
            'midjourney': 'midjourney.com',
            'canva': 'canva.com'
        };

        // Check map first
        for (const [key, domain] of Object.entries(domainMap)) {
            if (cleanName.includes(key)) return `https://logo.clearbit.com/${domain}?size=128`;
        }

        // Fallback: strip "abbonamento", "subscription", etc. and try .com
        const wordsToStrip = ['abbonamento', 'subscription', 'piano', 'mensile', 'annuale', 'premium', 'family', 'studenti'];
        let simplified = cleanName;
        wordsToStrip.forEach(word => {
            simplified = simplified.replace(word, '');
        });

        const domain = simplified.trim().replace(/\s+/g, '') + '.com';
        return `https://logo.clearbit.com/${domain}?size=128`;
    }
}
