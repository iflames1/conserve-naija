"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms, useOrganisation } from "@/lib/operations"

type Pickup = {
    id: string
    site_name: string
    material: string
    weight_grams: number
    status: string
}

const NEXT_ACTIONS: Record<string, { label: string; status: string }[]> = {
    ready: [
        { label: "Accept", status: "accepted" },
        { label: "Cancel", status: "cancelled" },
    ],
    accepted: [
        { label: "Complete", status: "completed" },
        { label: "Cancel", status: "cancelled" },
    ],
    completed: [],
    cancelled: [],
}

const STATUS_LABELS: Record<string, string> = {
    ready: "Ready",
    accepted: "Accepted",
    completed: "Completed",
    cancelled: "Cancelled",
}

export function PickupsPanel() {
    const { token, hydrated, organisation, loading, error, load } =
        useOrganisation()
    const [pickups, setPickups] = useState<Pickup[] | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    useEffect(() => {
        if (!organisation) return
        let active = true
        load<Pickup[]>("pickups")
            .then((rows) => {
                if (active) setPickups(rows)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisation])

    async function advance(pickup: Pickup, status: string) {
        setBusy(pickup.id)
        setNotice(null)
        try {
            const updated = await load<Pickup>(`pickups/${pickup.id}/${status}`)
            setPickups((current) =>
                current
                    ? current.map((row) =>
                          row.id === updated.id ? updated : row
                      )
                    : current
            )
            setNotice(
                `${pickup.material} pickup is now ${STATUS_LABELS[updated.status]?.toLowerCase() ?? updated.status}.`
            )
        } catch {
            setNotice("We could not update that pickup.")
        } finally {
            setBusy(null)
        }
    }

    return (
        <section className="py-10">
            <h1 className="font-display text-4xl tracking-tight">Pickups</h1>
            <p className="mt-3 text-muted-foreground">
                Collect accumulated material once a Conserve Site reaches its
                threshold.
            </p>

            {error ? (
                <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
            {notice ? (
                <p className="mt-4 text-sm text-primary">{notice}</p>
            ) : null}

            {hydrated && !token ? (
                <p className="mt-6 text-sm text-muted-foreground">
                    Sign in as an organisation administrator to manage pickups.
                </p>
            ) : loading || !pickups ? (
                <div className="mt-8 space-y-3">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                </div>
            ) : pickups.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-border p-6">
                    <h2 className="font-display text-xl">No pickups yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        A pickup appears here once a Conserve Site holds enough
                        of a material to be worth collecting.
                    </p>
                </div>
            ) : (
                <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                    {pickups.map((pickup) => (
                        <div
                            key={pickup.id}
                            className="flex flex-wrap items-center justify-between gap-4 p-5"
                        >
                            <div>
                                <h2 className="font-medium">
                                    {pickup.site_name} · {pickup.material}
                                </h2>
                                <p className="tnum mt-1 text-sm text-muted-foreground">
                                    {formatKilograms(pickup.weight_grams)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="rounded-full border border-border px-3 py-1 text-xs text-primary">
                                    {STATUS_LABELS[pickup.status] ??
                                        pickup.status}
                                </span>
                                {(NEXT_ACTIONS[pickup.status] ?? []).map(
                                    (action) => (
                                        <Button
                                            key={action.status}
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg"
                                            disabled={busy === pickup.id}
                                            onClick={() =>
                                                void advance(
                                                    pickup,
                                                    action.status
                                                )
                                            }
                                        >
                                            {action.label}
                                        </Button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
