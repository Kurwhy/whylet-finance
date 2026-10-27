import BrandLogo from "../branding/BrandLogo";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
    Wallet,
    LayoutDashboard,
    ArrowLeftRight,
    ChartNoAxesCombined,
    Settings,
    LogOut,
    Menu,
    X,
    UserRound,
} from "lucide-react";

import { notify } from "../../utils/notify";
import { useAuth } from "../../context/useAuth";


const navigation = [
    { name: "Laporan", path: "/reports", icon: ChartNoAxesCombined },
    {
        name: "Beranda",
        path: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        name: "Transaksi",
        path: "/transactions",
        icon: ArrowLeftRight,
    },
    {
        name: "Dompet",
        path: "/wallets",
        icon: Wallet,
    },
];

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const sidebarRef = useRef(null);
    const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
    useEffect(() => {
        const query = window.matchMedia("(min-width: 1024px)");
        const change = () => setDesktop(query.matches);
        query.addEventListener("change", change);
        return () => query.removeEventListener("change", change);
    }, []);
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        if (!menuOpen || desktop) return;
        const previous = document.activeElement;
        sidebarRef.current.querySelector("button")?.focus();
        const onKey = event => { if (event.key === "Escape") setMenuOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
    }, [menuOpen, desktop]);

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await logout();
            navigate("/login", { replace: true });
        } catch {
            notify.error("Gagal keluar. Silakan coba lagi.");
            setLoggingOut(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Lewati ke konten utama</a>
            {menuOpen && (
                <button
                    aria-label="Tutup menu navigasi"
                    className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            <aside
                id="main-sidebar" ref={sidebarRef} inert={!desktop && !menuOpen}
                className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="flex h-20 items-center justify-between px-6">
                    <BrandLogo />

                    <button
                        className="lg:hidden"
                        onClick={() => setMenuOpen(false)}
                        aria-label="Tutup sidebar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 px-4 pt-6">
                    <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                        Ruang Kerja
                    </p>

                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "text-slate-500 hover:bg-slate-50"
                                        }`
                                    }
                                >
                                    <Icon size={19} />
                                    {item.name}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <NavLink to="/account" onClick={() => setMenuOpen(false)} className="mt-8 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Settings size={19} />Profil Saya</NavLink>

                </div>

                <div className="border-t border-slate-100 p-4">
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                            <UserRound size={18} />
                        </div>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                {user?.name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                        <LogOut size={18} />
                        {loggingOut ? "Sedang keluar..." : "Keluar"}
                    </button>
                </div>
            </aside>

            <div className="lg:pl-64">
                <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                            onClick={() => setMenuOpen(true)}
                            aria-label="Buka navigasi"
                            aria-expanded={menuOpen} aria-controls="main-sidebar"
                        >
                            <Menu size={23} />
                        </button>

                        <BrandLogo className="lg:hidden" imageClassName="h-10 w-10" showName={false} />
                        <div>
                            <p className="text-sm font-semibold text-slate-900">
                                Keuangan Pribadi
                            </p>
                            <p className="text-xs text-slate-500">
                                Kelola uang lebih cerdas.
                            </p>
                        </div>
                    </div>

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                </header>


                <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-7 pb-28 sm:px-8 lg:py-9">
                    <Outlet />
                </main>

                <nav
                    aria-label="Navigasi ponsel"
                    className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
                >
                    <div className="mx-auto flex max-w-md items-center justify-around py-2">
                        {navigation.map((item) => {
                            const Icon = item.icon;

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `flex min-w-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${isActive
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "text-slate-500"
                                        }`
                                    }
                                >
                                    <Icon size={21} />
                                    {item.name}
                                </NavLink>
                            );
                        })}
                    </div>
                </nav>
            </div>
        </div>
    );
}
