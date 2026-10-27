import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/useAuth";
import api, { resetCsrfToken } from "../../lib/api";
import { resetPasswordSchema } from "../../validations/account.schema";
import FormInput from "../../components/ui/FormInput";
import SubmitButton from "../../components/ui/SubmitButton";
import { getPesanKesalahan } from "../../utils/messages";
export default function ResetPassword() {
    const { refreshUser } = useAuth();
    const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
    useEffect(() => { window.history.replaceState({}, "", "/reset-password"); }, []);
    async function submit(data) {
        setError("");
        try { await api.post("/auth/reset-password", { ...data, token }); reset(); resetCsrfToken(); await refreshUser(); setDone(true); }
        catch (err) { setError(getPesanKesalahan(err)); }
    }
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Reset Kata Sandi</h1>
        {done ? <p role="status">Kata sandi berhasil direset. Silakan masuk kembali.</p> : !/^[a-f0-9]{64}$/i.test(token) ? <p role="alert">Tautan reset tidak valid. Mintalah tautan baru.</p> : <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
            <FormInput label="Kata Sandi Baru" type="password" autoComplete="new-password" required readOnly={isSubmitting} {...register("password")} error={errors.password?.message} />
            <FormInput label="Konfirmasi Kata Sandi Baru" type="password" autoComplete="new-password" required readOnly={isSubmitting} {...register("confirmPassword")} error={errors.confirmPassword?.message} />
            <SubmitButton loading={isSubmitting}>Simpan Kata Sandi Baru</SubmitButton>
        </form>}
        {error && <p role="alert" className="text-red-700">{error}</p>}<Link to="/login" className="block font-semibold text-emerald-800 underline">Kembali ke Masuk</Link>
    </div></main>;
}
