import { openDB, IDBPDatabase } from 'idb';
import { AutoTransaction } from '../types/transaction';

export interface OfflineImage {
    id: string;
    base64Image: string;
    mimeType: string;
    timestamp?: number;
    _isShared?: boolean; // Flag for shared images
}

const DB_NAME = 'expense-manager-db';
const STORE_IMAGES = 'offline-images';
const STORE_AUTO_TRANSACTIONS = 'auto-transactions';
const STORE_RAW_EVENTS = 'raw-events'; // New Raw Store
const DB_VERSION = 3; // Upgrade to v3

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

const getDb = (): Promise<IDBPDatabase<unknown>> => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // Create offline-images store
                if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                    db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
                }

                // Create auto-transactions store (v2)
                if ((oldVersion < 2) && !db.objectStoreNames.contains(STORE_AUTO_TRANSACTIONS)) {
                    const store = db.createObjectStore(STORE_AUTO_TRANSACTIONS, { keyPath: 'id' });
                    store.createIndex('sourceHash', 'sourceHash', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create raw-events store (v3)
                if (oldVersion < 3 && !db.objectStoreNames.contains(STORE_RAW_EVENTS)) {
                    const store = db.createObjectStore(STORE_RAW_EVENTS, { keyPath: 'id' });
                    store.createIndex('status', 'status', { unique: false }); // processed, error, pending
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            },
            blocked() {
                console.warn('Database blocked');
            },
            blocking() {
                if (dbPromise) {
                    dbPromise.then((db) => db.close());
                    dbPromise = null;
                }
            },
            terminated() {
                dbPromise = null;
            },
        });
    }
    return dbPromise;
};

// Helper to retry once on "closing" error
async function withRetry<T>(operation: (db: IDBPDatabase<unknown>) => Promise<T>): Promise<T> {
    try {
        const db = await getDb();
        return await operation(db);
    } catch (error: any) {
        // Retry if the database connection is closing or closed
        if (error && (
            (error.message && (error.message.includes('closing') || error.message.includes('closed'))) ||
            error.name === 'InvalidStateError'
        )) {
            console.warn('Database connection issue, retrying...', error);
            dbPromise = null; // Force new connection
            const db = await getDb();
            return await operation(db);
        }
        throw error;
    }
}

// =============== RAW EVENTS (Offline-First Re-parsing) ===============

export interface RawEvent {
    id: string; // uuid
    source: 'notification' | 'sms';
    rawContent: any; // The full JSON blob (appName, text, etc.)
    timestamp: number;
    status: 'pending' | 'processed' | 'error' | 'ignored';
    errorMessage?: string;
    processedTransactionId?: string; // Link to the created transaction
}

export const addRawEvent = async (event: RawEvent): Promise<void> => {
    await withRetry(async (db) => {
        await db.put(STORE_RAW_EVENTS, event);
    });
};

export const getRawEvent = async (id: string): Promise<RawEvent | undefined> => {
    return await withRetry(async (db) => {
        return await db.get(STORE_RAW_EVENTS, id);
    });
};

export const updateRawEventStatus = async (id: string, status: RawEvent['status'], error?: string, processedTransactionId?: string): Promise<void> => {
    await withRetry(async (db) => {
        const tx = db.transaction(STORE_RAW_EVENTS, 'readwrite');
        const existing = await tx.store.get(id) as RawEvent | undefined;
        if (existing) {
            const updates: Partial<RawEvent> = { status };
            if (error) updates.errorMessage = error;
            if (processedTransactionId) updates.processedTransactionId = processedTransactionId;
            await tx.store.put({ ...existing, ...updates });
        }
    });
};

// =============== OFFLINE IMAGES ===============

export const addImageToQueue = async (image: OfflineImage): Promise<void> => {
    await withRetry(async (db) => {
        await db.put(STORE_IMAGES, image);
    });
};

export const getQueuedImages = async (): Promise<OfflineImage[]> => {
    return await withRetry(async (db) => {
        return await db.getAll(STORE_IMAGES);
    }) as OfflineImage[];
};

export const deleteImageFromQueue = async (id: string): Promise<void> => {
    await withRetry(async (db) => {
        await db.delete(STORE_IMAGES, id);
    });
};

// =============== AUTO TRANSACTIONS ===============

export const addAutoTransaction = async (transaction: AutoTransaction): Promise<void> => {
    await withRetry(async (db) => {
        await db.put(STORE_AUTO_TRANSACTIONS, transaction);
    });
};

export const getAutoTransactions = async (): Promise<AutoTransaction[]> => {
    return await withRetry(async (db) => {
        return await db.getAll(STORE_AUTO_TRANSACTIONS);
    }) as AutoTransaction[];
};

export const getAutoTransactionByHash = async (hash: string): Promise<AutoTransaction | undefined> => {
    return await withRetry(async (db) => {
        const tx = db.transaction(STORE_AUTO_TRANSACTIONS, 'readonly');
        const index = tx.store.index('sourceHash');
        return await index.get(hash) as AutoTransaction | undefined;
    });
};

export const getAutoTransactionsByStatus = async (status: string): Promise<AutoTransaction[]> => {
    return await withRetry(async (db) => {
        const tx = db.transaction(STORE_AUTO_TRANSACTIONS, 'readonly');
        const index = tx.store.index('status');
        return await index.getAll(status) as AutoTransaction[];
    });
};

export const updateAutoTransaction = async (id: string, updates: Partial<AutoTransaction>): Promise<void> => {
    await withRetry(async (db) => {
        const tx = db.transaction(STORE_AUTO_TRANSACTIONS, 'readwrite');
        const existing = await tx.store.get(id) as AutoTransaction | undefined;
        if (existing) {
            await tx.store.put({ ...existing, ...updates });
        }
    });
};

export const deleteAutoTransaction = async (id: string): Promise<void> => {
    await withRetry(async (db) => {
        await db.delete(STORE_AUTO_TRANSACTIONS, id);
    });
};

export const deleteOldAutoTransactions = async (olderThan: number): Promise<number> => {
    return await withRetry(async (db) => {
        const tx = db.transaction(STORE_AUTO_TRANSACTIONS, 'readwrite');
        const index = tx.store.index('createdAt');
        const allTransactions = await index.getAll() as AutoTransaction[];

        const toDelete = allTransactions.filter(
            t => t.createdAt < olderThan && t.status !== 'pending'
        );

        for (const transaction of toDelete) {
            await tx.store.delete(transaction.id);
        }

        return toDelete.length;
    });
};
