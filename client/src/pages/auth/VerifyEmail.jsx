import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, MailCheck } from "lucide-react";
import api from "../../lib/api";

export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get("token");

    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState("");

    async function handleVerify() {
        if (!token || loading) return;

        setLoading(true);
        setError("");

        try {
            await api.post("/auth/verify-email", { token });
            setVerified(true);

            // Hapus token dari URL setelah digunakan.
            window.history.replaceState(
                {},
                "",
                "/verify-email"
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Verifikasi gagal. Tautan mungkin kedaluwarsa."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    {verified
                        ? <CheckCircle2 size={32} />
                        : <MailCheck size={32} />}
                </div>

                <h1 className="mt-6 text-2xl font-bold">
                    {verified
                        ? "Email Berhasil Diverifikasi!"
                        : "Verifikasi Email"}
                </h1>

                <p className="mt-3 text-sm text-slate-500">
                    {verified
                        ? "Alamat email berhasil diverifikasi."
                        : "Tekan tombol berikut untuk menyelesaikan verifikasi akun Whylet."}
                </p>

                {error && (
                    <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {!verified && (
                    <button
                        onClick={handleVerify}
                        disabled={!token || loading}
                        className="mt-6 w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white disabled:opacity-50"
                    >
                        {loading ? "Memverifikasi..." : "Verifikasi Email"}
                    </button>
                )}

                <Link
                    to="/dashboard"
                    className="mt-5 inline-block text-sm font-semibold text-emerald-700"
                >
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
