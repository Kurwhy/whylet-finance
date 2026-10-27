import whyletLogo from "../../assets/whylet-logo.png";

export default function BrandLogo({ className = "", imageClassName = "h-16 w-16", showName = true }) {
    return (
        <span className={`inline-flex shrink-0 items-center gap-3 ${className}`}>
            <img
                src={whyletLogo}
                alt="Logo resmi Whylet"
                width={2048}
                height={2048}
                className={`shrink-0 rounded-xl border border-emerald-800/30 bg-emerald-950 object-contain ${imageClassName}`}
                decoding="async"
            />
            {showName && (
                <span aria-hidden="true" className="text-2xl font-extrabold tracking-tight text-slate-900">
                    whylet<span className="text-emerald-700">.</span>
                </span>
            )}
        </span>
    );
}
