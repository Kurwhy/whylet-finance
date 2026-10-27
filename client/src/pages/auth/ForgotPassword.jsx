import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../../lib/api";
import { forgotPasswordSchema } from "../../validations/account.schema";
import FormInput from "../../components/ui/FormInput";
import SubmitButton from "../../components/ui/SubmitButton";
import { getPesanKesalahan } from "../../utils/messages";
export default function ForgotPassword() {
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
    async function submit(data) {
        setError("");
        try { const response = await api.post("/auth/forgot-password", data); setMessage(response.data.message); }
        catch (err) { setError(getPesanKesalahan(err)); }
    }
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5"><div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Lupa Kata Sandi</h1><p>Masukkan email akun yang menggunakan kata sandi lokal.</p>
        {message ? <p role="status">{message}</p> : <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
            <FormInput label="Alamat Email" type="email" autoComplete="email" required readOnly={isSubmitting} {...register("email")} error={errors.email?.message} />
            <SubmitButton loading={isSubmitting}>Kirim Tautan Reset</SubmitButton>
        </form>}
        {error && <p role="alert" className="text-red-700">{error}</p>}<Link to="/login" className="block font-semibold text-emerald-800 underline">Kembali ke Masuk</Link>
    </div></main>;
}
