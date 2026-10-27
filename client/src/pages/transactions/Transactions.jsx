import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Plus,
    Search,
    ArrowDownLeft,
    ArrowUpRight,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Tags,
    Sparkles,
} from "lucide-react";

import TransactionForm from "../../components/transactions/TransactionForm";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import EmptyState from "../../components/ui/EmptyState";
import api from "../../lib/api";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import SmartTextModal from "../../components/smart-input/SmartTextModal";
import {
    formatRupiah,
    formatDate,
    todayLocal,
    getApiError,
} from "../../utils/format";
import { notify } from "../../utils/notify";
import { getPesanKesalahan } from "../../utils/messages";

const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function emptyTransaction() {
    return {
        walletId: "",
        categoryId: "",
        type: "EXPENSE",
        amount: "",
        description: "",
        transactionDate: todayLocal(),
        inputMethod: "MANUAL",
    };
}

export default function Transactions() {
    const mutationRef = useRef(false);
    const requestRef = useRef(0);
    const [transactions, setTransactions] = useState([]);
    const [wallets, setWallets] = useState([]);
    const [categories, setCategories] = useState([]);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [referenceError, setReferenceError] = useState("");
    const [formError, setFormError] = useState("");

    const [modalOpen, setModalOpen] = useState(false);
    const [categoryModal, setCategoryModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);

    // State untuk Confirm Dialog Hapus Transaksi
    const [transaksiDihapus, setTransaksiDihapus] = useState(null);
    const [sedangMenghapus, setSedangMenghapus] = useState(false);

    const [form, setForm] = useState(emptyTransaction());
    const [categoryForm, setCategoryForm] = useState({
        name: "",
        type: "EXPENSE",
    });

    const [smartTextOpen, setSmartTextOpen] = useState(false);

    const [filters, setFilters] = useState({
        type: "",
        walletId: "",
        startDate: "",
        endDate: "",
    });

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });

    const loadReferences = useCallback(async () => {
        setReferenceError("");
        const [walletResponse, categoryResponse] = await Promise.all([
            api.get("/wallets"),
            api.get("/categories"),
        ]);

        setWallets(walletResponse.data.data);
        setCategories(categoryResponse.data.data);
    }, []);

    const loadTransactions = useCallback(async () => {
        const request = ++requestRef.current;
        if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
            setError("Tanggal akhir harus sama dengan atau setelah tanggal awal.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError("");

            const params = {
                page,
                limit: 20,
            };

            if (filters.type) params.type = filters.type;
            if (filters.walletId) params.walletId = filters.walletId;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;

            const response = await api.get("/transactions", {
                params,
            });

            if (request !== requestRef.current) return;
            setTransactions(response.data.data.items);
            setPagination(response.data.data.pagination);
        } catch (err) {
            if (request === requestRef.current) setError(getApiError(err));
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    }, [page, filters]);

    useEffect(() => {
        loadReferences().catch((err) => {
            setReferenceError(getApiError(err));
        });
    }, [loadReferences]);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    const activeWallets = useMemo(
        () => wallets.filter((wallet) => !wallet.isArchived),
        [wallets]
    );


    const visibleTransactions = transactions.filter((item) => {
        const query = search.toLowerCase().trim();

        if (!query) return true;

        return [
            item.description,
            item.wallet?.name,
            item.category?.name,
        ]
            .some((value) => value?.toLowerCase().includes(query));
    });

    function changeFilter(key, value) {
        setFilters((current) => ({
            ...current,
            [key]: value,
        }));
        setPage(1);
    }

    function openCreate() {
        if (activeWallets.length === 0) {
            setError("Buat dompet aktif terlebih dahulu.");
            return;
        }

        const preferredWallet =
            activeWallets.find((w) => w.isDefault) ||
            activeWallets[0];

        setEditingTransaction(null);
        setForm({
            ...emptyTransaction(),
            walletId: preferredWallet.id,
            categoryId:
                categories.find((c) => !c.isArchived && c.type === "EXPENSE")?.id || "",
        });
        setFormError("");
        setModalOpen(true);
    }

    function openEdit(item) {
        if (item.transferId) {
            setError(
                "Biaya admin transfer tidak dapat diedit dari menu transaksi."
            );
            return;
        }

        setEditingTransaction(item);
        setForm({
            walletId: item.walletId,
            categoryId: item.categoryId,
            type: item.type,
            amount: item.amount,
            description: item.description,
            transactionDate: item.transactionDate.slice(0, 10),
            inputMethod: item.inputMethod,
        });
        setFormError("");
        setModalOpen(true);
    }

    async function saveTransaction(data) {
        if (mutationRef.current) return;

        if (!data.categoryId) {
            setFormError("Buat kategori terlebih dahulu.");
            return;
        }

        mutationRef.current = true;
        setBusy(true);
        setFormError("");

        try {
            if (editingTransaction) {
                await api.patch(
                    `/transactions/${editingTransaction.id}`,
                    {
                        walletId: data.walletId,
                        categoryId: data.categoryId,
                        type: data.type,
                        amount: data.amount,
                        description: data.description,
                        transactionDate: data.transactionDate,
                    }
                );
            } else {
                await api.post("/transactions", { ...data, inputMethod: "MANUAL" });
            }

            notify.success("Transaksi berhasil disimpan.");
            setModalOpen(false);
            await Promise.all([
                loadTransactions(),
                loadReferences(),
            ]);
        } catch (err) {
            setFormError(getApiError(err));
            notify.error(getApiError(err));
        } finally {
            mutationRef.current = false;
            setBusy(false);
        }
    }

    async function hapusTransaksi() {
        if (!transaksiDihapus || mutationRef.current) return;
        mutationRef.current = true;

        setSedangMenghapus(true);

        try {
            await api.delete(`/transactions/${transaksiDihapus.id}`);

            setTransaksiDihapus(null);

            notify.success("Transaksi berhasil dihapus.");

            await Promise.all([
                loadTransactions(),
                loadReferences(),
            ]);
        } catch (error) {
            notify.error(getPesanKesalahan(error));
        } finally {
            mutationRef.current = false;
            setSedangMenghapus(false);
        }
    }

    function openCreateCategory(type = form.type) {
        setCategoryForm({
            name: "",
            type: typeof type === "string" ? type : form.type,
        });
        setFormError("");
        setCategoryModal(true);
    }

    async function saveCategory(event) {
        event.preventDefault();
        if (mutationRef.current) return;

        if (categoryForm.name.trim().length < 2 || categoryForm.name.trim().length > 100) {
            setFormError("Nama kategori harus terdiri dari 2–100 karakter.");
            return;
        }
        mutationRef.current = true;
        setBusy(true);
        setFormError("");

        try {
            const response = await api.post("/categories", categoryForm);
            const created = response.data.data;

            await loadReferences();

            setForm((current) => ({
                ...current,
                type: created.type,
                categoryId: created.id,
            }));

            notify.success("Kategori berhasil ditambahkan.");
            setCategoryModal(false);
        } catch (err) {
            setFormError(getApiError(err));
        } finally {
            mutationRef.current = false;
            setBusy(false);
        }
    }

    return (
        <div className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold tracking-widest text-emerald-700">
                        AKTIVITAS KEUANGAN
                    </p>
                    <h1 className="mt-1 text-3xl font-bold">Transaksi</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Kelola pemasukan dan pengeluaranmu dengan mudah.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => openCreateCategory()}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                    >
                        <Tags size={17} />
                        <span className="hidden sm:inline">Tambah Kategori</span>
                    </button>

                    <button
                        onClick={() => setSmartTextOpen(true)}
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                        <Sparkles size={18} />
                        Input Cepat
                    </button>

                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                        <Plus size={18} />
                        Tambah Transaksi
                    </button>
                </div>
            </div>

            {(error || referenceError) && (
                <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                    {error || referenceError}
                    <button className="ml-3 underline" onClick={() => { loadTransactions(); loadReferences().catch(err => setReferenceError(getApiError(err))); }}>Coba lagi</button>
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                    <Search size={18} className="text-slate-500" />
                    <h2 className="font-semibold">Pencarian dan Filter</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari deskripsi..."
                        aria-label="Cari transaksi"
                        className={inputClass}
                    />

                    <select
                        value={filters.type}
                        onChange={(e) => changeFilter("type", e.target.value)}
                        aria-label="Filter jenis transaksi"
                        className={inputClass}
                    >
                        <option value="">Semua Jenis</option>
                        <option value="INCOME">Pemasukan</option>
                        <option value="EXPENSE">Pengeluaran</option>
                    </select>

                    <select
                        value={filters.walletId}
                        onChange={(e) => changeFilter("walletId", e.target.value)}
                        aria-label="Filter dompet"
                        className={inputClass}
                    >
                        <option value="">Semua Dompet</option>
                        {wallets.map((wallet) => (
                            <option key={wallet.id} value={wallet.id}>
                                {wallet.name}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => {
                            setSearch("");
                            setFilters({
                                type: "",
                                walletId: "",
                                startDate: "",
                                endDate: "",
                            });
                            setPage(1);
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Atur Ulang Filter
                    </button>

                    <div>
                        <label htmlFor="filter-start-date" className="mb-1 block text-xs text-slate-500">
                            Tanggal Awal
                        </label>
                        <input
                            type="date"
                            id="filter-start-date"
                            value={filters.startDate}
                            onChange={(e) => changeFilter("startDate", e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="filter-end-date" className="mb-1 block text-xs text-slate-500">
                            Tanggal Akhir
                        </label>
                        <input
                            type="date"
                            id="filter-end-date"
                            value={filters.endDate}
                            onChange={(e) => changeFilter("endDate", e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                    Pencarian teks berlaku pada halaman transaksi yang sedang ditampilkan.
                </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <h2 className="font-bold">Riwayat Transaksi</h2>
                    <span className="text-xs text-slate-500">
                        {pagination.total} transaksi
                    </span>
                </div>

                {loading ? (
                    <TableSkeleton />
                ) : visibleTransactions.length === 0 ? (
                    <EmptyState title="Tidak Ada Transaksi" description="Coba ubah filter atau tambahkan transaksi." />
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Transaksi</th>
                                        <th className="px-5 py-4">Tanggal</th>
                                        <th className="px-5 py-4">Dompet</th>
                                        <th className="px-5 py-4">Nominal</th>
                                        <th className="px-5 py-4 text-right">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visibleTransactions.map((item) => (
                                        <tr key={item.id}>
                                            <td className="px-5 py-4">
                                                <div className="font-semibold">
                                                    {item.description}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {item.category?.name}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-500">
                                                {formatDate(item.transactionDate)}
                                            </td>
                                            <td className="px-5 py-4 text-slate-500">
                                                {item.wallet?.name}
                                            </td>
                                            <td className={`px-5 py-4 font-bold ${item.type === "INCOME"
                                                ? "text-emerald-700"
                                                : "text-rose-700"
                                                }`}>
                                                {item.type === "INCOME" ? "+" : "−"}
                                                {formatRupiah(item.amount)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        disabled={busy || sedangMenghapus || Boolean(item.transferId)}
                                                        onClick={() => openEdit(item)}
                                                        aria-label={`Edit ${item.description}`}
                                                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                                                    >
                                                        <Pencil size={17} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={busy || sedangMenghapus || Boolean(item.transferId)}
                                                        onClick={() => setTransaksiDihapus(item)}
                                                        aria-label={`Hapus ${item.description}`}
                                                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                                                    >
                                                        <Trash2 size={17} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="divide-y divide-slate-100 md:hidden">
                            {visibleTransactions.map((item) => {
                                const income = item.type === "INCOME";

                                return (
                                    <div key={item.id} className="flex gap-3 p-4">
                                        <div className={`h-fit rounded-xl p-3 ${income
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-rose-50 text-rose-700"
                                            }`}>
                                            {income
                                                ? <ArrowDownLeft size={19} />
                                                : <ArrowUpRight size={19} />}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold">
                                                {item.description}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {item.category?.name} · {item.wallet?.name}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatDate(item.transactionDate)}
                                            </p>

                                            <div className="mt-3 flex gap-3">
                                                <button
                                                    disabled={busy || sedangMenghapus || Boolean(item.transferId)}
                                                    onClick={() => openEdit(item)}
                                                    className="text-xs font-semibold text-slate-600 disabled:opacity-30"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busy || sedangMenghapus || Boolean(item.transferId)}
                                                    onClick={() => setTransaksiDihapus(item)}
                                                    className="text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-30"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </div>

                                        <p className={`text-right text-sm font-bold ${income ? "text-emerald-700" : "text-rose-700"
                                            }`}>
                                            {income ? "+" : "−"}
                                            {formatRupiah(item.amount)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                    <span className="text-xs text-slate-500">
                        Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                    </span>

                    <div className="flex flex-wrap gap-2">
                        <button
                            disabled={loading || page <= 1}
                            onClick={() => setPage((current) => current - 1)}
                            className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"
                            aria-label="Halaman sebelumnya"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={loading || page >= pagination.totalPages}
                            onClick={() => setPage((current) => current + 1)}
                            className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"
                            aria-label="Halaman berikutnya"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <Modal
                open={modalOpen}
                title={editingTransaction ? "Ubah Transaksi" : "Tambah Transaksi"}
                onClose={() => !busy && setModalOpen(false)}
            >
                {formError && <p role="alert" className="mb-4 text-sm text-red-700">{formError}</p>}
                <TransactionForm key={editingTransaction?.id || "new"} initialValues={form}
                    wallets={activeWallets} categories={categories} loading={busy}
                    onSave={saveTransaction} onCategory={openCreateCategory} />
            </Modal>

            <Modal
                open={categoryModal}
                title="Tambah Kategori"
                onClose={() => !busy && setCategoryModal(false)}
            >
                <form noValidate onSubmit={saveCategory} className="space-y-4">
                    {formError && (
                        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                            {formError}
                        </p>
                    )}

                    <div>
                        <label htmlFor="category-name" className="mb-2 block text-sm font-semibold">
                            Nama Kategori
                        </label>
                        <input
                            required
                            minLength={2}
                            maxLength={100}
                            id="category-name"
                            value={categoryForm.name}
                            onChange={(e) =>
                                setCategoryForm({
                                    ...categoryForm,
                                    name: e.target.value,
                                })
                            }
                            placeholder="Contoh: Makanan, Transportasi"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="category-type" className="mb-2 block text-sm font-semibold">
                            Jenis Kategori
                        </label>
                        <select
                            id="category-type"
                            value={categoryForm.type}
                            onChange={(e) =>
                                setCategoryForm({
                                    ...categoryForm,
                                    type: e.target.value,
                                })
                            }
                            className={inputClass}
                        >
                            <option value="EXPENSE">Pengeluaran</option>
                            <option value="INCOME">Pemasukan</option>
                        </select>
                    </div>

                    <button
                        disabled={busy}
                        className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                        {busy ? "Menyimpan..." : "Tambah Kategori"}
                    </button>
                </form>
            </Modal>

            <SmartTextModal
                open={smartTextOpen}
                onClose={() => setSmartTextOpen(false)}
                wallets={wallets}
                categories={categories}
                onSaved={async () => {
                    await Promise.all([
                        loadTransactions(),
                        loadReferences()
                    ]);
                }}
            />

            {/* Dialog Konfirmasi Hapus Transaksi */}
            <ConfirmDialog
                open={Boolean(transaksiDihapus)}
                onOpenChange={(open) => {
                    if (!open) setTransaksiDihapus(null);
                }}
                title="Hapus Transaksi?"
                description="Transaksi ini akan dihapus dan saldo dompet akan dihitung ulang. Tindakan ini tidak dapat dibatalkan."
                confirmText="Ya, Hapus"
                loading={sedangMenghapus}
                onConfirm={hapusTransaksi}
            />
        </div>
    );
}