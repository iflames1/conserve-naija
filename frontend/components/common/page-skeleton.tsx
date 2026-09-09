import { Skeleton } from "@/components/ui"
import { cn } from "@/lib/utils"

function Surface({
    children,
    className,
    tint,
}: {
    children: React.ReactNode
    className?: string
    tint?: "home" | "profile"
}) {
    return (
        <div
            className={cn(
                "relative isolate overflow-hidden rounded-2xl border border-border/70 surface-raised",
                className
            )}
        >
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid" />
            <div
                aria-hidden
                className={cn(
                    "absolute inset-0 -z-10",
                    tint === "profile"
                        ? "bg-linear-to-r from-primary/18 via-transparent to-warning/8"
                        : "bg-linear-to-r from-primary/14 via-transparent to-transparent"
                )}
            />
            {children}
        </div>
    )
}

export function HeaderActionsSkeleton() {
    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton className="hidden h-9 w-24 rounded-full sm:block" />
            <Skeleton className="size-8 rounded-full" />
        </div>
    )
}

export function ActivityRowsSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
            {Array.from({ length: rows }).map((_, index) => (
                <ActivityRowItemSkeleton key={index} />
            ))}
        </ul>
    )
}

function ActivityRowItemSkeleton() {
    return (
        <li className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36 max-w-full" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3 w-10" />
            </div>
        </li>
    )
}

export function HomeScreenSkeleton() {
    return (
        <div className="space-y-8">
            <Surface>
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 p-5 sm:p-6">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-10 w-40 sm:h-12 sm:w-52" />
                        <Skeleton className="h-4 w-36" />
                    </div>
                    <div className="flex gap-8">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-6 w-10" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-6 w-14" />
                        </div>
                    </div>
                </div>
            </Surface>

            <section className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-primary/8 p-5 sm:p-7">
                <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-50" />
                <Skeleton className="h-3 w-24 bg-primary/20" />
                <Skeleton className="mt-4 h-9 w-64 max-w-full bg-primary/20 sm:h-10" />
                <Skeleton className="mt-3 h-4 w-48 max-w-full bg-primary/15" />
                <Skeleton className="mt-6 h-12 w-36 rounded-lg bg-primary/25" />
            </section>

            <section className="space-y-4">
                <Skeleton className="h-7 w-32" />
                <ActivityRowsSkeleton />
            </section>
        </div>
    )
}

export function GuestLandingSkeleton() {
    return (
        <div className="space-y-14 pb-8">
            <section className="relative isolate overflow-hidden rounded-3xl border border-border/70 bg-grid">
                <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-br from-primary/18 via-transparent to-warning/10"
                />
                <div className="relative grid gap-10 px-6 py-14 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-14 lg:py-20">
                    <div className="flex max-w-xl flex-col gap-7">
                        <Skeleton className="h-7 w-40 rounded-full" />
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full max-w-sm sm:h-14" />
                            <Skeleton className="h-10 w-3/4 max-w-xs sm:h-14" />
                            <Skeleton className="h-4 w-full max-w-lg" />
                            <Skeleton className="h-4 w-2/3 max-w-md" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Skeleton className="h-12 w-44 rounded-lg" />
                            <Skeleton className="h-12 w-36 rounded-lg" />
                        </div>
                        <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border/60 pt-6">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="space-y-2">
                                    <Skeleton className="h-3 w-10" />
                                    <Skeleton className="h-6 w-20" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <KioskSkeleton />
                </div>
            </section>

            <section className="space-y-5">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-44" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <li key={index} className="flex gap-4 px-4 py-5 sm:px-5">
                            <Skeleton className="size-9 shrink-0 rounded-lg" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-full max-w-md" />
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <MachineRowSkeleton />
            </section>
        </div>
    )
}

function KioskSkeleton() {
    return (
        <div className="mx-auto w-full max-w-75 rounded-[1.6rem] border border-border/70 bg-card/90 p-4 surface-raised">
            <Skeleton className="mx-auto h-3 w-28" />
            <Skeleton className="mt-3 h-28 w-full rounded-lg bg-primary/15" />
            <div className="mt-4 grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 rounded-md" />
                ))}
                <Skeleton className="col-span-3 h-10 rounded-md bg-primary/25" />
            </div>
        </div>
    )
}

