import { LoaderCircle } from "lucide-react";

export default function SubmitButton({
    children = "Simpan",
    loading = false,
    disabled = false,
    className = "",
    ...props
}) {
    return (
        <button
            type="submit"
            disabled={loading || disabled}
            aria-busy={loading}
            {...props}
            className={`
        flex h-12 w-full items-center justify-center
        gap-2 rounded-xl bg-emerald-700
        px-5 text-sm font-semibold text-white
        transition hover:bg-emerald-800
        focus-visible:outline-none
        focus-visible:ring-4
        focus-visible:ring-emerald-200
        disabled:cursor-not-allowed
        disabled:opacity-60
        ${className}
      `}
        >
            {loading && (
                <LoaderCircle size={18} className="animate-spin" />
            )}

            {children}
        </button>
    );
}
