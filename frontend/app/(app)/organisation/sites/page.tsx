import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"

export const metadata: Metadata = { title: "Conserve Sites" }

const sites = [
    ["Yaba", "18 Herbert Macaulay Way", "Active", "4 machines"],
    ["Lekki", "Admiralty Way", "Maintenance", "2 machines"],
]

export default function SitesPage() {
    return (
        <OpsShell>
            <section className="py-10">
                <h1 className="font-display text-4xl tracking-tight">
                    Conserve Sites
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Locations and equipment across your network.
                </p>
                <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                    {sites.map(([name, address, status, machines]) => (
                        <div
                            key={name}
                            className="flex flex-wrap items-center justify-between gap-4 p-5"
                        >
                            <div>
                                <h2 className="font-medium">{name}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {address} · {machines}
                                </p>
                            </div>
                            <span className="rounded-full border border-border px-3 py-1 text-xs text-primary">
                                {status}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </OpsShell>
    )
}
