import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    resetCsrfToken
} from "../lib/api";

import api from "../lib/api";

import { AuthContext } from "./useAuth";

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const response = await api.get("/auth/me");
            setUser(response.data.data.user);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        api.get("/auth/me").then(response => {
            if (active) setUser(response.data.data.user);
        }).catch(() => { if (active) setUser(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    async function login(email, password) {
        const response = await api.post("/auth/login", {
            email,
            password,
        });

        setUser(response.data.data.user);
        resetCsrfToken(); // Reset token CSRF setelah login berhasil
        return response.data;
    }

    async function register(name, email, password) {
        const response = await api.post("/auth/register", {
            name,
            email,
            password,
            confirmPassword: password,
        });

        setUser(response.data.data.user);
        resetCsrfToken(); // Reset token CSRF setelah register berhasil
        return response.data;
    }

    async function loginWithGoogle(credential) {
        const response = await api.post("/auth/google", {
            credential
        });

        // Pastikan cookie yang diterima benar-benar dapat
        // digunakan untuk mengakses endpoint terlindungi.
        const meResponse = await api.get("/auth/me");

        const authenticatedUser = meResponse.data.data.user;

        if (!authenticatedUser) {
            throw new Error("Sesi Google Login tidak valid");
        }

        resetCsrfToken();
        setUser(authenticatedUser);

        return response.data;
    }

    async function logout() {
        await api.post("/auth/logout");
        setUser(null);
        resetCsrfToken(); // Reset token CSRF setelah logout berhasil
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                loginWithGoogle,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
