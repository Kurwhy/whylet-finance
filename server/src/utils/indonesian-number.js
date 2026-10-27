const DIGITS = {
    nol: 0,
    satu: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
};

const SPECIAL = {
    sepuluh: 10,
    sebelas: 11,
    seratus: 100,
    seribu: 1000,
    sejuta: 1000000,
};

const TOKENS = [
    ...Object.keys(DIGITS),
    ...Object.keys(SPECIAL),
    "belas",
    "puluh",
    "ratus",
    "ribu",
    "juta",
];

const tokenPattern = TOKENS
    .sort((a, b) => b.length - a.length)
    .join("|");

const NUMBER_PHRASE = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${tokenPattern})(?:\\s+(?:${tokenPattern}))*(?![\\p{L}\\p{N}])`,
    "giu"
);

function parseNumberWords(words) {
    const tokens = words.toLowerCase().split(/\s+/);

    // Jangan menafsirkan "satu" saja sebagai harga transaksi.
    const hasUnit = tokens.some((word) =>
        [
            "belas", "puluh", "ratus",
            "ribu", "juta",
            ...Object.keys(SPECIAL),
        ].includes(word)
    );

    if (!hasUnit) return null;

    let total = 0;
    let group = 0;

    for (const word of tokens) {
        if (word in DIGITS) {
            group += DIGITS[word];
        } else if (word === "sepuluh") {
            group += 10;
        } else if (word === "sebelas") {
            group += 11;
        } else if (word === "seratus") {
            group += 100;
        } else if (word === "seribu") {
            total += 1000;
        } else if (word === "sejuta") {
            total += 1000000;
        } else if (word === "belas") {
            group += 10;
        } else if (word === "puluh") {
            group *= 10;
        } else if (word === "ratus") {
            group *= 100;
        } else if (word === "ribu") {
            total += group * 1000;
            group = 0;
        } else if (word === "juta") {
            total += group * 1000000;
            group = 0;
        }
    }

    const result = total + group;

    if (
        !Number.isSafeInteger(result) ||
        result <= 0
    ) {
        return null;
    }

    return String(result);
}

export function normalizeSpokenAmounts(text) {
    return text.replace(NUMBER_PHRASE, (match) => {
        const number = parseNumberWords(match);

        return number ?? match;
    });
}
