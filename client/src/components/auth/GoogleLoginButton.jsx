import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import { getApiError } from "../../utils/format";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton() {
    const buttonRef = useRef(null);
    const loginRef = useRef(null);
    const navigate = useNavigate();

    const { loginWithGoogle } = useAuth();

    const [error, setError] = useState(() => clientId ? "" : "Google Client ID belum dikonfigurasi.");
    const [busy, setBusy] = useState(false);

    // Simpan callback terbaru tanpa menginisialisasi GIS berulang
    // setiap render.
    useEffect(() => {
        loginRef.current = loginWithGoogle;
    }, [loginWithGoogle]);

    useEffect(() => {
        let cancelled = false;
        let retries = 0;
        let timeoutId;

        if (!clientId) return;

        function initializeGoogle() {
            if (cancelled) return;

            if (!window.google?.accounts?.id) {
                if (retries++ < 30) {
                    timeoutId = window.setTimeout(initializeGoogle, 200);
                } else {
                    setError("Layanan Google Login gagal dimuat.");
                }
                return;
            }

            window.google.accounts.id.initialize({
                client_id: clientId,

                callback: async (response) => {
                    if (!response.credential) return;

                    setBusy(true);
                    setError("");

                    try {
                        await loginRef.current(response.credential);

                        if (!cancelled) {
                            navigate("/dashboard", { replace: true });
                        }
                    } catch (err) {
                        if (!cancelled) {
                            setError(getApiError(err));
                        }
                    } finally {
                        if (!cancelled) setBusy(false);
                    }
                },

                auto_select: false,
                ux_mode: "popup"
            });

            if (buttonRef.current) {
                buttonRef.current.replaceChildren();

                window.google.accounts.id.renderButton(
                    buttonRef.current,
                    {
                        theme: "outline",
                        size: "large",
                        shape: "rectangular",
                        text: "continue_with",
                        width: 320
                    }
                );
            }
        }

        initializeGoogle();

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [navigate]);

    return (
        <div className="space-y-3">
            <div className="flex justify-center" ref={buttonRef} />

            {busy && (
                <p role="status" className="text-center text-sm text-slate-500">
                    Menghubungkan akun Google...
                </p>
            )}

            {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}
