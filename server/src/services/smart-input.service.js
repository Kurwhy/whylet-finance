import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import {
    normalizeSpokenAmounts
} from "../utils/indonesian-number.js";

const Decimal = Prisma.Decimal;

const AMOUNT_PATTERN =
    /(?<![\p{L}\p{N}])(?:rp\s*)?(\d[\d.,]*)(?:\s*)(ribu|rb|k|juta|jt)?(?![\p{L}\p{N}])/giu;

const INCOME_WORDS = [
    "gaji", "salary", "freelance", "honor",
    "bonus", "pemasukan", "pendapatan",
    "dibayar", "terima uang", "dapat uang",
    "uang masuk", "refund", "cashback"
];

const CATEGORY_RULES = [
    {
        keywords: ["kopi", "makan", "sarapan", "minum", "snack", "jajan"],
        names: ["makanan", "makan dan minum", "food", "kuliner"]
    },
    {
        keywords: ["parkir", "bensin", "ojek", "grab", "gojek", "transport"],
        names: ["transportasi", "transport"]
    },
    {
        keywords: ["gaji", "salary"],
        names: ["gaji", "salary"]
    },
    {
        keywords: ["freelance", "project", "proyek"],
        names: ["freelance", "pekerjaan sampingan"]
    },
    {
        keywords: ["listrik", "internet", "wifi", "air pdam"],
        names: ["tagihan", "utilities"]
    },
    {
        keywords: ["baju", "sepatu", "belanja"],
        names: ["belanja", "shopping"]
    }
];

