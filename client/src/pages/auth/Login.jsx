import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link, Navigate } from "react-router-dom";
import BrandLogo from "../../components/branding/BrandLogo";
import { useAuth } from "../../context/useAuth";

import FormInput from "../../components/ui/FormInput";
import SubmitButton from "../../components/ui/SubmitButton";
import GoogleLoginButton from "../../components/auth/GoogleLoginButton";

import { loginSchema } from "../../validations/auth.schema";
import { getPesanKesalahan } from "../../utils/messages";

export default function Login() {
    const { login, user } = useAuth();
    const navigate = useNavigate();

    const [copyrightYear] = useState(() => new Date().getFullYear());
    const [serverError, setServerError] = useState("");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(loginSchema),
        mode: "onTouched",
        defaultValues: {
            email: "",
            password: ""
        }
    });

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    async function onSubmit(data) {
        setServerError("");

        try {
            await login(
                data.email,
                data.password
            );

            navigate("/dashboard", { replace: true });
        } catch (error) {
            setServerError(getPesanKesalahan(error));
        }
    }

    return (
        <div className="grid min-h-screen bg-white lg:grid-cols-2">
            <div className="flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    <BrandLogo className="mb-10" imageClassName="h-16 w-16 sm:h-20 sm:w-20" />

                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Selamat Datang Kembali!
                    </h1>

                    <p className="mt-2 text-slate-500">
                        Masuk untuk mengelola keuanganmu dengan mudah.
                    </p>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        className="mt-9 space-y-5"
                    >
                        {serverError && (
                            <div
                                role="alert"
                                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                            >
                                {serverError}
                            </div>
                        )}

                        <FormInput
                            label="Alamat Email"
                            type="email"
                            placeholder="contoh@email.com"
                            autoComplete="email"
                            required
                            {...register("email")}
                            error={errors.email?.message}
                        />

                        <FormInput
                            label="Kata Sandi"
                            type="password"
                            placeholder="Masukkan kata sandi"
                            autoComplete="current-password"
                            required
                            {...register("password")}
                            error={errors.password?.message}
                        />

                        <SubmitButton loading={isSubmitting}>
                            Masuk
                        </SubmitButton>

                        <p className="text-center text-sm text-slate-500">
                            Belum memiliki akun?{" "}
                            <Link
                                to="/register"
                                className="font-semibold text-emerald-700 hover:text-emerald-700"
                            >
                                Daftar sekarang
                            </Link>
                        </p>
                    </form>

                    <Link to="/forgot-password" className="mt-4 block text-center font-semibold text-emerald-800 underline">Lupa kata sandi?</Link>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-500">ATAU</span>
                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <GoogleLoginButton />
                </div>
            </div>

            <div className="hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="text-sm font-semibold text-emerald-200">
                    KEUANGAN WHYLET
                </div>

                <div className="max-w-lg">
                    <BrandLogo className="mb-8" imageClassName="h-24 w-24" showName={false} />
                    <h2 className="text-5xl font-bold leading-tight">
                        Keuanganmu,
                        <br />
                        <span className="text-emerald-300">
                            Lebih Cerdas.
                        </span>
                    </h2>
                    <p className="mt-6 text-lg leading-relaxed text-emerald-100/80">
                        Catat pengeluaran, kelola dompet, dan pahami keuanganmu
                        dalam satu aplikasi yang sederhana.
                    </p>
                </div>

                <p className="text-sm text-emerald-200/70">
                    © {copyrightYear} Whylet
                </p>
            </div>
        </div>
    );
}