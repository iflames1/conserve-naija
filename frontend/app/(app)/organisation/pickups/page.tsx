import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"

export const metadata: Metadata = { title: "Pickups" }

const pickups = [
    ["Yaba · Plastic", "148.6 kg", "Ready"],
    ["Ikeja · Paper & Cardboard", "103.2 kg", "Accepted"],
]

export default function PickupsPage() {
    return (
        <OpsShell>
            <section className="py-10">
                <h1 className="font-display text-4xl tracking-tight">
                    Pickups
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Move collected materials out of the network on time.
                </p>
                <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
                    {pickups.map(([name, weight, status]) => (
                        <div
                            key={name}
                            className="flex flex-wrap items-center justify-between gap-4 p-5"
                        >
                            <div>
                                <h2 className="font-medium">{name}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {weight}
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
