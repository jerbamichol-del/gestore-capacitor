// src/utils/logger.ts
// Centralized logger — silences logs in production, always shows errors.
/// <reference types="vite/client" />

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: unknown[]) => { if (isDev) console.log(...args); },
    warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
    error: (...args: unknown[]) => { console.error(...args); },
    info: (...args: unknown[]) => { if (isDev) console.info(...args); },
};
