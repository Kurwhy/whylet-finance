import { Check, Circle } from "lucide-react";

export default function PasswordStrength({ password = "" }) {
    const rules = [
        { label: "Minimal 8 karakter", valid: password.length >= 8 },
        { label: "Mengandung huruf kapital", valid: /[A-Z]/.test(password) },
        { label: "Mengandung huruf kecil", valid: /[a-z]/.test(password) },
        { label: "Mengandung angka", valid: /[0-9]/.test(password) }
    ];

    const score = rules.filter((rule) => rule.valid).length;

    const strength =
        score <= 1
            ? { label: "Lemah", color: "bg-red-500", text: "text-red-600" }
            : score <= 3
                ? { label: "Sedang", color: "bg-amber-500", text: "text-amber-600" }
                : { label: "Memenuhi syarat", color: "bg-emerald-500", text: "text-emerald-700" };

    if (!password) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                    Persyaratan kata sandi
                </span>
                <span className={`text-xs font-semibold ${strength.text}`}>
                    {strength.label}
                </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 4 }, (_, index) => (
                    <div
                        key={index}
                        className={`h-1.5 rounded-full ${index < score ? strength.color : "bg-slate-200"
                            }`}
                    />
                ))}
            </div>

            <ul className="grid gap-1.5 sm:grid-cols-2">
                {rules.map((rule) => (
                    <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${rule.valid ? "text-emerald-700" : "text-slate-500"
                            }`}
                    >
                        {rule.valid
                            ? <Check size={14} />
                            : <Circle size={12} />}
                        {rule.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
