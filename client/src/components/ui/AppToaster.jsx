import { Toaster } from "sonner";

export default function AppToaster() {
    return (
        <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
            visibleToasts={3}
            expand
            theme="light"
            toastOptions={{
                closeButtonAriaLabel: "Tutup notifikasi"
            }}
        />
    );
}
