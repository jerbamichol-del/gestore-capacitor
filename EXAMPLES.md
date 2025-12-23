# 💡 Examples & Test Scenarios

## Esempi Pratici di Utilizzo

---

## 📱 Esempio 1: SMS Revolut

### SMS Ricevuto:
```
Sender: REVOLUT
Message: Hai speso €12.50 at AMAZON EU
```

### Transazione Rilevata:
```json
{
  "type": "expense",
  "amount": 12.50,
  "description": "AMAZON EU",
  "account": "Revolut",
  "sourceType": "sms",
  "sourceApp": "revolut",
  "status": "pending"
}
```

### Azioni Utente:
- **Conferma** → Crea spesa con categoria "Da Categorizzare"
- **Ignora** → Marca come ignorata

---

## 🔔 Esempio 2: Notifica PayPal

### Notifica Ricevuta:
```
App: PayPal
Title: Payment sent
Text: You sent €25.00 to John Smith
```

### Transazione Rilevata:
```json
{
  "type": "expense",
  "amount": 25.00,
  "description": "John Smith",
  "account": "PayPal",
  "sourceType": "notification",
  "sourceApp": "paypal",
  "status": "pending"
}
```

---

## 🔄 Esempio 3: Trasferimento Postepay

### SMS Ricevuto:
```
Sender: POSTEPAY
Message: Bonifico di €100.00 verso IBAN IT12...
```

### Transazione Rilevata:
```json
{
  "type": "transfer",
  "amount": 100.00,
  "description": "Trasferimento",
  "account": "Postepay",
  "toAccount": "IBAN IT12...",
  "sourceType": "sms",
  "status": "pending"
}
```

### Cosa Succede alla Conferma:
Crea **2 transazioni**:
1. **Expense** da Postepay: -€100.00
2. **Income** su altro account: +€100.00

---

## 💰 Esempio 4: Accredito Stipendio

### SMS Intesa Sanpaolo:
```
Sender: INTESA
Message: Accredito stipendio €2500.00 sul tuo conto
```

### Transazione Rilevata:
```json
{
  "type": "income",
  "amount": 2500.00,
  "description": "Accredito",
  "account": "Intesa Sanpaolo",
  "sourceType": "sms",
  "status": "pending"
}
```

---

## ⚠️ Esempio 5: Duplicato (SMS + Notifica)

### Scenario:
1. **10:30** - Ricevi SMS Revolut: "Hai speso €50 at SuperMarket"
2. **10:31** - Ricevi notifica Revolut: "Payment of €50 at SuperMarket"

### Cosa Succede:
1. SMS parsato → Transazione aggiunta (hash: `abc123`)
2. Notifica parsata → Stesso hash rilevato → **IGNORATA**

### Log:
```
✅ New auto transaction added (SMS)
⚠️ Duplicate transaction detected, skipping (notification)
```

---

## 🧹 Esempio 6: Cleanup Automatico

### Scenario:
- **Giorno 1**: 10 transazioni rilevate
- **Giorno 2**: Utente conferma 5, ignora 3, lascia 2 pending
- **Giorno 31**: Cleanup automatico elimina le 8 confermate/ignorate
- **Risultato**: Solo le 2 pending restano

### Codice:
```typescript
const deleted = await AutoTransactionService.cleanupOldTransactions();
console.log(`🧹 Deleted ${deleted} old transactions`);
```

---

## 📊 Esempio 7: Statistiche

### Codice:
```typescript
const stats = await AutoTransactionService.getStats();
console.log(stats);
```

### Output:
```json
{
  "pending": 3,
  "confirmed": 42,
  "ignored": 8,
  "total": 53
}
```

---

## 🧪 Esempio 8: Test Pattern Custom

### Aggiungi Banca Personalizzata:

```typescript
import { SMSTransactionParser } from './services/sms-transaction-parser';

SMSTransactionParser.addBankConfig({
  name: 'MyBank',
  identifier: 'MYBANK',
  accountName: 'MyBank Account',
  patterns: {
    // Spesa: "Pagamento carta 45.30 EUR presso CONAD"
    expense: /pagamento\s+carta\s+([\d.,]+)\s+EUR\s+presso\s+(.+)/i,
    
    // Entrata: "Bonifico ricevuto 1000 EUR"
    income: /bonifico\s+ricevuto\s+([\d.,]+)\s+EUR/i,
    
    // Trasferimento: "Bonifico inviato 500 EUR a Mario Rossi"
    transfer: /bonifico\s+inviato\s+([\d.,]+)\s+EUR\s+a\s+(.+)/i
  }
});

// Ora MyBank è supportata!
const supported = SMSTransactionParser.getSupportedBanks();
console.log(supported); // [..., 'MyBank']
```

---

## 🔍 Esempio 9: Debug Transaction Hash

### Verifica Hash Duplicato:

