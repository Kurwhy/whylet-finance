import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import { todayLocal, formatRupiah } from "../../utils/format";
import { getPesanKesalahan } from "../../utils/messages";
import useAsyncAction from "../../hooks/useAsyncAction";
import FormInput from "../../components/ui/FormInput";
import FormSelect from "../../components/ui/FormSelect";
import SubmitButton from "../../components/ui/SubmitButton";
import EmptyState from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";

export default function Reports() {
    const [filters, setFilters] = useState({ month: todayLocal().slice(0, 7), type: "EXPENSE" });
    const [result, setResult] = useState({ key: null, data: null, error: "" });
    const [retry, setRetry] = useState(0);
    const activeFilters = useRef(filters);
    const { execute, loading: exporting } = useAsyncAction();
    const [selectedYear, selectedMonth] = filters.month.split("-");
    const validYear = /^\d{4}$/.test(selectedYear) && Number(selectedYear) >= 2000 && Number(selectedYear) <= 2100;
    const validMonth = /^(0[1-9]|1[0-2])$/.test(selectedMonth || "");
    const valid = ["INCOME", "EXPENSE"].includes(filters.type) && validYear && validMonth;
    const requestKey = JSON.stringify([filters, retry]);
    const loading = valid && result.key !== requestKey;
    const data = valid && result.key === requestKey ? result.data : null;
    const error = result.key === requestKey ? result.error : "";
    useEffect(() => {
        let active = true;
        if (!valid) return;
        Promise.all([
            api.get("/reports/monthly", { params: { year: filters.month.slice(0, 4) } }),
            api.get("/reports/categories", { params: filters })
        ]).then(([monthly, categories]) => {
            if (active) {
                activeFilters.current = filters;
                setResult({ key: requestKey, data: { monthly: monthly.data.data, categories: categories.data.data }, error: "" });
            }
        }).catch(err => { if (active) setResult({ key: requestKey, data: null, error: getPesanKesalahan(err) }); });
        return () => { active = false; };
    }, [filters, retry, valid, requestKey]);
    async function exportCsv() {
        if (!data || loading) return;
        const params = { ...activeFilters.current };
        await execute(async () => {
            let response;
            try {
                response = await api.get("/reports/export", { params, responseType: "blob" });
            } catch (err) {
                if (err.response?.data instanceof Blob) {
                    try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* Pesan umum berdasarkan status. */ }
                }
                throw err;
            }
            const url = URL.createObjectURL(response.data);
            const link = document.createElement("a");
            link.href = url;
            link.download = `whylet-${params.month}-${params.type.toLowerCase()}.csv`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, { successMessage: "Laporan CSV berhasil diunduh." });
    }
    return <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Laporan Keuangan</h1><p className="mt-2 text-sm text-slate-500">Lihat ringkasan tahunan dan rincian kategori per bulan.</p></div>
        <div className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
            <FormSelect label="Bulan" value={selectedMonth || ""}
                onChange={e => setFilters({ ...filters, month: `${selectedYear}-${e.target.value}` })}
                options={["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))}
                error={!validMonth ? "Pilih bulan yang valid." : undefined} />
            <FormInput label="Tahun" type="number" min="2000" max="2100" value={selectedYear}
                onChange={e => setFilters({ ...filters, month: `${e.target.value}-${selectedMonth || ""}` })}
                error={!validYear ? "Pilih tahun antara 2000 dan 2100." : undefined} />
            <FormSelect label="Jenis" error={!filters.type ? "Pilih jenis laporan." : undefined} value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}
                options={[{ value: "EXPENSE", label: "Pengeluaran" }, { value: "INCOME", label: "Pemasukan" }]} />
            <SubmitButton type="button" onClick={exportCsv} loading={exporting} disabled={loading || !data || !valid || !filters.type}>Unduh CSV Bulan Terpilih</SubmitButton>
        </div>
        {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error} <button className="underline" onClick={() => setRetry(r => r + 1)}>Coba lagi</button></div>}
        {loading ? <TableSkeleton /> : data && <>
            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-bold">Ringkasan Tahun {data.monthly.year}</h2>
                <table className="w-full text-left text-sm"><thead><tr>{["Bulan", "Pemasukan", "Pengeluaran", "Selisih"].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead>
                    <tbody>{data.monthly.months.map(m => <tr key={m.month} className="border-t border-slate-100">
                        <td className="p-3">{m.month}</td><td className="p-3">{formatRupiah(m.income)}</td><td className="p-3">{formatRupiah(m.expense)}</td><td className="p-3">{formatRupiah(m.net)}</td>
                    </tr>)}</tbody></table>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-lg font-bold">{filters.type === "INCOME" ? "Pemasukan" : "Pengeluaran"} per Kategori — {data.categories.period}</h2>
                {data.categories.categories.length === 0 ? <EmptyState title="Belum Ada Data Laporan" description="Belum ada transaksi untuk bulan dan jenis yang dipilih." /> :
                    <ul className="divide-y divide-slate-100">{data.categories.categories.map(c => <li key={c.categoryId} className="flex flex-wrap justify-between gap-3 py-3">
                        <span>{c.categoryName} <span className="text-sm text-slate-500">({c.count} transaksi)</span></span><span className="font-semibold">{formatRupiah(c.amount)} · {c.percentage}%</span>
                    </li>)}</ul>}
                <p className="mt-4 font-bold">Total: {formatRupiah(data.categories.total)}</p>
            </section>
        </>}
    </div>;
}
