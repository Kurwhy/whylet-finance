import BrandLogo from "../../components/branding/BrandLogo";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

import { useAuth } from "../../context/useAuth";

import FormInput from "../../components/ui/FormInput";
import SubmitButton from "../../components/ui/SubmitButton";
import GoogleLoginButton from "../../components/auth/GoogleLoginButton";
import PasswordStrength from "../../components/auth/PasswordStrength";

import { registerSchema } from "../../validations/auth.schema";
import { getPesanKesalahan } from "../../utils/messages";

export default function Register() {
    const { register: registerAccount, user } = useAuth();
    const navigate = useNavigate();

    const [copyrightYear] = useState(() => new Date().getFullYear());
    const [serverError, setServerError] = useState("");

    const {
        register: registerField,
        handleSubmit,
        control,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(registerSchema),
        mode: "onTouched",
        defaultValues: {
            name: "",
            email: "",
            password: "",
            confirmPassword: ""
        }
    });

    const password = useWatch({ control, name: "password", defaultValue: "" });

    async function onSubmit(data) {
        setServerError("");

        try {
            await registerAccount(
                data.name.trim(),
                data.email.trim().toLowerCase(),
                data.password
            );

            navigate("/dashboard", { replace: true });
        } catch (error) {
            setServerError(getPesanKesalahan(error));
        }
    }

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="grid min-h-screen bg-white lg:grid-cols-2">
            {/* Formulir kiri */}
            <main className="flex items-center justify-center px-6 py-10 sm:px-10">
                <div className="w-full max-w-md">
                    <Link
                        to="/login"
                        className="mb-10 inline-flex items-center gap-3"
                    >
                        <BrandLogo imageClassName="h-16 w-16 sm:h-20 sm:w-20" />
                    </Link>

                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                        Buat Akun Whylet
                    </h1>

                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Mulai mencatat pemasukan, pengeluaran, dan mengelola
                        keuanganmu dalam satu tempat.
                    </p>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        noValidate
                        className="mt-8 space-y-4"
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
                            label="Nama Lengkap"
                            placeholder="Masukkan nama lengkap"
                            autoComplete="name"
                            maxLength={100}
                            required
                            {...registerField("name")}
                            error={errors.name?.message}
                        />

                        <FormInput
                            label="Alamat Email"
                            type="email"
                            placeholder="contoh@email.com"
                            autoComplete="email"
                            required
                            {...registerField("email")}
                            error={errors.email?.message}
                        />

                        <div className="space-y-3">
                            <FormInput
                                label="Kata Sandi"
                                type="password"
                                placeholder="Buat kata sandi"
                                autoComplete="new-password"
                                required
                                {...registerField("password")}
                                error={errors.password?.message}
                            />

                            <PasswordStrength password={password} />
                        </div>

                        <FormInput
                            label="Konfirmasi Kata Sandi"
                            type="password"
                            placeholder="Ulangi kata sandi"
                            autoComplete="new-password"
                            required
                            {...registerField("confirmPassword")}
                            error={errors.confirmPassword?.message}
                        />

                        <SubmitButton loading={isSubmitting}>
                            Buat Akun
                        </SubmitButton>

                        <p className="text-center text-sm text-slate-500">
                            Sudah memiliki akun?{" "}
                            <Link
                                to="/login"
                                className="font-semibold text-emerald-700 hover:text-emerald-700"
                            >
                                Masuk di sini
                            </Link>
                        </p>
                    </form>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-500">ATAU</span>
                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <GoogleLoginButton />

                    <div className="mt-8 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                        Data keuanganmu hanya dapat diakses melalui akunmu.
                        Gunakan kata sandi yang unik dan jangan membagikannya.
                    </div>
                </div>
            </main>

            {/* Panel kanan desktop */}
            <aside className="hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="text-sm font-semibold tracking-widest text-emerald-200">
                    WHYLET — KEUANGAN PRIBADI
                </div>

                <div className="max-w-lg">
                    <BrandLogo className="mb-8" imageClassName="h-24 w-24" showName={false} />

                    <h2 className="text-5xl font-bold leading-tight">
                        Mulai Kelola,
                        <br />
                        <span className="text-emerald-300">
                            Keuanganmu.
                        </span>
                    </h2>

                    <p className="mt-6 text-lg leading-relaxed text-emerald-100/80">
                        Pantau saldo, catat transaksi, dan buat keputusan
                        keuangan yang lebih terencana.
                    </p>

                    <div className="mt-10 space-y-4">
                        {[
                            "Catat pemasukan dan pengeluaran",
                            "Kelola beberapa dompet sekaligus",
                            "Pantau laporan keuangan",
                            "Atur batas pengeluaran bulanan"
                        ].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                                <CheckCircle2
                                    size={19}
                                    className="shrink-0 text-emerald-300"
                                />
                                <span className="text-sm text-emerald-50">
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-emerald-200/70">
                    © {copyrightYear} Whylet
                </p>
            </aside>
        </div>
    );
}
