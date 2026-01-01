const body = "UniCredit: autorizzata op.Internet 19,99 EUR carta *1210 c/o Revolut**7215* Dublin 01/01/26 21:59. Per info o blocco 800078777 o +390458064686";
// Old failing pattern:
// const pattern = /(?:Addebito|Pagamento|autorizzata|Transazione).*?€?\s*([\d.,]+)\s*(?:EUR)?.*?(?:presso|at|c\/o|carta.*?c\/o)\s+(.+)/i;

// New strict pattern:
const pattern = /(?:Addebito|Pagamento|autorizzata|Transazione).*?€?\s*(\d+(?:[.,]\d+)*)\s*(?:EUR)?.*?(?:presso|at|c\/o|carta.*?c\/o)\s+(.+)/i;

const match = body.match(pattern);
if (match) {
    console.log("Full match:", match[0]);
    console.log("Group 1 (Amount):", "'" + match[1] + "'");
    console.log("Group 2 (Description):", "'" + match[2] + "'");

    const amountStr = match[1];
    const cleaned = amountStr.replace(/,/g, '.').replace(/\s/g, '');
    const amount = parseFloat(cleaned);
    console.log("Parsed Amount:", amount);
} else {
    console.log("No match found");
}
