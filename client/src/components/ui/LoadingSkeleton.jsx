function SkeletonBlock({ className = "" }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <SkeletonBlock className="mb-4 h-4 w-28" />
            <SkeletonBlock className="h-8 w-40" />
            <SkeletonBlock className="mt-4 h-3 w-24" />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5">
                <SkeletonBlock className="h-5 w-40" />
            </div>

            <div className="divide-y divide-slate-100">
                {Array.from({ length: rows }).map((_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 p-4"
                    >
                        <SkeletonBlock className="h-11 w-11 shrink-0 rounded-xl" />

                        <div className="flex-1 space-y-2">
                            <SkeletonBlock className="h-4 w-32 max-w-full" />
                            <SkeletonBlock className="h-3 w-24" />
                        </div>

                        <SkeletonBlock className="h-5 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div role="status" aria-label="Memuat data beranda" className="space-y-6">
            <div className="space-y-3">
                <SkeletonBlock className="h-8 w-56" />
                <SkeletonBlock className="h-4 w-72 max-w-full" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>

            <SkeletonBlock className="h-72 w-full" />

            <TableSkeleton rows={4} />

            <span className="sr-only">
                Sedang memuat data beranda.
            </span>
        </div>
    );
}

export default SkeletonBlock;
