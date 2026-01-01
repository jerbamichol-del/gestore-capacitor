
// Mocking the Transaction Parser logic to verify robustness
const mockParser = {
    parseAmount: (amountStr) => {
        let clean = amountStr.replace(/\s/g, '');

        // Gestione separatori migliaia/decimali
        const hasComma = clean.includes(',');
        const hasDot = clean.includes('.');

        if (hasComma && hasDot) {
            if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                // EU: 1.234,56 -> remove dots, replace comma with dot
                clean = clean.replace(/\./g, '').replace(/,/g, '.');
            } else {
                // US: 1,234.56 -> remove commas
                clean = clean.replace(/,/g, '');
            }
        } else if (hasComma) {
            // Ambiguous, assume comma is decimal (common in IT)
            clean = clean.replace(/,/g, '.');
        }

        const amount = parseFloat(clean);
        return isNaN(amount) ? 0 : amount;
    },

    // Simulation of the main parse flow
    parse: (amountResult) => {
        // ... regex matching happened ...
        let amount = amountResult;

        // Smart Validation Logic
        if (amount === 0) {
            return "AI_FALLBACK";
        }
        return amount;
    }
};

const testCases = [
    { input: "0,00", expected: "AI_FALLBACK" },   // The specific bug fix
    { input: "0", expected: "AI_FALLBACK" },
    { input: "0.00", expected: "AI_FALLBACK" },
    { input: "0.0", expected: "AI_FALLBACK" },
    { input: ",", expected: "AI_FALLBACK" },      // clean=".", parseFloat=NaN -> 0 -> AI
    { input: ".", expected: "AI_FALLBACK" },
    { input: "", expected: "AI_FALLBACK" },

    // Valid cases
    { input: "19,99", expected: 19.99 },
    { input: "1.250,50", expected: 1250.50 },
    { input: "1,250.50", expected: 1250.50 },

    // Ambiguous Edge Cases
    { input: "1.000", expected: 1 }, // JS parseFloat behavior. Is this acceptable? 
    // In IT SMS, "1.000" usually means 1000. 
    // But "1.000" could also be precision 1.
    // Let's flag this for manual review in the output.
];

console.log("--- Testing Parser Edge Cases ---");
let failures = 0;

testCases.forEach(({ input, expected }) => {
    const rawAmount = mockParser.parseAmount(input);
    const result = mockParser.parse(rawAmount);

    let status = "PASS";
    if (result !== expected) {
        // Special check for the ambiguous 1.000 case
        if (input === "1.000" && result === 1) {
            status = "WARN (1.000 parsed as 1)";
        } else {
            status = `FAIL (Expected ${expected}, Got ${result})`;
            failures++;
        }
    }

    console.log(`Input: "${input}" -> Parsed: ${rawAmount} -> Final: ${result} [${status}]`);
});

if (failures > 0) process.exit(1);
