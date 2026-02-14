/// <reference types="vite/client" />

export const API_CONFIG = {
    // Script for Data Sync (Backup/Restore)
    DATA_SCRIPT_URL: (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzuAtweyuib21-BX4dQszoxEL5BW-nzVN2Vyum4UZvWH-TzP3GLZB5He1jFkrO6242JPA/exec',

    // Script for Auth (Forgot Password, Email Verification)
    AUTH_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec',

    REDIRECT_RESET_URL: 'https://jerbamichol-del.github.io/gestore/reset/',
    REDIRECT_BASE_URL: 'https://jerbamichol-del.github.io/gestore/',
};
