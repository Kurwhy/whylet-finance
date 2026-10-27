import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
    open,
    title,
    onClose,
    children,
}) {
    const dialogRef = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        const topDialog = () => Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1);
        const focusable = () => Array.from(dialog.querySelectorAll(
            'button, a[href], input, select, textarea, [tabindex]'
        )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
        const initial = focusable().find(element => element.matches('input, select, textarea')) || focusable()[0] || dialog;
        initial.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        function onKeyDown(event) {
            if (topDialog() !== dialog) return;
            if (event.key === "Escape") {
                event.preventDefault();
                closeRef.current();
            }
            if (event.key === "Tab") {
                const targets = focusable();
                const first = targets[0] || dialog;
                const last = targets.at(-1) || dialog;
                if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus();
                }
            }
        }

        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKeyDown);
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl"
            >
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">
                        {title}
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup modal"
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                    >
                        <X size={21} />
                    </button>
                </div>

                {children}
            </div>
        </div>,
        document.body
    );
}
