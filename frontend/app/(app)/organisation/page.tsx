import type { Metadata } from "next"

import { OpsShell } from "@/components/organisation/ops-shell"

export const metadata: Metadata = {
    title: "Organisation overview",
    description: "Monitor Conserve Sites, inventory and collection operations.",
}

export default function OrganisationPage() {
    return (
        <OpsShell>
            <section className="py-10">
                <p className="text-sm tracking-[0.16em] text-primary uppercase">
                    Today
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight">
                    Network overview
                </h1>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {[
                        ["3", "Conserve Sites"],
                        ["8", "Active machines"],
                        ["₦42,680", "CP awarded"],
                    ].map(([value, label]) => (
                        <div
                            key={label}
                            className="rounded-2xl border border-border p-5 surface-raised"
                        >
                            <p className="font-display text-3xl">{value}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {label}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="mt-8 rounded-2xl border border-border p-5">
                    <h2 className="font-display text-xl">Needs attention</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Two Conserve Sites have material ready for pickup.
                    </p>
                </div>
            </section>
        </OpsShell>
    )
}