export function ProfilePageSkeleton() {
    return (
        <div className="space-y-8">
            <Surface tint="profile">
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 p-5 sm:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        <Skeleton className="size-16 shrink-0 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-40 sm:h-9 sm:w-52" />
                            <Skeleton className="h-4 w-44 max-w-full" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                    </div>
                    <div className="flex gap-8">
                        <div className="space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-7 w-20" />
                        </div>
                        <div className="space-y-1">
                            <Skeleton className="h-3 w-12" />
                            <Skeleton className="h-7 w-16" />
                        </div>
                    </div>
                </div>
            </Surface>

            <div className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 p-5 surface-raised sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className={cn(
                            "flex items-start gap-3",
                            index === 2 && "col-span-2 sm:col-span-1"
                        )}
                    >
                        <Skeleton className="size-9 shrink-0 rounded-lg" />
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-14" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                    </div>
                ))}
            </div>

            <section className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <ActivityRowsSkeleton rows={5} />
            </section>
        </div>
    )
}

export function ExplorePageSkeleton() {
    return (
        <div>
            <header className="max-w-xl space-y-3">
                <Skeleton className="h-10 w-48 sm:h-11" />
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-4 w-56 max-w-full" />
            </header>
            <div className="mt-8">
                <MachineRowSkeleton />
            </div>
        </div>
    )
}

export function MachineRowItemSkeleton() {
    return (
        <li className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    <Skeleton className="h-5 w-52 max-w-full" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                </div>
                <Skeleton className="h-5 w-14 rounded-md" />
            </div>
            <Skeleton className="mt-3 h-4 w-40" />
        </li>
    )
}

export function MachineRowSkeleton() {
    return (
        <ul className="overflow-hidden rounded-2xl border border-border/70 surface-raised">
            <MachineRowItemSkeleton />
        </ul>
    )
}

export function OrgDashboardSkeleton() {
    return (
        <div className="space-y-10">
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 p-5 surface-raised lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                ))}
            </div>
            <section className="space-y-4">
                <Skeleton className="h-7 w-40" />
                <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                        >
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                            <Skeleton className="h-5 w-14 rounded-md" />
                        </div>
                    ))}
                </div>
            </section>
            <section className="space-y-4">
                <Skeleton className="h-7 w-44" />
                <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="rounded-2xl border border-border/70 p-5 surface-raised"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-14" />
                            </div>
                            <Skeleton className="mt-3 h-2 w-full rounded-full" />
                            <Skeleton className="mt-3 h-4 w-24" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}

export function OrgFormPageSkeleton({
    titleWidth = "w-40",
}: {
    titleWidth?: string
}) {
    return (
        <div>
            <Skeleton className={cn("h-10", titleWidth)} />
            <Skeleton className="mt-2 h-4 w-full max-w-lg" />
            <div className="mt-8 rounded-2xl border border-border/70 p-5 surface-raised">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10 w-36" />
                </div>
            </div>
            <div className="mt-8 space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 p-5 surface-raised"
                    >
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-52 max-w-full" />
                        </div>
                        <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function OrgFillCardSkeleton({ count = 2 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="rounded-2xl border border-border/70 p-5 surface-raised"
                >
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="mt-2 h-4 w-56 max-w-full" />
                    <Skeleton className="mt-4 h-2 w-full rounded-full" />
                    <Skeleton className="mt-2 h-4 w-32" />
                </div>
            ))}
        </>
    )
}

export function OrgPointsPageSkeleton() {
    return (
        <div>
            <Skeleton className="h-10 w-56" />
            <Skeleton className="mt-2 h-4 w-full max-w-lg" />
            <div className="mt-8 rounded-2xl border border-border/70 p-5 surface-raised">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
                <OrgFillCardSkeleton />
            </div>
        </div>
    )
}
