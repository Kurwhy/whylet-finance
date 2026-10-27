import { useEffect, useState } from "react";

import {
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    ArrowLeftRight,
    RefreshCw,
    ChartNoAxesCombined,
} from "lucide-react";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";

import api from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import SpendingLimitCard from "../../components/spending-limit/SpendingLimitCard";
import {
    DashboardSkeleton
} from "../../components/ui/LoadingSkeleton";

const rupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const compact = (value) =>
    new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);

function SummaryCard({ title, value, icon: Icon, positive }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                    {title}
                </p>

                <div
                    className={`rounded-xl p-3 ${positive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                        }`}
                >
                    <Icon size={20} />
                </div>
            </div>

            <h3 className="mt-5 break-words text-2xl font-bold tracking-tight text-slate-900">
                {rupiah(value)}
            </h3>
        </div>
    );
}

async function readDashboard() {
    const [summaryRes, recentRes, monthlyRes] = await Promise.all([
        api.get("/dashboard/summary"), api.get("/dashboard/recent-transactions?limit=5"), api.get("/reports/monthly")
    ]);
    const report = monthlyRes.data.data;
            const monthly = (
                report.months.map((item) => ({
                    name: new Date(
                        `${item.month}-01T12:00:00Z`
                    ).toLocaleDateString("id-ID", {
                        month: "short",
                        timeZone: "UTC",
                    }),
                    income: Number(item.income),
                    expense: Number(item.expense),
                }))
            );
    return { summary: summaryRes.data.data, recent: recentRes.data.data, monthly };
}

export default function Dashboard() {
    const { user } = useAuth();

    const [summary, setSummary] = useState(null);
    const [recent, setRecent] = useState([]);
    const [monthly, setMonthly] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    async function loadDashboard() {
        setLoading(true);
        setError("");
        setRefreshKey((current) => current + 1);

        try {
            const result = await readDashboard();
            setSummary(result.summary); setRecent(result.recent); setMonthly(result.monthly);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Gagal mengambil data beranda."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let active = true;
        readDashboard().then(result => {
            if (active) { setSummary(result.summary); setRecent(result.recent); setMonthly(result.monthly); }
        }).catch(() => { if (active) setError("Gagal mengambil data beranda."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    // Menggunakan DashboardSkeleton saat data awal sedang dimuat
    if (loading) {
        return <DashboardSkeleton />;
    }

    if (error) {
        return (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <p className="font-semibold text-red-700">
                    {error}
                </p>
                <button
                    onClick={loadDashboard}
                    className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-emerald-700">
                        RINGKASAN KEUANGAN
                    </p>

                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                        Halo, {user?.name?.split(" ")[0]}!
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Berikut ringkasan keuanganmu.
                    </p>
                </div>

                <button
                    onClick={loadDashboard}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    <RefreshCw size={17} />
                    Muat Ulang
                </button>
            </div>

            <div className="rounded-3xl bg-emerald-950 p-7 text-white shadow-lg shadow-emerald-950/10 sm:p-8">
                <div className="flex items-center gap-2 text-emerald-200">
                    <Wallet size={19} />
                    <span className="text-sm font-medium">
                        Total Saldo
                    </span>
                </div>

                <h2 className="mt-4 break-words text-3xl font-bold tracking-tight sm:text-4xl">
                    {rupiah(summary?.totalBalance)}
                </h2>

                <p className="mt-3 text-sm text-emerald-100/80">
                    Saldo keseluruhan dari {summary?.walletCount || 0} dompet aktif.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard
                    title="Total Pemasukan"
                    value={summary?.totalIncome}
                    icon={TrendingUp}
                    positive
                />

                <SummaryCard
                    title="Total Pengeluaran"
                    value={summary?.totalExpense}
                    icon={TrendingDown}
                />
            </div>
            <SpendingLimitCard refreshKey={refreshKey} />

            <div className="grid gap-5 xl:grid-cols-3">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                    <div className="mb-6 flex items-center gap-2">
                        <ChartNoAxesCombined
                            size={20}
                            className="text-emerald-700"
                        />
                        <div>
                            <h3 className="font-bold">
                                Pemasukan dan Pengeluaran
                            </h3>
                            <p className="text-xs text-slate-500">
                                Perbandingan keuangan bulanan
                            </p>
                        </div>
                    </div>

                    <div className="h-72 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthly}>
                                <defs>
                                    <linearGradient
                                        id="incomeGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#10b981"
                                            stopOpacity={0.25}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#10b981"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    stroke="#e2e8f0"
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={11}
                                />

                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={11}
                                    width={45}
                                    tickFormatter={compact}
                                />

                                <Tooltip formatter={(value) => rupiah(value)} />

                                <Area
                                    type="monotone"
                                    dataKey="income"
                                    name="Pemasukan"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fill="url(#incomeGradient)"
                                />

                                <Area
                                    type="monotone"
                                    dataKey="expense"
                                    name="Pengeluaran"
                                    stroke="#fb7185"
                                    strokeWidth={3}
                                    fill="transparent"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="font-bold">Arus Kas</h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Periode {summary?.period}
                    </p>

                    <div className="mt-8 rounded-2xl bg-slate-50 p-5">
                        <p className="text-sm text-slate-500">
                            Arus Kas Bersih
                        </p>

                        <h3
                            className={`mt-2 break-words text-2xl font-bold ${Number(summary?.netCashFlow) >= 0
                                ? "text-emerald-700"
                                : "text-red-500"
                                }`}
                        >
                            {rupiah(summary?.netCashFlow)}
                        </h3>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                                Transaksi
                            </span>
                            <span className="font-semibold">
                                {summary?.transactionCount || 0}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                                Dompet Aktif
                            </span>
                            <span className="font-semibold">
                                {summary?.walletCount || 0}
                            </span>
                        </div>
                    </div>
                </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-5">
                    <h3 className="font-bold">
                        Transaksi Terbaru
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Aktivitas keuangan terbaru
                    </p>
                </div>

                {recent.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                        <ArrowLeftRight
                            size={36}
                            className="mx-auto text-slate-300"
                        />
                        <p className="mt-4 font-semibold text-slate-700">
                            Belum ada transaksi
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            Transaksi pertamamu akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {recent.map((item) => {
                            const income = item.type === "INCOME";

                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 px-5 py-4 sm:px-6"
                                >
                                    <div
                                        className={`rounded-xl p-3 ${income
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-rose-50 text-rose-700"
                                            }`}
                                    >
                                        {income ? (
                                            <ArrowDownRight size={19} />
                                        ) : (
                                            <ArrowUpRight size={19} />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">
                                            {item.description}
                                        </p>

                                        <p className="mt-1 truncate text-xs text-slate-500">
                                            {item.category?.name} · {item.wallet?.name}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p
                                            className={`text-sm font-bold ${income
                                                ? "text-emerald-700"
                                                : "text-rose-700"
                                                }`}
                                        >
                                            {income ? "+" : "−"}
                                            {rupiah(item.amount)}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {item.transactionDate?.slice(0, 10)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}