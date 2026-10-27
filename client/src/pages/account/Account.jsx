import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import api, { resetCsrfToken } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import useAsyncAction from "../../hooks/useAsyncAction";
import { getPesanKesalahan } from "../../utils/messages";
import FormInput from "../../components/ui/FormInput";
import SubmitButton from "../../components/ui/SubmitButton";
import { CardSkeleton } from "../../components/ui/LoadingSkeleton";
import { profileSchema, changePasswordSchema } from "../../validations/account.schema";

export default function Account() {
    const { refreshUser, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const { execute, loading } = useAsyncAction();
    const nameForm = useForm({ resolver: zodResolver(profileSchema), mode: "onTouched", defaultValues: { name: "" } });
    const passwordForm = useForm({ resolver: zodResolver(changePasswordSchema), mode: "onTouched", defaultValues: { currentPassword: "", password: "", confirmPassword: "" } });
    const resetName = nameForm.reset;
    const apply = useCallback(data => { setProfile(data); resetName({ name: data.name }); }, [resetName]);
    useEffect(() => {
        let active = true;
        api.get("/account").then(response => { if (active) apply(response.data.data); })
            .catch(err => { if (active) setError(getPesanKesalahan(err)); });
        return () => { active = false; };
    }, [retry, apply]);
    async function saveName(data) {
        const result = await execute(() => api.patch("/account", data), { successMessage: "Nama berhasil diperbarui." });
        if (result.ok) { apply(result.data.data.data); await refreshUser(); }
    }
    async function savePassword(data) {
        const result = await execute(() => api.patch("/account/password", data), { successMessage: "Kata sandi diubah. Silakan masuk kembali." });
        if (result.ok) { passwordForm.reset(); resetCsrfToken(); await refreshUser(); navigate("/login", { replace: true }); }
    }
    async function leave() {
        const result = await execute(logout);
        if (result.ok) navigate("/login", { replace: true });
    }
    if (!profile) return error ? <div role="alert">{error} <button className="underline" onClick={() => { setError(""); setRetry(r => r+1); }}>Coba lagi</button></div> : <div role="status" aria-label="Memuat profil"><CardSkeleton /></div>;
    return <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Profil Saya</h1>
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Informasi Akun</h2>
            <p data-private>{profile.email}</p>
            <p>Status email: <strong>{profile.emailVerifiedAt ? "Terverifikasi" : "Belum Terverifikasi"}</strong></p>
            {!profile.emailVerifiedAt && <button type="button" disabled={loading} className="font-semibold text-emerald-800 underline"
                onClick={() => execute(() => api.post("/auth/resend-verification"), { successMessage: "Permintaan verifikasi diterima. Periksa kotak masuk." })}>Kirim Ulang Verifikasi</button>}
            <p className="text-sm text-slate-600">Mata uang: Rupiah (IDR) · Zona waktu: {profile.timezone}</p>
        </section>
        <form onSubmit={nameForm.handleSubmit(saveName)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Ubah Nama</h2>
            <FormInput label="Nama Lengkap" required disabled={loading} {...nameForm.register("name")} error={nameForm.formState.errors.name?.message} />
            <SubmitButton loading={loading || nameForm.formState.isSubmitting}>Simpan Nama</SubmitButton>
        </form>
        {profile.hasPassword ? <form onSubmit={passwordForm.handleSubmit(savePassword)} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Ubah Kata Sandi</h2>
            <p className="text-sm text-slate-600">Semua sesi akan dikeluarkan setelah kata sandi diubah.</p>
            <fieldset disabled={loading} className="space-y-4">
                <FormInput label="Kata Sandi Saat Ini" type="password" autoComplete="current-password" required {...passwordForm.register("currentPassword")} error={passwordForm.formState.errors.currentPassword?.message} />
                <FormInput label="Kata Sandi Baru" type="password" autoComplete="new-password" required {...passwordForm.register("password")} error={passwordForm.formState.errors.password?.message} />
                <FormInput label="Konfirmasi Kata Sandi Baru" type="password" autoComplete="new-password" required {...passwordForm.register("confirmPassword")} error={passwordForm.formState.errors.confirmPassword?.message} />
            </fieldset>
            <SubmitButton loading={loading || passwordForm.formState.isSubmitting}>Ubah Kata Sandi</SubmitButton>
        </form> : <p className="rounded-2xl bg-emerald-50 p-6">Akun ini masuk melalui Google dan tidak memiliki kata sandi lokal. Kelola keamanan akun melalui Google.</p>}
        <button type="button" disabled={loading} onClick={leave} className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700">Keluar dari Akun</button>
    </div>;
}
