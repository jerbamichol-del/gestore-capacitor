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
    /**
     * Fetches a company logo using Google's Favicon Service (more reliable than Clearbit).
     * Includes an extensive map for common services to ensure accuracy.
     */
    static getLogoUrl(name: string): string {
        const cleanName = name.toLowerCase().trim();

        // 1. Map common services to their correct domains
        const domainMap: Record<string, string> = {
            // Streaming Video
            'netflix': 'netflix.com',
            'disney': 'disneyplus.com', // Covers Disney+ and Disney Plus
            'prime video': 'primevideo.com',
            'amazon prime': 'amazon.com',
            'hulu': 'hulu.com',
            'hbo': 'hbomax.com',
            'max': 'max.com',
            'peacock': 'peacocktv.com',
            'paramount': 'paramountplus.com',
            'apple tv': 'tv.apple.com',
            'now': 'nowtv.it', // Prefer IT for local context usually
            'now tv': 'nowtv.it',
            'dazn': 'dazn.com',
            'sky': 'sky.it',
            'youtube': 'youtube.com',
            'twitch': 'twitch.tv',
            'mediaset': 'mediasetplay.it',
            'infinity': 'mediasetplay.it',
            'rai': 'raiplay.it',
            'discovery': 'discoveryplus.com',
            'rakuten': 'rakuten.tv',
            'crunchyroll': 'crunchyroll.com',
            'plex': 'plex.tv',
            'mubi': 'mubi.com',

            // Streaming Music
            'spotify': 'spotify.com',
            'apple music': 'music.apple.com',
            'amazon music': 'music.amazon.com',
            'tidal': 'tidal.com',
            'deezer': 'deezer.com',
            'soundcloud': 'soundcloud.com',
            'youtube music': 'music.youtube.com',
            'pandora': 'pandora.com',
            'qobuz': 'qobuz.com',

            // Gaming
            'playstation': 'playstation.com',
            'ps plus': 'playstation.com',
            'xbox': 'xbox.com',
            'game pass': 'xbox.com',
            'nintendo': 'nintendo.com',
            'switch online': 'nintendo.com',
            'steam': 'steampowered.com',
            'epic games': 'epicgames.com',
            'ea play': 'ea.com',
            'ubisoft': 'ubisoft.com',
            'geforce': 'nvidia.com',
            'roblox': 'roblox.com',
            'minecraft': 'minecraft.net',
            'humble bundle': 'humblebundle.com',

            // Cloud & Productivity
            'google': 'google.com', // Covers Google One, Drive
            'g suite': 'google.com',
            'icloud': 'icloud.com',
            'apple': 'apple.com', // Generic Apple
            'microsoft': 'microsoft.com', // Covers 365
            'office': 'office.com',
            'dropbox': 'dropbox.com',
            'onedrive': 'microsoft.com',
            'adobe': 'adobe.com',
            'photoshop': 'adobe.com',
            'canva': 'canva.com',
            'zoom': 'zoom.us',
            'slack': 'slack.com',
            'trello': 'trello.com',
            'notion': 'notion.so',
            'evernote': 'evernote.com',
            'chatgpt': 'openai.com',
            'openai': 'openai.com',
            'midjourney': 'midjourney.com',
            'github': 'github.com',
            'gitlab': 'gitlab.com',
            'figma': 'figma.com',
            'dashlane': 'dashlane.com',
            '1password': '1password.com',
            'lastpass': 'lastpass.com',
            'nordvpn': 'nordvpn.com',
            'expressvpn': 'expressvpn.com',
            'surfshark': 'surfshark.com',

            // Social
            'linkedin': 'linkedin.com',
            'tinder': 'tinder.com',
            'bumble': 'bumble.com',
            'hinge': 'hinge.co',
            'duolingo': 'duolingo.com',
            'strava': 'strava.com',
            'fitbit': 'fitbit.com',

            // Shopping & Delivery (IT context)
            'amazon': 'amazon.it',
            'ebay': 'ebay.it',
            'glovo': 'glovoapp.com',
            'deliveroo': 'deliveroo.it',
            'just eat': 'justeat.it',
            'uber': 'uber.com',
            'zalando': 'zalando.it',
            'shein': 'shein.com',
            'temu': 'temu.com',

            // Utilities & TLC (IT)
            'tim': 'tim.it',
            'vodafone': 'vodafone.it',
            'wind': 'windtre.it',
            'windtre': 'windtre.it',
            'iliad': 'iliad.it',
            'fastweb': 'fastweb.it',
            'enel': 'enel.it',
            'eni': 'eni.com',
            'plenitude': 'eniplenitude.com',
            'a2a': 'a2a.eu',
            'hera': 'gruppohera.it',
            'acea': 'gruppo.acea.it',
            'telepass': 'telepass.com',
            'unipol': 'unipolsai.it',
            'allianz': 'allianz.it',
            'generali': 'generali.it'
        };

        // Check map first (keys are lowercase)
        for (const [key, domain] of Object.entries(domainMap)) {
            if (cleanName.includes(key)) {
                return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            }
        }

        // 2. Fallback Logic
        // Clean the name: remove special chars (except dots), spaces -> remove
        let domain = cleanName
            .replace(/\+/g, 'plus') // Disney+ -> disneyplus
            .replace(/&/g, 'and')   // H&M -> handm
            .replace(/['"]/g, '')   // McD's -> mcds
            .replace(/[^a-z0-9.]/g, ''); // Remove everything else (spaces, dashes, etc)

        // Common stopwords to strip ONLY if they are at the start/end or common noise
        // But simply appending .com to the collapsed string is usually safer than stripping too much
        // e.g. "youtube premium" -> "youtubepremium.com" which redirects or fails,
        // but "youtube" was caught by map.
        // Let's try to be smart about "subscription"
        domain = domain.replace(/abbonamento/g, '').replace(/subscription/g, '').replace(/mensile/g, '').replace(/annuale/g, '');

        if (!domain.includes('.')) {
            domain += '.com';
        }

        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }
}
