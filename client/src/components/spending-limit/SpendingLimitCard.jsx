import { useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    CircleGauge,
    Pencil,
    Save,
    X,
    LoaderCircle
} from "lucide-react";

import { spendingLimitSchema } from "../../validations/finance.schema";
import { notify } from "../../utils/notify";
import api from "../../lib/api";
import {
    formatRupiah,
    getApiError
} from "../../utils/format";

export default function SpendingLimitCard({ refreshKey = 0 }) {
    const actionRef = useRef(false);
    const [retry, setRetry] = useState(0);
    const [data, setData] = useState(null);
    const [amount, setAmount] = useState("");
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            setLoading(true);
            setError("");

            try {
                const response = await api.get("/spending-limit");

                if (!active) return;

                const result = response.data.data;

                setData(result);
                setAmount(result.amount ?? "");
            } catch (err) {
                if (active) setError(getApiError(err));
            } finally {
                if (active) setLoading(false);
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [refreshKey, retry]);

    async function saveLimit(event) {
        event.preventDefault();
        if (actionRef.current) return;
        const parsed = spendingLimitSchema.safeParse({ amount, isEnabled: data?.isConfigured ? data.isEnabled : true });
        if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
        }
        actionRef.current = true;

        setSaving(true);
        setError("");

        try {
            const response = await api.put("/spending-limit", {
                ...parsed.data
            });

            const result = response.data.data;
            setData(result);
            setAmount(result.amount ?? "");
            setEditing(false);
            notify.success("Batas pengeluaran berhasil disimpan.");
        } catch (err) {
            setError(getApiError(err));
            notify.error(getApiError(err));
        } finally {
            actionRef.current = false;
            setSaving(false);
        }
    }

    async function toggleLimit() {
        if (!data?.isConfigured || actionRef.current) return;
        actionRef.current = true;

        setSaving(true);
        setError("");

        try {
            const response = await api.patch("/spending-limit/toggle", {
                isEnabled: !data.isEnabled
            });

            setData(response.data.data);
            notify.success("Status batas pengeluaran berhasil diubah.");
        } catch (err) {
            setError(getApiError(err));
            notify.error(getApiError(err));
        } finally {
            actionRef.current = false;
            setSaving(false);
        }
    }

    const status = data?.status;
    const statusLabel = { SAFE: "Aman", WARNING: "Mendekati Batas", EXCEEDED: "Melebihi Batas", DISABLED: "Nonaktif", NOT_CONFIGURED: "Belum Diatur" }[status];
    const percentage = data?.percentage ?? 0;

    const colors = {
        SAFE: "bg-emerald-500",
        WARNING: "bg-amber-500",
        EXCEEDED: "bg-rose-500"
    };

    const progressColor = colors[status] || "bg-slate-300";

    if (loading) {
        return (
            <div className="h-52 animate-pulse rounded-2xl bg-slate-200" />
        );
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <CircleGauge size={20} className="text-emerald-700" />
                        <h2 className="text-lg font-bold">
                            Batas Pengeluaran Bulanan
                        </h2>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                        Pantau pengeluaran bulanan dari seluruh dompet.
                    </p>
                </div>

                {data?.isConfigured && !editing && (
                    <button
                        onClick={() => setEditing(true)}
                        aria-label="Ubah batas pengeluaran"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    >
                        <Pencil size={18} />
                    </button>
                )}
            </div>

            {statusLabel && <p className="mt-3 text-sm font-semibold text-slate-600">{statusLabel}</p>}
            {error && (
                <p id="limit-error" role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </p>
            )}

            {!data && error ? <button type="button" className="mt-4 underline" onClick={() => setRetry(r => r + 1)}>Coba lagi</button> : (editing || !data?.isConfigured) ? (
                <form noValidate onSubmit={saveLimit} className="mt-6 space-y-4">
                    <div>
                        <label
                            htmlFor="limit-amount"
                            className="mb-2 block text-sm font-semibold"
                        >
                            Batas pengeluaran per bulan (Rp)
                        </label>

                        <input
                            id="limit-amount"
                            disabled={saving}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? "limit-error" : undefined}
                            required
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            pattern="[1-9][0-9]*(\.[0-9]{1,2})?"
                            placeholder="2000000"
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                    </div>

                    <p className="text-xs text-slate-500">
                        Contoh: 2000000 untuk Rp2.000.000.
                        Jangan gunakan titik pemisah ribuan.
                    </p>

                    <div className="flex gap-2">
                        {editing && (
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    setAmount(data?.amount ?? "");
                                    setEditing(false);
                                    setError("");
                                }}
                                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                            >
                                <X size={17} />
                                Batal
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                            {saving
                                ? <LoaderCircle size={18} className="animate-spin" />
                                : <Save size={18} />}
                            {saving ? "Menyimpan..." : "Simpan Batas"}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="mt-6 space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <p className="text-xs text-slate-500">Pengeluaran Bulan Ini</p>
                            <p className="mt-1 text-2xl font-bold">
                                {formatRupiah(data.spent)}
                            </p>
                        </div>

                        <div className="text-right">
                            <p className="text-xs text-slate-500">Batas Bulanan</p>
                            <p className="mt-1 text-sm font-bold">
                                {formatRupiah(data.amount)}
                            </p>
                        </div>
                    </div>

                    <div
                        role="progressbar"
                        aria-label="Penggunaan batas pengeluaran"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                            data.isEnabled
                                ? Math.min(100, Math.max(0, percentage))
                                : 0
                        }
                        className="h-3 overflow-hidden rounded-full bg-slate-100"
                    >
                        <div
                            className={`h-full rounded-full transition-all ${data.isEnabled ? progressColor : "bg-slate-300"
                                }`}
                            style={{
                                width: `${data.isEnabled
                                        ? Math.min(100, Math.max(0, percentage))
                                        : 0
                                    }%`
                            }}
                        />
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                            {data.isEnabled
                                ? `${percentage}% terpakai`
                                : "Pemantauan dijeda"}
                        </span>

                        <span className="font-semibold">
                            {data.isEnabled
                                ? `${formatRupiah(data.remaining)} tersisa`
                                : "Nonaktif"}
                        </span>
                    </div>

                    {status === "SAFE" && (
                        <p className="flex items-center gap-2 text-sm text-emerald-700">
                            <CheckCircle2 size={17} />
                            Pengeluaran masih dalam batas aman.
                        </p>
                    )}

                    {status === "WARNING" && (
                        <p role="status" className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                            <AlertTriangle size={18} />
                            Pengeluaran mencapai 80% dari batas bulanan.
                        </p>
                    )}

                    {status === "EXCEEDED" && (
                        <p role="status" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                            <AlertTriangle size={18} />
                            Batas bulanan sudah tercapai atau terlampaui.
                        </p>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-sm text-slate-500">
                            Batas Pengeluaran
                        </span>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={toggleLimit}
                            aria-pressed={data.isEnabled}
                            className={`rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50 ${data.isEnabled
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                        >
                            {data.isEnabled ? "Aktif" : "Nonaktif"}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
