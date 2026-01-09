import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationTransactionParser } from '../notification-transaction-parser';
import { AutoTransactionService } from '../auto-transaction-service';

describe('NotificationTransactionParser', () => {

    beforeEach(() => {
        // Mock the DB layer to return the input transaction directly
        vi.spyOn(AutoTransactionService, 'addAutoTransaction').mockImplementation(async (tx) => tx as any);
    });

    // --- UNICREDIT ---
    it('should parse UniCredit expense correctly (Amount before c/o)', async () => {
        const text = "autorizzata op.Internet 60,40 EUR carta *1210 c/o PAYPAL *KICKKICK.IT 12/01/24";
        // appName must match 'unicredit' identifier
        const result = await NotificationTransactionParser.parseNotification('unicredit', 'UniCredit Title', text, Date.now());

        expect(result).not.toBeNull();
        expect(result?.amount).toBe(60.40);
        expect(result?.account).toBe('bank-account'); // Must map to default ID
        expect(result?.type).toBe('expense');
    });

    it('should parse UniCredit basic payment', async () => {
        const text = "Pagamento POS 15,00 EUR presso Bar Sport";
        const result = await NotificationTransactionParser.parseNotification('unicredit', 'Title', text, Date.now());

        expect(result?.amount).toBe(15.00);
        expect(result?.account).toBe('bank-account');
    });

    // --- POSTEPAY ---
    it('should parse Postepay and map to correct account ID', async () => {
        const text = "Pagamento su POS 22.50 EUR presso Ristorante Roma";
        // appName must match 'postepay' identifier
        const result = await NotificationTransactionParser.parseNotification('postepay', 'PostePay', text, Date.now());

        expect(result?.amount).toBe(22.50);
        expect(result?.account).toBe('poste'); // ID is 'poste', not 'Postepay'
        expect(result?.type).toBe('expense');
    });

    // --- REVOLUT ---
    it('should parse Revolut expense', async () => {
        const text = "Hai speso €12,99 da Netflix";
        const result = await NotificationTransactionParser.parseNotification('revolut', 'Revolut', text, Date.now());

        expect(result?.amount).toBe(12.99);
        expect(result?.account).toBe('revolut');
    });

    // --- PAYPAL ---
    it('should parse PayPal sent money', async () => {
        const text = "Hai inviato 50,00 EUR a Mario Rossi";
        const result = await NotificationTransactionParser.parseNotification('paypal', 'PayPal', text, Date.now());

        expect(result?.amount).toBe(50.00);
        expect(result?.account).toBe('paypal');
    });

    // --- INTESA ---
    it('should parse Intesa Sanpaolo and map to bank-account', async () => {
        const text = "Addebito carta 100,00 EUR presso Amazon";
        const result = await NotificationTransactionParser.parseNotification('intesa', 'Intesa', text, Date.now());

        expect(result?.amount).toBe(100.00);
        expect(result?.account).toBe('bank-account');
    });

});
