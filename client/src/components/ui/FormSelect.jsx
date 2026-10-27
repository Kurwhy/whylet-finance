import { forwardRef, useId } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

const FormSelect = forwardRef(function FormSelect(
    {
        label,
        name,
        options = [],
        placeholder = "Pilih salah satu",
        error,
        required = false,
        className = "",
        ...props
    },
    ref
) {
    const generatedId = useId();
    const id = props.id || generatedId;
    const errorId = `${id}-error`;

    return (
        <div className={`space-y-1.5 ${className}`}>
            <label
                htmlFor={id}
                className="block text-sm font-medium text-slate-700"
            >
                {label}
                {required && (
                    <span className="ml-1 text-red-500">*</span>
                )}
            </label>

            <div className="relative">
                <select
                    {...props}
                    ref={ref}
                    id={id}
                    name={name}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className={`
            h-12 w-full appearance-none rounded-xl border
            bg-white px-4 pr-10 text-sm text-slate-900
            outline-none transition focus:ring-4
            disabled:bg-slate-100
            ${error
                            ? "border-red-400 focus:border-red-500 focus:ring-red-50"
                            : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-50"
                        }
          `}
                >
                    <option value="">{placeholder}</option>

                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <ChevronDown
                    size={18}
                    className="pointer-events-none absolute right-3 top-3.5 text-slate-500"
                />
            </div>

            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-red-600"
                >
                    <AlertCircle size={14} />
                    {error}
                </p>
            )}
        </div>
    );
});

export default FormSelect;
