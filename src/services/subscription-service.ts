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
     * Fetches a company logo using Clearbit's autocomplete and logo API.
     * @param name The name of the company/service (e.g., 'Netflix')
     */
    static getLogoUrl(name: string): string {
        const domain = name.toLowerCase().replace(/\s+/g, '') + '.com';
        return `https://logo.clearbit.com/${domain}?size=128`;
    }

    /**
     * Returns a fallback icon if the real logo fails to load.
     */
    static getFallbackIcon(category: string): string {
        // This will be used by the UI to show a default category icon
        return category || 'general';
    }
}
