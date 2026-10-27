
import {
    Inbox,
    Plus
} from "lucide-react";

export default function EmptyState({
    icon: Icon = Inbox,
    title = "Belum Ada Data",
    description = "Data belum tersedia saat ini.",
    actionLabel,
    onAction,
    className = ""
}) {
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center ${className}`}
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon size={30} strokeWidth={1.8} />
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-900">
                {title}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                {description}
            </p>

            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                >
                    <Plus size={17} />
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
