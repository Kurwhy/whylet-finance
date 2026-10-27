import { useCallback, useEffect, useRef, useState } from "react";
import TransferForm from "../../components/wallets/TransferForm";
import { useAuth } from "../../context/useAuth";
import WalletForm from "../../components/wallets/WalletForm";
import useAsyncAction from "../../hooks/useAsyncAction";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { CardSkeleton } from "../../components/ui/LoadingSkeleton";
import { transferSchema } from "../../validations/finance.schema";
import {
    Wallet,
    Landmark,
    Smartphone,
    CircleDollarSign,
    Plus,
    ArrowLeftRight,
    Star,
    Pencil,
    Archive,
    RefreshCw,
} from "lucide-react";

import api from "../../lib/api";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import {
    formatRupiah,
    todayLocal,
    getApiError,
} from "../../utils/format";
import { RotateCcw } from "lucide-react";

const walletIcons = {
    CASH: Wallet,
    BANK: Landmark,
    EWALLET: Smartphone,
    OTHER: CircleDollarSign,
};

const initialTransfer = {
    fromWalletId: "",
    toWalletId: "",
    amount: "",
    fee: "0",
    transferDate: todayLocal(),
    note: "",
};

export default function Wallets() {
    const { user } = useAuth();
    const pendingKey = `whylet:pending-transfer:${user.id}`;
    const [recoveredTransfer] = useState(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(pendingKey));
            if (saved?.key && transferSchema.safeParse(saved.data).success) return saved;
        } catch { /* Penyimpanan browser mungkin tidak tersedia. */ }
        return null;
    });
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");

    const [walletModal, setWalletModal] = useState(false);
    const [transferModal, setTransferModal] = useState(Boolean(recoveredTransfer));
    const [editingWallet, setEditingWallet] = useState(null);

    const [transferForm, setTransferForm] = useState(recoveredTransfer?.data || initialTransfer);

    const { execute, loading: busy } = useAsyncAction();
    const [archiveTarget, setArchiveTarget] = useState(null);
    const transferKey = useRef(recoveredTransfer?.key || null);
    const transferSnapshot = useRef(recoveredTransfer?.data || null);
    const [transferUncertain, setTransferUncertain] = useState(Boolean(recoveredTransfer));

    const loadWallets = useCallback(async () => {
        try {
            setError("");

            const response = await api.get("/wallets");
            setWallets(response.data.data);
        } catch (err) {
            setError(getApiError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        api.get("/wallets", { signal: controller.signal }).then(response => {
            setWallets(response.data.data);
        }).catch(err => { if (!controller.signal.aborted) setError(getApiError(err)); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, []);

    const activeWallets = wallets.filter((w) => !w.isArchived);
    const archivedWallets = wallets.filter((w) => w.isArchived);

    const totalBalance = wallets.reduce(
        (sum, wallet) => sum + Number(wallet.balance),
        0
    );

    function openCreateWallet() {
        setEditingWallet(null);
        setFormError("");
        setWalletModal(true);
    }

    function openEditWallet(wallet) {
        setEditingWallet(wallet);
        setFormError("");
        setWalletModal(true);
    }

    async function onSubmitWallet(data) {
        setFormError("");
        const result = await execute(() => editingWallet
            ? api.patch(`/wallets/${editingWallet.id}`, { name: data.name, type: data.type })
            : api.post("/wallets", data), {
            successMessage: editingWallet ? "Dompet berhasil diperbarui." : "Dompet berhasil ditambahkan."
        });
        if (result.ok) {
            setWalletModal(false);
            await loadWallets();
        } else if (!result.skipped) setFormError(result.message);
    }

    async function setDefault(wallet) {
        if (wallet.isDefault) return;
        const result = await execute(() => api.patch(`/wallets/${wallet.id}/default`), {
            successMessage: "Dompet utama berhasil diubah."
        });
        if (result.ok) await loadWallets();
    }

    async function archiveWallet() {
        if (!archiveTarget) return;
        const result = await execute(() => api.patch(`/wallets/${archiveTarget.id}/archive`), {
            successMessage: "Dompet berhasil diarsipkan."
        });
        if (result.ok) {
            setArchiveTarget(null);
            await loadWallets();
        }
    }

    function openTransfer() {
        if (activeWallets.length < 2) return;

        const source =
            activeWallets.find((w) => w.isDefault) || activeWallets[0];

        const destination = activeWallets.find(
            (w) => w.id !== source.id
        );

        transferKey.current = crypto.randomUUID();
        transferSnapshot.current = null;
        setTransferUncertain(false);
        setTransferForm({
            ...initialTransfer,
            fromWalletId: source.id,
            toWalletId: destination?.id || "",
            transferDate: todayLocal(),
        });

        setFormError("");
        setTransferModal(true);
    }

    async function submitTransfer(data) {
        const parsed = transferSchema.safeParse(transferSnapshot.current || data);
        if (!parsed.success) {
            setFormError(parsed.error.issues[0].message);
            return;
        }
        if (!transferUncertain && (!activeWallets.some(w => w.id === parsed.data.fromWalletId) ||
            !activeWallets.some(w => w.id === parsed.data.toWalletId))) {
            setFormError("Pilih dompet aktif yang valid.");
            return;
        }
        setFormError("");
        transferSnapshot.current = parsed.data;
        try { sessionStorage.setItem(pendingKey, JSON.stringify({ key: transferKey.current, data: parsed.data })); } catch { /* Retry tetap memakai kunci di memori. */ }
        const result = await execute(() => api.post("/transfers", parsed.data, {
            headers: { "Idempotency-Key": transferKey.current }
        }), { successMessage: "Transfer berhasil dicatat." });
        if (result.ok) {
            try { sessionStorage.removeItem(pendingKey); } catch { /* Penyimpanan browser tidak tersedia. */ }
            setTransferUncertain(false);
            transferSnapshot.current = null;
            setTransferModal(false);
            await loadWallets();
        } else if (!result.skipped) {
            const status = result.error.response?.status;
            const uncertain = !status || status >= 500 || (transferUncertain && [401, 403, 429].includes(status));
            setTransferUncertain(uncertain);
            if (!uncertain) {
                transferSnapshot.current = null;
                try { sessionStorage.removeItem(pendingKey); } catch { /* Penyimpanan browser tidak tersedia. */ }
            }
            setFormError(uncertain
                ? "Status transfer belum diketahui. Coba lagi untuk memeriksa permintaan yang sama."
                : result.message);
        }
    }

    async function unarchiveWallet(wallet) {
        const result = await execute(() => api.patch(`/wallets/${wallet.id}/unarchive`), {
            successMessage: "Dompet berhasil dipulihkan."
        });
        if (result.ok) await loadWallets();
    }

    if (loading) {
        return (
            <div role="status" aria-label="Memuat dompet" className="grid gap-4 md:grid-cols-3">
                <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold tracking-widest text-emerald-700">
                        PENGELOLAAN KEUANGAN
                    </p>
                    <h1 className="mt-1 text-3xl font-bold">Dompet Saya</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Kelola rekening, uang tunai, dan dompet digital dalam satu tempat.
                    </p>
                </div>

                <button
                    onClick={openCreateWallet}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                    <Plus size={18} />
                    Tambah Dompet
                </button>
            </div>

            {error && (
                <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    {error}
                    <button
                        onClick={loadWallets}
                        className="ml-3 underline"
                    >
                        Coba lagi
                    </button>
                </div>
            )}

            <div className="rounded-3xl bg-emerald-950 p-7 text-white sm:p-8">
                <p className="text-sm text-emerald-200">Total Saldo</p>
                <h2 className="mt-3 break-words text-3xl font-bold sm:text-4xl">
                    {formatRupiah(totalBalance)}
                </h2>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm text-emerald-100/75">
                        {activeWallets.length} dompet aktif
                    </p>

                    <button
                        onClick={openTransfer}
                        disabled={activeWallets.length < 2 || busy}
                        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50"
                    >
                        <ArrowLeftRight size={17} />
                        Transfer Antar-Dompet
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Dompet Aktif</h2>
                <button
                    onClick={() => {
                        setLoading(true);
                        loadWallets();
                    }}
                    aria-label="Muat ulang dompet"
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {activeWallets.length === 0 ? (
                <EmptyState
                    icon={Wallet}
                    title="Belum Ada Dompet"
                    description="Tambahkan dompet pertamamu untuk mulai mencatat pemasukan dan pengeluaran."
                    actionLabel="Tambah Dompet"
                    onAction={openCreateWallet}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {activeWallets.map((wallet) => {
                        const Icon = walletIcons[wallet.type] || Wallet;

                        return (
                            <div
                                key={wallet.id}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                                        <Icon size={22} />
                                    </div>

                                    {wallet.isDefault && (
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            Utama
                                        </span>
                                    )}
                                </div>

                                <h3 className="mt-5 text-lg font-bold">{wallet.name}</h3>
                                <p className="text-xs text-slate-500">{({ CASH: "Tunai", BANK: "Bank", EWALLET: "Dompet Digital", OTHER: "Lainnya" })[wallet.type]}</p>

                                <p className="mt-5 text-xs text-slate-500">
                                    Saldo Tersedia
                                </p>
                                <h4 className="mt-1 break-words text-2xl font-bold">
                                    {formatRupiah(wallet.balance)}
                                </h4>

                                <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                    <button
                                        onClick={() => openEditWallet(wallet)}
                                        disabled={busy}
                                        className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold hover:bg-slate-200"
                                    >
                                        <Pencil size={14} /> Edit
                                    </button>

                                    {!wallet.isDefault && (
                                        <>
                                            <button
                                                onClick={() => setDefault(wallet)}
                                                disabled={busy}
                                                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                            >
                                                <Star size={14} /> Jadikan Utama
                                            </button>

                                            <button
                                                onClick={() => setArchiveTarget(wallet)}
                                                disabled={busy}
                                                className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                                            >
                                                <Archive size={14} /> Arsipkan
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {archivedWallets.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="font-bold text-slate-800">
                        Dompet Diarsipkan
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Riwayat dompet tetap tersimpan.
                    </p>

                    <div className="mt-4 divide-y divide-slate-100">
                        {archivedWallets.map((wallet) => (
                            <div
                                key={wallet.id}
                                className="flex items-center justify-between gap-3 py-3"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {wallet.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {formatRupiah(wallet.balance)}
                                    </p>
                                </div>

                                <button
                                    onClick={() => unarchiveWallet(wallet)}
                                    disabled={busy}
                                    className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                    <RotateCcw size={15} />
                                    Pulihkan
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <ConfirmDialog open={Boolean(archiveTarget)}
                onOpenChange={(open) => !open && setArchiveTarget(null)}
                title="Arsipkan Dompet?"
                description={`Arsipkan dompet "${archiveTarget?.name || ""}"? Riwayat keuangan tetap tersimpan.`}
                confirmText="Ya, Arsipkan" loading={busy} onConfirm={archiveWallet} />
            <Modal
                open={walletModal}
                title={editingWallet ? "Ubah Dompet" : "Tambah Dompet"}
                onClose={() => !busy && setWalletModal(false)}
            >
                {formError && <p role="alert" className="mb-4 text-sm text-red-700">{formError}</p>}
                <WalletForm wallet={editingWallet} onSave={onSubmitWallet}
                    onCancel={() => !busy && setWalletModal(false)} loading={busy} />
            </Modal>

            <Modal
                open={transferModal}
                title="Transfer Antar-Dompet"
                onClose={() => !busy && !transferUncertain && setTransferModal(false)}
            >
                {(formError || transferUncertain) && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    {formError || "Status transfer sebelumnya belum diketahui. Periksa ulang dengan permintaan yang sama."}
                </p>}
                <TransferForm initialValues={transferForm} wallets={activeWallets}
                    loading={busy} uncertain={transferUncertain} onSave={submitTransfer} />
            </Modal>
        </div>
    );
}