function containsPhrase(text, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return new RegExp(
        `(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
        "iu"
    ).test(text);
}

function parseAmount(raw, unit) {
    let number = raw.replace(/\s/g, "");

    if (unit) {
        // Satuan rb/jt: koma atau titik terakhir berarti desimal.
        if (!/^\d+(?:[.,]\d+)?$/.test(number)) return null;
        number = number.replace(",", ".");
    } else {
        // Tanpa satuan: gunakan pemisah ribuan Indonesia.
        // Contoh: 25.000, 1.500.000, 750000.
        if (/^\d{1,3}(?:\.\d{3})+$/.test(number)) {
            number = number.replaceAll(".", "");
        } else if (/^\d{1,3}(?:,\d{3})+$/.test(number)) {
            number = number.replaceAll(",", "");
        } else if (!/^\d+$/.test(number)) {
            return null;
        }
    }

    try {
        const multiplier =
            ["juta", "jt"].includes(unit) ? 1000000 :
                ["ribu", "rb", "k"].includes(unit) ? 1000 : 1;

        const value = new Decimal(number).mul(multiplier);

        if (
            value.lte(0) ||
            value.gt("9999999999999999.99") ||
            value.decimalPlaces() > 2
        ) {
            return null;
        }

        return value.toFixed(2);
    } catch {
        return null;
    }
}

function localISODate(timezone = "Asia/Jakarta") {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());

    const part = (type) =>
        parts.find((item) => item.type === type)?.value;

    return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date, days) {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

function detectCategory(text, type, categories) {
    // Prioritaskan nama kategori yang memang tertulis.
    const direct = [...categories]
        .filter((category) => category.type === type)
        .sort((a, b) => b.name.length - a.name.length)
        .find((category) =>
            containsPhrase(text, category.name.toLowerCase())
        );

    if (direct) return direct;

    for (const rule of CATEGORY_RULES) {
        if (!rule.keywords.some((word) => containsPhrase(text, word))) {
            continue;
        }

        const found = categories.find(
            (category) =>
                category.type === type &&
                rule.names.includes(category.name.toLowerCase())
        );

        if (found) return found;
    }

    return null;
}

export async function parseQuickText(userId, inputText) {
    const originalText = inputText.trim().replace(/\s+/g, " ");

    const text = normalizeSpokenAmounts(originalText);
    const normalized = text.toLowerCase();
    const warnings = [];

    if (text !== originalText) {
        warnings.push(
            "Nominal terbilang telah dikonversi. Pastikan jumlahnya benar."
        );
    }

    const [wallets, categories, settings] = await Promise.all([
        prisma.wallet.findMany({
            where: { userId, isArchived: false }
        }),
        prisma.category.findMany({
            where: { userId, isArchived: false }
        }),
        prisma.userSettings.findUnique({
            where: { userId }
        })
    ]);

    // Cari nominal: jika ada beberapa angka, jangan menebak.
    const matches = [...text.matchAll(AMOUNT_PATTERN)];

    let amount = null;
    let amountMatch = null;

    if (matches.length === 1) {
        const match = matches[0];
        amount = parseAmount(
            match[1],
            match[2]?.toLowerCase()
        );
        amountMatch = match[0];

        if (!amount) {
            warnings.push("Format nominal belum dikenali.");
        }
    } else if (matches.length === 0) {
        warnings.push("Nominal tidak ditemukan. Isi secara manual.");
    } else {
        warnings.push(
            "Ditemukan beberapa angka. Pilih nominal transaksi secara manual."
        );
    }

    const income = INCOME_WORDS.some((word) =>
        containsPhrase(normalized, word)
    );

    const type = income ? "INCOME" : "EXPENSE";

    if (!income) {
        warnings.push(
            "Jenis dianggap Expense. Pastikan sudah sesuai."
        );
    }

    const wallet = [...wallets]
        .sort((a, b) => b.name.length - a.name.length)
        .find((item) =>
            containsPhrase(normalized, item.name.toLowerCase())
        );

    const defaultWallet = wallets.find((item) => item.isDefault);
    const selectedWallet = wallet || defaultWallet || null;

    if (!wallet) {
        warnings.push(
            selectedWallet
                ? `Wallet tidak disebutkan; dipilih ${selectedWallet.name} sebagai draft.`
                : "Wallet belum ditemukan. Buat atau pilih wallet."
        );
    }

    const category = detectCategory(normalized, type, categories);

    if (!category) {
        warnings.push(
            "Kategori belum dikenali. Silakan pilih secara manual."
        );
    }

    const timezone = settings?.timezone || "Asia/Jakarta";
    let transactionDate = localISODate(timezone);

    if (containsPhrase(normalized, "kemarin")) {
        transactionDate = shiftDate(transactionDate, -1);
    } else if (containsPhrase(normalized, "lusa")) {
        transactionDate = shiftDate(transactionDate, 2);
        warnings.push("Tanggal masa depan terdeteksi. Periksa kembali.");
    } else if (containsPhrase(normalized, "besok")) {
        transactionDate = shiftDate(transactionDate, 1);
        warnings.push("Tanggal masa depan terdeteksi. Periksa kembali.");
    }

    let description = text
        .replace(/\b(kemarin|hari ini|tadi|besok|lusa)\b/gi, "")
        .trim();

    if (amountMatch) {
        description = description.replace(amountMatch, "").trim();
    }

    if (wallet) {
        const escaped = wallet.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        description = description.replace(
            new RegExp(`\\b(pakai|dari|ke|via|lewat)\\s+${escaped}\\b`, "iu"),
            ""
        ).trim();
    }

    description = description
        .replace(/\s+/g, " ")
        .replace(/^[,.\s]+|[,.\s]+$/g, "")
        .slice(0, 255);

    if (!description) {
        warnings.push("Deskripsi perlu diisi secara manual.");
    }

    return {
        originalText,
        draft: {
            type,
            amount: amount ?? "",
            walletId: selectedWallet?.id ?? "",
            categoryId: category?.id ?? "",
            description,
            transactionDate,
            inputMethod: "TEXT"
        },
        warnings,
        canSave:
            Boolean(amount) &&
            Boolean(selectedWallet) &&
            Boolean(category) &&
            Boolean(description)
    };
}
