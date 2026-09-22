"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms, useOrganisation } from "@/lib/operations"

type Overview = {
    sites: number
    machines: number
    active_machines: number
    deposits: number
    conserve_points_awarded: number
    inventory_grams: number
    pickups_ready: number
}

type InventoryRow = {
    site_name: string
    material: string
    weight_grams: number
    threshold_grams: number | null
    ready_for_pickup: boolean
}

export function OverviewPanel() {
    const { token, hydrated, organisation, loading, error, load } =
        useOrganisation()
    const [overview, setOverview] = useState<Overview | null>(null)
    const [ready, setReady] = useState<InventoryRow[]>([])

    useEffect(() => {
        if (!organisation) return
        let active = true
        Promise.all([
            load<Overview>("overview"),
            load<InventoryRow[]>("inventory"),
        ])
            .then(([summary, inventory]) => {
                if (!active) return
                setOverview(summary)
                setReady(inventory.filter((row) => row.ready_for_pickup))
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisation])

    if (hydrated && !token) {
        return (
            <section className="py-10">
                <h1 className="font-display text-4xl tracking-tight">
                    Network overview
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Sign in as an organisation administrator to see live
                    operations.
                </p>
                <Link
                    href="/auth/login?next=/organisation"
                    className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                    Sign in
                </Link>
            </section>
        )
    }

    const stats = overview
        ? [
              [String(overview.sites), "Conserve Sites"],
              [
                  `${overview.active_machines}/${overview.machines}`,
                  "Machines online",
              ],
              [String(overview.deposits), "Deposits"],
              [
                  `${overview.conserve_points_awarded.toLocaleString("en-NG")} CP`,
                  "CP awarded",
              ],
              [formatKilograms(overview.inventory_grams), "In inventory"],
              [String(overview.pickups_ready), "Pickups ready"],
          ]
        : []

    return (
        <section className="py-10">
            <p className="text-sm tracking-[0.16em] text-primary uppercase">
                {organisation?.name ?? "Operations"}
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">
                Network overview
            </h1>

            {error ? (
                <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}

            {loading || !overview ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((key) => (
                        <Skeleton key={key} className="h-28 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {stats.map(([value, label]) => (
                            <div
                                key={label}
                                className="rounded-2xl border border-border p-5 surface-raised"
                            >
                                <p className="tnum font-display text-3xl">
                                    {value}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 rounded-2xl border border-border p-5 surface-raised">
                        <h2 className="font-display text-xl">
                            Needs attention
                        </h2>
                        {ready.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Nothing is waiting on a pickup right now.
                            </p>
                        ) : (
                            <ul className="mt-3 space-y-2 text-sm">
                                {ready.map((row) => (
                                    <li
                                        key={`${row.site_name}-${row.material}`}
                                        className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                        <span>
                                            {row.site_name} · {row.material}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatKilograms(row.weight_grams)}{" "}
                                            ready
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {ready.length > 0 ? (
                            <Link
                                href="/organisation/pickups"
                                className="mt-5 inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted"
                            >
                                Review pickups
                            </Link>
                        ) : null}
                    </div>
                </>
            )}
        </section>
    )
}
