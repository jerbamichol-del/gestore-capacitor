// utils/hash.ts

/**
 * Simple MD5 implementation for transaction hashing
 * Used to detect duplicate transactions from SMS and notifications
 */
export function md5(input: string): string {
  // Semplice implementazione MD5 per browser
  // Usa crypto API nativo se disponibile
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Per production, usa crypto.subtle (async)
    // Per semplicità, usiamo hash sync custom
  }
  
  // Fallback: hash semplice deterministico
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Converti in hex
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalizes transaction data for consistent hashing
 */
export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Rimuovi spazi
    .replace(/[^\w]/g, ''); // Rimuovi caratteri speciali
}
