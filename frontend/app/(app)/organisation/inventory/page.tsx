import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"

export const metadata: Metadata = { title: "Inventory" }

const inventory = [
    ["Plastic", "148.6 kg", "Ready"],
    ["Paper & Cardboard", "62.4 kg", "Building"],
    ["Glass", "39.8 kg", "Building"],
    ["Metal", "18.2 kg", "Building"],
]

export default function InventoryPage() {
    return (
        <OpsShell>
            <section className="py-10">
                <p className="text-sm tracking-[0.16em] text-primary uppercase">
                    Yaba
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight">
                    Material inventory
                </h1>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {inventory.map(([material, weight, state]) => (
                        <div
                            key={material}
                            className="rounded-2xl border border-border p-5 surface-raised"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <h2 className="font-medium">{material}</h2>
                                <span className="text-xs text-muted-foreground">
                                    {state}
                                </span>
                            </div>
                            <p className="mt-6 font-display text-3xl">
                                {weight}
                            </p>
                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className="h-full w-3/5 rounded-full bg-primary" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </OpsShell>
    )
}
