"use client"

import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms, useOrganisation } from "@/lib/operations"

type InventoryRow = {
    site_id: string
    site_name: string
    material: string
    weight_grams: number
    threshold_grams: number | null
    ready_for_pickup: boolean
}

export function InventoryPanel() {
    const { token, hydrated, organisation, loading, error, load } =
        useOrganisation()
    const [rows, setRows] = useState<InventoryRow[] | null>(null)

    useEffect(() => {
        if (!organisation) return
        let active = true
        load<InventoryRow[]>("inventory")
            .then((data) => {
                if (active) setRows(data)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisation])

    return (
        <section className="py-10">
            <p className="text-sm tracking-[0.16em] text-primary uppercase">
                {organisation?.name ?? "Inventory"}
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">
                Material inventory
            </h1>
            <p className="mt-3 text-muted-foreground">
                What is currently held at each Conserve Site, by material.
            </p>

            {error ? (
                <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}

            {hydrated && !token ? (
                <p className="mt-6 text-sm text-muted-foreground">
                    Sign in as an organisation administrator to see inventory.
                </p>
            ) : loading || !rows ? (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((key) => (
                        <Skeleton key={key} className="h-32 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {rows.map((row) => {
                        const target = row.threshold_grams ?? 0
                        const percent = target
                            ? Math.min(
                                  100,
                                  Math.round((row.weight_grams / target) * 100)
                              )
                            : 0
                        return (
                            <div
                                key={`${row.site_id}-${row.material}`}
                                className="rounded-2xl border border-border p-5 surface-raised"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="font-medium">
                                            {row.material}
                                        </h2>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {row.site_name}
                                        </p>
                                    </div>
                                    <span
                                        className={
                                            row.ready_for_pickup
                                                ? "text-xs text-primary"
                                                : "text-xs text-muted-foreground"
                                        }
                                    >
                                        {row.ready_for_pickup
                                            ? "Ready"
                                            : "Building"}
                                    </span>
                                </div>
                                <p className="tnum mt-6 font-display text-3xl">
                                    {formatKilograms(row.weight_grams)}
                                </p>
                                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                                {target ? (
                                    <p className="tnum mt-2 text-xs text-muted-foreground">
                                        {percent}% of {formatKilograms(target)}{" "}
                                        pickup threshold
                                    </p>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
