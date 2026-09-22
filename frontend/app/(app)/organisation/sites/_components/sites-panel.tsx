"use client"

import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { formatKilograms, useOrganisation } from "@/lib/operations"

type Site = {
    id: string
    name: string
    slug: string
    address: string
    status: string
    machines: number
    active_machines: number
    accepted_materials: string[]
    inventory_grams: number
}

export function SitesPanel() {
    const { token, hydrated, organisation, loading, error, load } =
        useOrganisation()
    const [sites, setSites] = useState<Site[] | null>(null)

    useEffect(() => {
        if (!organisation) return
        let active = true
        load<Site[]>("sites")
            .then((rows) => {
                if (active) setSites(rows)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisation])

    return (
        <section className="py-10">
            <h1 className="font-display text-4xl tracking-tight">
                Conserve Sites
            </h1>
            <p className="mt-3 text-muted-foreground">
                Locations, equipment, and accepted materials across your
                network.
            </p>

            {error ? (
                <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}

            {!token ? (
                hydrated ? (
                    <p className="mt-6 text-sm text-muted-foreground">
                        Sign in as an organisation administrator to see your
                        Conserve Sites.
                    </p>
                ) : null
            ) : loading || !sites ? (
                <div className="mt-8 space-y-3">
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                </div>
            ) : (
                <div className="mt-8 space-y-4">
                    {sites.map((site) => (
                        <article
                            key={site.id}
                            className="rounded-2xl border border-border p-5 surface-raised"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h2 className="font-display text-xl">
                                        {site.name}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {site.address}
                                    </p>
                                </div>
                                <span className="rounded-full border border-border px-3 py-1 text-xs text-primary">
                                    {site.status === "active"
                                        ? "Active"
                                        : site.status}
                                </span>
                            </div>

                            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                                <div>
                                    <dt className="text-muted-foreground">
                                        Machines
                                    </dt>
                                    <dd className="tnum mt-1">
                                        {site.active_machines} of{" "}
                                        {site.machines} online
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Inventory
                                    </dt>
                                    <dd className="tnum mt-1">
                                        {formatKilograms(site.inventory_grams)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">
                                        Accepted materials
                                    </dt>
                                    <dd className="mt-1">
                                        {site.accepted_materials.join(", ") ||
                                            "None yet"}
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}
