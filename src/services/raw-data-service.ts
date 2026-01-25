
import { addRawEvent, updateRawEventStatus, RawEvent } from '../utils/db';
import { BankNotification } from '../plugins/notification-listener';

export class RawDataService {

    /**
     * Save a raw notification for offline/re-parsing capability
     */
    static async saveRawNotification(notification: BankNotification): Promise<string> {
        const id = crypto.randomUUID();
        const event: RawEvent = {
            id,
            source: 'notification',
            rawContent: notification,
            timestamp: Date.now(),
            status: 'pending' // Initially pending until parser picks it up
        };

        await addRawEvent(event);
        return id;
    }

    /**
     * Update status after processing
     */
    static async markAsProcessed(id: string, transactionId?: string): Promise<void> {
        await updateRawEventStatus(id, 'processed', undefined, transactionId);
    }

    /**
     * Mark as error
     */
    static async markAsError(id: string, error: string): Promise<void> {
        await updateRawEventStatus(id, 'error', error);
    }

    /**
     * Mark as ignored (e.g. invalid regex match but saved for history)
     */
    static async markAsIgnored(id: string, reason: string): Promise<void> {
        await updateRawEventStatus(id, 'ignored', reason);
    }
}