```typescript
import { AutoTransactionService } from './services/auto-transaction-service';

const hash1 = AutoTransactionService.generateTransactionHash(
  12.50,
  '2024-12-23',
  'Revolut',
  'AMAZON EU'
);

const hash2 = AutoTransactionService.generateTransactionHash(
  12.50,
  '2024-12-23',
  'Revolut',
  'amazon eu' // Minuscolo
);

console.log(hash1 === hash2); // true (normalizzazione!)

const isDup = await AutoTransactionService.isDuplicate(hash1);
console.log('Is duplicate?', isDup);
```

---

## 📡 Esempio 10: Event Listener Custom

### Ascolta Nuove Transazioni:

```typescript
// In qualsiasi componente React
useEffect(() => {
  const handleNewTransaction = (event: CustomEvent) => {
    const { transaction, source } = event.detail;
    
    console.log(`🆕 Nuova transazione da ${source}:`);
    console.log(`   Tipo: ${transaction.type}`);
    console.log(`   Importo: €${transaction.amount}`);
    console.log(`   Descrizione: ${transaction.description}`);
    
    // Mostra toast custom
    showToast({
      message: `🔔 Nuova ${transaction.type}: €${transaction.amount}`,
      type: 'info'
    });
  };
  
  window.addEventListener('auto-transaction-added', handleNewTransaction as EventListener);
  
  return () => {
    window.removeEventListener('auto-transaction-added', handleNewTransaction as EventListener);
  };
}, []);
```

---

## 🧪 Esempio 11: Test Manuale SMS Scan

### Scansiona SMS Ultimi 3 Giorni:

```typescript
import { SMSTransactionParser } from './services/sms-transaction-parser';

const handleManualScan = async () => {
  const hours = 72; // 3 giorni
  const transactions = await SMSTransactionParser.scanRecentSMS(hours);
  
  console.log(`📱 Scanned ${transactions.length} transactions`);
  transactions.forEach(tx => {
    console.log(`  - ${tx.description}: €${tx.amount}`);
  });
};

// Usa in un bottone
<button onClick={handleManualScan}>Scansiona SMS Recenti</button>
```

---

## 📊 Esempio 12: Dashboard Widget Stats

### Mostra Stats nel Dashboard:

```typescript
import { AutoTransactionService } from './services/auto-transaction-service';

const StatsWidget: React.FC = () => {
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, ignored: 0, total: 0 });
  
  useEffect(() => {
    const loadStats = async () => {
      const s = await AutoTransactionService.getStats();
      setStats(s);
    };
    loadStats();
  }, []);
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-yellow-100 p-4 rounded-lg">
        <div className="text-3xl font-bold">{stats.pending}</div>
        <div className="text-sm text-yellow-700">Pending</div>
      </div>
      <div className="bg-green-100 p-4 rounded-lg">
        <div className="text-3xl font-bold">{stats.confirmed}</div>
        <div className="text-sm text-green-700">Confirmed</div>
      </div>
      <div className="bg-slate-100 p-4 rounded-lg">
        <div className="text-3xl font-bold">{stats.ignored}</div>
        <div className="text-sm text-slate-700">Ignored</div>
      </div>
      <div className="bg-indigo-100 p-4 rounded-lg">
        <div className="text-3xl font-bold">{stats.total}</div>
        <div className="text-sm text-indigo-700">Total</div>
      </div>
    </div>
  );
};
```

---

## 🧪 Esempio 13: Test con Mock Data

### Per sviluppo/testing senza device Android:

```typescript
// test-auto-transactions.ts
import { AutoTransactionService } from './services/auto-transaction-service';

export const addMockTransactions = async () => {
  const mocks = [
    {
      type: 'expense' as const,
      amount: 25.50,
      description: 'Test Amazon',
      date: new Date().toISOString().split('T')[0],
      account: 'Revolut',
      sourceType: 'manual' as const,
      rawText: 'Mock transaction for testing'
    },
    {
      type: 'income' as const,
      amount: 1500.00,
      description: 'Test Stipendio',
      date: new Date().toISOString().split('T')[0],
      account: 'Intesa Sanpaolo',
      sourceType: 'manual' as const,
      rawText: 'Mock income'
    },
    {
      type: 'transfer' as const,
      amount: 100.00,
      description: 'Test Bonifico',
      toAccount: 'BBVA',
      date: new Date().toISOString().split('T')[0],
      account: 'PayPal',
      sourceType: 'manual' as const,
      rawText: 'Mock transfer'
    }
  ];

  for (const mock of mocks) {
    await AutoTransactionService.addAutoTransaction(mock);
  }
  
  console.log('✅ Added 3 mock transactions');
};

// Usa in console o button
// await addMockTransactions();
```

---

## ✅ Test Checklist

### Prima di Deploy:

- [ ] SMS permission granted
- [ ] Notification listener enabled
- [ ] Badge mostra pending count
- [ ] Modal apre/chiude correttamente
- [ ] Conferma crea expense/income
- [ ] Ignora marca come ignored
- [ ] Duplicati vengono skippati
- [ ] Cleanup funziona dopo 30 giorni
- [ ] Navigation back funziona
- [ ] Stats accurate
- [ ] Performance OK (no lag)
- [ ] Battery drain minimo

---

**Buon testing! 🚀**
