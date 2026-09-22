"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { AppHeader } from "@/components/common/app-header"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api"
import { formatKilograms } from "@/lib/operations"
import { useAuthHydrated, useAuthToken } from "@/stores/auth"

export type DepositLine = {
    material: string
    weight_grams: number
    conserve_points: number
}

export type ActivitySummary = {
    conserve_points: number
    total_weight_grams: number
    deposits: number
    recent: {
        id: string
        site_name: string
        conserve_points: number
        created_at: string
        lines: DepositLine[]
    }[]
}

const EMPTY: ActivitySummary = {
    conserve_points: 0,
    total_weight_grams: 0,
    deposits: 0,
    recent: [],
}

export function ActivityPanel() {
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
            .catch(() => {
                if (active) setSummary(EMPTY)
            })
        return () => {
            active = false
        }
    }, [token])

    const loading = Boolean(token) && !summary
    const data = summary ?? EMPTY

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pt-6 pb-12 sm:px-8 lg:px-12">
            <AppHeader active="activity" />

            {hydrated && !token ? (
                <section className="py-16">
                    <h1 className="font-display text-4xl tracking-tight">
                        Your recycling record.
                    </h1>
                    <p className="mt-4 text-muted-foreground">
                        Sign in to see every deposit, the weight you returned,
                        and your Conserve Points.
                    </p>
                    <Link
                        href="/auth/login?next=/activity"
                        className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                        Sign in
                    </Link>
                </section>
            ) : (
                <section className="py-12">
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                        Your activity
                    </p>
                    <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
                        Every return counts.
                    </h1>

                    {loading ? (
                        <div className="mt-8 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Skeleton className="h-24 rounded-2xl" />
                                <Skeleton className="h-24 rounded-2xl" />
                                <Skeleton className="h-24 rounded-2xl" />
                            </div>
                            <Skeleton className="h-32 rounded-2xl" />
                        </div>
                    ) : (
                        <>
                            <div className="mt-8 grid gap-4 sm:grid-cols-3">
                                {[
                                    [
                                        `${data.conserve_points.toLocaleString("en-NG")} CP`,
                                        "Balance",
                                    ],
                                    [
                                        formatKilograms(
                                            data.total_weight_grams
                                        ),
                                        "Weight returned",
                                    ],
                                    [String(data.deposits), "Deposits"],
                                ].map(([value, label]) => (
                                    <div
                                        key={label}
                                        className="rounded-2xl border border-border p-5 surface-raised"
                                    >
                                        <p className="tnum font-display text-2xl">
                                            {value}
                                        </p>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {label}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {data.recent.length === 0 ? (
                                <div className="mt-8 rounded-2xl border border-border p-6">
                                    <h2 className="font-display text-xl">
                                        No deposits yet
                                    </h2>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Start a recycling mission at a Conserve
                                        Site and your deposits will appear here.
                                    </p>
                                    <Link
                                        href="/"
                                        className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                                    >
                                        Start recycling
                                    </Link>
                                </div>
                            ) : (
                                <ol className="mt-8 space-y-4">
                                    {data.recent.map((deposit) => (
                                        <li
                                            key={deposit.id}
                                            className="rounded-2xl border border-border p-5 surface-raised"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="font-medium">
                                                        {deposit.site_name}
                                                    </h2>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {new Date(
                                                            deposit.created_at
                                                        ).toLocaleString(
                                                            "en-NG",
                                                            {
                                                                dateStyle:
                                                                    "medium",
                                                                timeStyle:
                                                                    "short",
                                                            }
                                                        )}
                                                    </p>
                                                </div>
                                                <span className="tnum font-display text-xl text-primary">
                                                    +
                                                    {deposit.conserve_points.toLocaleString(
                                                        "en-NG"
                                                    )}{" "}
                                                    CP
                                                </span>
                                            </div>
                                            <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                                                {deposit.lines.map((line) => (
                                                    <li
                                                        key={line.material}
                                                        className="flex items-center justify-between gap-3"
                                                    >
                                                        <span>
                                                            {line.material}
                                                        </span>
                                                        <span className="tnum text-muted-foreground">
                                                            {formatKilograms(
                                                                line.weight_grams
                                                            )}{" "}
                                                            ·{" "}
                                                            {
                                                                line.conserve_points
                                                            }{" "}
                                                            CP
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </>
                    )}
                </section>
            )}
        </main>
    )
}
