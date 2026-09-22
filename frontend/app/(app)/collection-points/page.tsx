import type { Metadata } from "next"
import Link from "next/link"

import { MapPin, Recycle } from "lucide-react"

import { AppHeader } from "@/components/common/app-header"

export const metadata: Metadata = {
    title: "Conserve Sites",
    description:
        "Find an active Conserve Site, see the materials it accepts, and start a recycling mission.",
}

type Site = {
    id: string
    name: string
    address: string
    status: string
    accepted_materials: string[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

async function loadSites(): Promise<Site[]> {
    try {
        const response = await fetch(`${API_URL}/api/v1/sites`, {
            next: { revalidate: 60 },
        })
        if (!response.ok) return []
        return (await response.json()) as Site[]
    } catch {
        // A site list should never break the page; show the empty state instead.
        return []
    }
}

export default async function CollectionPointsPage() {
    const sites = await loadSites()

    return (
        <main className="mx-auto min-h-svh w-full max-w-4xl px-5 pt-6 pb-12 sm:px-8">
            <AppHeader active="sites" />
            <section className="py-16">
                <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                    Find a site
                </p>
                <h1 className="mt-4 font-display text-5xl tracking-tight">
                    Bring it back to the loop.
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
                    Choose a Conserve Site, bring your materials, and use the
                    machine there to start a mission.
                </p>
                <div className="mt-10 space-y-4">
                    {sites.length === 0 ? (
                        <div className="rounded-2xl border border-border p-6">
                            <h2 className="font-display text-xl">
                                No sites are listed yet
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Conserve Sites appear here as soon as they come
                                online.
                            </p>
                        </div>
                    ) : (
                        sites.map((site) => (
                            <article
                                key={site.id}
                                className="rounded-2xl border border-border p-6 surface-raised"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-5">
                                    <div>
                                        <div className="flex items-center gap-2 text-primary">
                                            <MapPin className="size-5" />
                                            <h2 className="font-display text-2xl text-foreground">
                                                {site.name}
                                            </h2>
                                        </div>
                                        <p className="mt-3 text-muted-foreground">
                                            {site.address}
                                        </p>
                                        <p className="mt-5 flex items-center gap-2 text-sm">
                                            <Recycle className="size-4 text-primary" />{" "}
                                            {site.accepted_materials.join(
                                                " · "
                                            ) || "No materials listed"}
                                        </p>
                                    </div>
                                    <Link
                                        className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
                                        href="/"
                                    >
                                        Start a mission
                                    </Link>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </section>
        </main>
    )
}
