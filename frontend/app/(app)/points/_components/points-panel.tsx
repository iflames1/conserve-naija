"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { AppHeader } from "@/components/common/app-header"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { formatKilograms } from "@/lib/operations"
import { useAuthHydrated, useAuthToken } from "@/stores/auth"
import type { ActivitySummary } from "@/app/(app)/activity/_components/activity-panel"

export function PointsPanel() {
    const token = useAuthToken()
    const hydrated = useAuthHydrated()
    const [summary, setSummary] = useState<ActivitySummary | null>(null)

    useEffect(() => {
        if (!token) return
        let active = true
        apiFetch<ActivitySummary>("/api/v1/me/activity", { token })
            .then((data) => {
                if (active) setSummary(data)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [token])

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pt-6 pb-12 sm:px-8 lg:px-12">
            <AppHeader active="points" />

            {hydrated && !token ? (
                <section className="py-16">
                    <h1 className="font-display text-4xl tracking-tight">
                        Conserve Points
                    </h1>
                    <p className="mt-4 text-muted-foreground">
                        Sign in to see your balance and how it was earned.
                    </p>
                    <Link
                        href="/auth/login?next=/points"
                        className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                        Sign in
                    </Link>
                </section>
            ) : (
                <section className="py-12">
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                        Your balance
                    </p>
                    {!summary ? (
                        <Skeleton className="mt-5 h-20 w-64" />
                    ) : (
                        <p className="tnum mt-5 font-display text-6xl text-primary sm:text-7xl">
                            {summary.conserve_points.toLocaleString("en-NG")} CP
                        </p>
                    )}
                    <p className="mt-5 text-muted-foreground">
                        Conserve Points are valued at ₦1 each for display and
                        valuation purposes. They are earned from
                        machine-measured deposits.
                    </p>
                    {summary ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                            Earned across {summary.deposits} deposit
                            {summary.deposits === 1 ? "" : "s"} ·{" "}
                            {formatKilograms(summary.total_weight_grams)}{" "}
                            returned
                        </p>
                    ) : null}
                    <Link
                        href="/activity"
                        className="mt-8 inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted"
                    >
                        See how you earned them
                    </Link>
                </section>
            )}
        </main>
    )
}
