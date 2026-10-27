import { useEffect, useRef, useState } from "react";
import {
    Sparkles,
    ArrowRight,
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    LoaderCircle,
    Mic,
    MicOff,
    Keyboard
} from "lucide-react";

import { transactionSchema } from "../../validations/finance.schema";
import { notify } from "../../utils/notify";
import Modal from "../ui/Modal";
import api from "../../lib/api";
import { formatRupiah, getApiError } from "../../utils/format";
import {
    useSpeechRecognition
} from "../../hooks/useSpeechRecognition";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const examples = [
    "tadi beli kopi 25rb pakai DANA",
    "kemarin bayar parkir 5k",
    "gaji 3,5 juta masuk BCA"
];

export default function SmartTextModal({
    open,
    onClose,
    wallets,
    categories,
    onSaved
}) {
    const actionRef = useRef(false);
    const [text, setText] = useState("");
    const [inputMode, setInputMode] = useState("TEXT");
    const [draft, setDraft] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [step, setStep] = useState("input");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const {
        supported,
        listening,
        error: speechError,
        startListening,
        stopListening,
        cancelListening,
    } = useSpeechRecognition((transcript) => {
        setText(transcript);
        setInputMode("VOICE");
        setError("");
    });

    useEffect(() => {
        if (!open) {
            cancelListening();
        }
    }, [open, cancelListening]);

    const activeWallets = wallets.filter((w) => !w.isArchived);
    const availableWallets = activeWallets;
    const availableCategories = categories.filter(
        (c) => !c.isArchived && c.type === draft?.type
    );

    function close() {
        if (actionRef.current) return;
        cancelListening();

        setText("");
        setInputMode("TEXT");
        setDraft(null);
        setWarnings([]);
        setStep("input");
        setError("");
        onClose();
    }

    async function handleParse(event) {
        event.preventDefault();
        if (text.trim().length < 3 || text.length > 300) {
            setError("Masukkan teks transaksi sepanjang 3–300 karakter.");
            return;
        }
        if (actionRef.current) return;

        actionRef.current = true;
        setBusy(true);
        setError("");

        try {
            const response = await api.post("/smart-input/parse", {
                text
            });

            const result = response.data.data;

            setDraft({
                ...result.draft,
                inputMethod: inputMode,
            });
            setWarnings(result.warnings || []);
            setStep("review");
        } catch (err) {
            setError(getApiError(err));
        } finally {
            actionRef.current = false;
            setBusy(false);
        }
    }

    function changeType(type) {
        const matchingCategory = categories.find(
            (category) => category.type === type
        );

        setDraft((old) => ({
            ...old,
            type,
            categoryId: matchingCategory?.id || ""
        }));
    }

    function updateDraft(key, value) {
        setDraft((old) => ({
            ...old,
            [key]: value
        }));
    }

    async function handleSave(event) {
        event.preventDefault();
        if (actionRef.current || !draft) return;

        const parsed = transactionSchema.safeParse(draft);
        if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
        }
        if (!availableWallets.some(w => w.id === draft.walletId) || !availableCategories.some(c => c.id === draft.categoryId)) {
            setError("Pilih dompet aktif dan kategori yang sesuai.");
            return;
        }

        actionRef.current = true;
        setBusy(true);
        setError("");

        try {
            await api.post("/transactions", {
                type: draft.type,
                amount: draft.amount,
                walletId: draft.walletId,
                categoryId: draft.categoryId,
                description: draft.description.trim(),
                transactionDate: draft.transactionDate,
                inputMethod: draft.inputMethod
            });

            notify.success("Transaksi berhasil disimpan.");
            closeAfterSave();
            await onSaved();
        } catch (err) {
            setError(getApiError(err));
        } finally {
            actionRef.current = false;
            setBusy(false);
        }
    }

    function closeAfterSave() {
        cancelListening();

        setText("");
        setInputMode("TEXT");
        setDraft(null);
        setWarnings([]);
        setStep("input");
        setError("");
        onClose();
    }

    return (
        <Modal
            open={open}
            onClose={close}
            title={step === "input"
                ? "Input Cepat"
                : "Periksa Transaksi"}
        >
            {error && (
                <div
                    role="alert"
                    className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {step === "input" ? (
                <form noValidate onSubmit={handleParse} className="space-y-5">
                    <div className="rounded-2xl bg-emerald-50 p-4">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <Sparkles size={20} />
                            <span className="font-semibold">
                                Tulis dengan bahasa sehari-hari
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-emerald-800/80">
                            Ceritakan transaksi seperti sedang mengetik pesan.
                            Whylet akan membuat draf otomatis.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <Mic size={19} className="text-emerald-700" />
                            <h3 className="font-bold text-slate-900">
                                Input Suara
                            </h3>
                        </div>

                        <div className="flex flex-col items-center gap-3 py-3">
                            <button
                                type="button"
                                disabled={!supported || busy}
                                onClick={() => {
                                    if (listening) {
                                        stopListening();
                                    } else {
                                        startListening();
                                    }
                                }}
                                aria-label={
                                    listening
                                        ? "Hentikan pengenalan suara"
                                        : "Mulai pengenalan suara"
                                }
                                aria-pressed={listening}
                                className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${listening
                                    ? "animate-pulse bg-rose-500 text-white shadow-rose-200"
                                    : "bg-emerald-700 text-white shadow-emerald-200 hover:bg-emerald-800"
                                    }`}
                            >
                                {listening
                                    ? <MicOff size={31} />
                                    : <Mic size={31} />}
                            </button>

                            <p aria-live="polite" className="text-center text-sm font-semibold">
                                {listening
                                    ? "Mendengarkan... silakan berbicara"
                                    : "Tekan mikrofon untuk mulai"}
                            </p>

                            <p className="text-center text-xs text-slate-500">
                                Contoh: &quot;Beli sarapan lima belas ribu pakai DANA&quot;
                            </p>
                        </div>

                        {!supported && (
                            <p role="alert" className="mt-3 text-center text-xs text-amber-700">
                                Browser ini belum mendukung pengenalan suara.
                                Kamu tetap bisa menggunakan Input Cepat.
                            </p>
                        )}

                        {speechError && (
                            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                                {speechError}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                        <Keyboard size={17} />
                        <span>
                            Hasil suara bisa diedit seperti teks biasa
                        </span>
                    </div>

                    <div>
                        <label htmlFor="smart-text" className="mb-2 block text-sm font-semibold">
                            Apa pemasukan atau pengeluaranmu?
                        </label>
                        <textarea
                            id="smart-text"
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);

                                if (inputMode !== "VOICE") {
                                    setInputMode("TEXT");
                                }
                            }}
                            required
                            minLength={3}
                            maxLength={300}
                            rows={4}
                            placeholder="Contoh: tadi beli kopi 25rb pakai DANA"
                            className={inputClass}
                        />
                        <p className="mt-2 text-right text-xs text-slate-500">
                            {text.length}/300
                        </p>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-semibold text-slate-500">
                            Coba contoh berikut:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {examples.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    onClick={() => {
                                        cancelListening();
                                        setText(example);
                                        setInputMode("TEXT");
                                    }}
                                    className="rounded-full border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        disabled={
                            busy ||
                            listening ||
                            activeWallets.length === 0 ||
                            text.trim().length < 3
                        }
                        type="submit"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                        {busy
                            ? <LoaderCircle className="animate-spin" size={18} />
                            : <Sparkles size={18} />}
                        Buat Draf
                        {!busy && <ArrowRight size={18} />}
                    </button>

                    {activeWallets.length === 0 && (
                        <p className="text-center text-xs text-rose-700">
                            Buat dompet terlebih dahulu sebelum menggunakan Input Cepat.
                        </p>
                    )}
                </form>
            ) : (
                <form noValidate onSubmit={handleSave} className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 size={18} />
                            Draf berhasil dibuat
                        </div>
                        <p className="mt-2 text-sm text-emerald-800">
                            Periksa dan koreksi informasi sebelum menyimpan.
                        </p>
                    </div>

                    {warnings.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                <AlertCircle size={17} />
                                Perlu diperiksa
                            </div>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                                {warnings.map((warning, index) => (
                                    <li key={index}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                        {["EXPENSE", "INCOME"].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => changeType(type)}
                                className={`rounded-lg py-2 text-sm font-semibold ${draft.type === type
                                    ? "bg-white text-emerald-700 shadow-sm"
                                    : "text-slate-500"
                                    }`}
                            >
                                {type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label htmlFor="smart-amount" className="mb-2 block text-sm font-semibold">
                            Nominal (Rp)
                        </label>
                        <input
                            required
                            inputMode="decimal"
                            pattern="[0-9]+(\.[0-9]{1,2})?"
                            id="smart-amount"
                            value={draft.amount}
                            onChange={(e) => updateDraft("amount", e.target.value)}
                            className={inputClass}
                            placeholder="25000"
                        />
                    </div>

                    <div>
                        <label htmlFor="smart-description" className="mb-2 block text-sm font-semibold">
                            Keterangan
                        </label>
                        <input
                            required
                            maxLength={255}
                            id="smart-description"
                            value={draft.description}
                            onChange={(e) =>
                                updateDraft("description", e.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="smart-wallet" className="mb-2 block text-sm font-semibold">
                            Dompet
                        </label>
                        <select
                            required
                            id="smart-wallet"
                            value={draft.walletId}
                            onChange={(e) =>
                                updateDraft("walletId", e.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="">Pilih Dompet</option>
                            {availableWallets.map((wallet) => (
                                <option key={wallet.id} value={wallet.id}>
                                    {wallet.name} — {formatRupiah(wallet.balance)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="smart-category" className="mb-2 block text-sm font-semibold">
                            Kategori
                        </label>
                        <select
                            required
                            id="smart-category"
                            value={draft.categoryId}
                            onChange={(e) =>
                                updateDraft("categoryId", e.target.value)
                            }
                            className={inputClass}
                        >
                            <option value="">Pilih Kategori</option>
                            {availableCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                            Jika belum ada kategori yang sesuai, buat kategori
                            melalui halaman Transaksi terlebih dahulu.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="smart-date" className="mb-2 block text-sm font-semibold">
                            Tanggal Transaksi
                        </label>
                        <input
                            type="date"
                            required
                            id="smart-date"
                            value={draft.transactionDate}
                            onChange={(e) =>
                                updateDraft("transactionDate", e.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setStep("input");
                                setError("");
                            }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 font-semibold text-slate-600"
                        >
                            <ArrowLeft size={17} />
                            Kembali
                        </button>
                        <button
                            disabled={busy}
                            type="submit"
                            className="flex-[2] rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                            {busy ? "Menyimpan..." : "Konfirmasi dan Simpan"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}