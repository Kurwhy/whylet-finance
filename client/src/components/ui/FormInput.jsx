import { forwardRef, useId, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

const FormInput = forwardRef(function FormInput(
    {
        label,
        name,
        type = "text",
        error,
        hint,
        required = false,
        className = "",
        ...props
    },
    ref
) {
    const generatedId = useId();
    const inputId = props.id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    const actualType = isPassword
        ? showPassword ? "text" : "password"
        : type;

    return (
        <div className={`w-full space-y-1.5 ${className}`}>
            <label
                htmlFor={inputId}
                className="block text-sm font-medium text-slate-700"
            >
                {label}
                {required && (
                    <span className="ml-1 text-red-500">*</span>
                )}
            </label>

            <div className="relative">
                <input
                    {...props}
                    ref={ref}
                    id={inputId}
                    name={name}
                    type={actualType}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                        error ? errorId : hint ? hintId : undefined
                    }
                    className={`
            h-12 w-full rounded-xl border bg-white
            px-4 text-sm text-slate-900
            outline-none transition
            placeholder:text-slate-500
            focus:ring-4
            disabled:cursor-not-allowed
            disabled:bg-slate-100
            ${error
                            ? "border-red-400 focus:border-red-500 focus:ring-red-50"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-50"
                        }
            ${isPassword ? "pr-12" : ""}
          `}
                />

                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                            showPassword
                                ? "Sembunyikan kata sandi"
                                : "Tampilkan kata sandi"
                        }
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-700"
                    >
                        {showPassword
                            ? <EyeOff size={18} />
                            : <Eye size={18} />}
                    </button>
                )}
            </div>

            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="flex items-start gap-1.5 text-xs text-red-600"
                >
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                </p>
            ) : hint ? (
                <p id={hintId} className="text-xs text-slate-500">
                    {hint}
                </p>
            ) : null}
        </div>
    );
});

export default FormInput;
