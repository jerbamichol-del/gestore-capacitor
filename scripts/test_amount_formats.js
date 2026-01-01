
const patterns = {
    // REVOLUT
    expense: /(?:hai\s+speso|payment\s+of|spent).*?(\d+(?:[.,]\d+)*)\s*€?.*?(?:at|presso|da|in)\s+(.+)/i,
    // GENERIC FALLBACK (most crucial for varied formats)
    generic_expense: /(?:speso|spesa|pagato|pagamento|addebito|autorizzata|autorizzazione|transazione|purchase|sent|spent|payment|prelievo|withdrawal|uscita).*?(\d+(?:[.,]\d+)*)\s*€?.*?(?:presso|at|c\/o|to|a|da|in)\s+(.+)/i
};

// Updated pattern to test (hypothetically improved to handle pre-currency symbols better if needed)
// Current thought: ensure the regex handles "€ 10" and "10 €" and "10 EUR"
// The current regex `.*?(\d+(?:[.,]\d+)*)\s*€?` might miss "€ 10" if the `.*?` eats the `€`. 
// Actually `.*?` is non-greedy, so it should stop at the first digit. But we need to ensure we don't accidentally match a date or something else if the currency symbol is BEFORE.
// Let's test the current "strict" regex against these cases.

const testCases = [
    { text: "Hai speso 1,00 € presso Amazon", expected: 1.00 },
    { text: "Hai speso 1,00€ presso Amazon", expected: 1.00 },
    { text: "Hai speso 1€ presso Amazon", expected: 1.00 },
    { text: "Hai speso 1 € presso Amazon", expected: 1.00 },
    { text: "Hai speso €1 presso Amazon", expected: 1.00 },
    { text: "Hai speso € 1 presso Amazon", expected: 1.00 },
    { text: "Hai speso €1,00 presso Amazon", expected: 1.00 },
    { text: "Hai speso € 1,00 presso Amazon", expected: 1.00 },
    { text: "Hai speso 1 EUR presso Amazon", expected: 1.00 },
    { text: "Hai speso 1EUR presso Amazon", expected: 1.00 },
    { text: "Pagamento 1.250,50 € presso Apple Store", expected: 1250.50 }, // thousands separator
    { text: "Pagamento 1250.50 € presso Apple Store", expected: 1250.50 }, // standard float
];

console.log("--- Testing Revolut / Generic Pattern ---");

let failures = 0;

testCases.forEach(({ text, expected }) => {
    // We try to match with a simplified version of the regex to focus on the amount extraction part
    // mimicking the structure used in sms-transaction-parser.ts

    // Use the GENERIC pattern for all tests to ensure broad coverage
    const regex = patterns.generic_expense;

    // Mocking a smarter parseAmount function
    const parseAmount = (str) => {
        let clean = str.replace(/\s/g, '');
        // European format check: 1.250,50
        // If both . and , exist:
        if (clean.includes('.') && clean.includes(',')) {
            const lastDot = clean.lastIndexOf('.');
            const lastComma = clean.lastIndexOf(',');
            if (lastComma > lastDot) {
                // Euro style (1.000,00): remove dots, replace comma with dot
                clean = clean.replace(/\./g, '').replace(/,/g, '.');
            } else {
                // US style (1,000.00): remove commas
                clean = clean.replace(/,/g, '');
            }
        } else if (clean.includes(',')) {
            // Assume comma is decimal (common in IT)
            clean = clean.replace(/,/g, '.');
        }
        // If only dots, 19.99 -> 19.99 (keep as is)
        // Edge case: 1.000 (meaning 1000). 
        // Logic: if dot follows 3 digits and IS NOT the last separator (hard to know without context).
        // For now, standard JS parseFloat treats dot as decimal.
        return parseFloat(clean);
    };

    const match = text.match(regex);

    let result = "FAIL (No Match)";
    let parsedAmount = null;

    if (match) {
        // Group index in generic pattern: 
        // 1: amount
        // 2: description
        // But pattern might vary. Let's look at the capture group 1.
        const amountStr = match[1];
        parsedAmount = parseAmount(amountStr);

        if (parsedAmount === expected) {
            result = "PASS";
        } else {
            result = `FAIL (Parsed: ${parsedAmount}, Raw: '${amountStr}')`;
            failures++;
        }
    } else {
        failures++;
    }

    console.log(`"${text}" -> ${result}`);
});

if (failures > 0) {
    console.log(`\n❌ Total Failures: ${failures}`);
    process.exit(1);
} else {
    console.log("\n✅ All formats passed!");
}
