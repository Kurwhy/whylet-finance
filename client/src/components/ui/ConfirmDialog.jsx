import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";

export default function ConfirmDialog({
    open,
    onOpenChange,
    title = "Konfirmasi Tindakan",
    description = "Apakah kamu yakin ingin melanjutkan?",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    onConfirm,
    loading = false,
    variant = "danger"
}) {
    const danger = variant === "danger";

    async function handleConfirm(event) {
        event.preventDefault();
        if (loading) return;
        await onConfirm?.();
    }

    return (
        <AlertDialog.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!loading) onOpenChange(nextOpen);
            }}
        >
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />

                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl focus:outline-none">
                    <div className="flex items-start justify-between">
                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${danger
                                    ? "bg-red-50 text-red-600"
                                    : "bg-amber-50 text-amber-600"
                                }`}
                        >
                            <AlertTriangle size={23} />
                        </div>

                        <AlertDialog.Cancel asChild>
                            <button
                                type="button"
                                disabled={loading}
                                aria-label="Tutup dialog"
                                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            >
                                <X size={20} />
                            </button>
                        </AlertDialog.Cancel>
                    </div>

                    <AlertDialog.Title className="mt-5 text-xl font-bold text-slate-900">
                        {title}
                    </AlertDialog.Title>

                    <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-slate-500">
                        {description}
                    </AlertDialog.Description>

                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <AlertDialog.Cancel asChild>
                            <button
                                type="button"
                                disabled={loading}
                                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                        </AlertDialog.Cancel>

                        <AlertDialog.Action asChild>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={loading}
                                className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${danger
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-emerald-700 hover:bg-emerald-800"
                                    }`}
                            >
                                {loading && (
                                    <LoaderCircle size={17} className="animate-spin" />
                                )}
                                {confirmText}
                            </button>
                        </AlertDialog.Action>
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}
