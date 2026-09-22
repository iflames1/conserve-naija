import type { Metadata } from "next"
import Link from "next/link"

import { MapPin, Recycle } from "lucide-react"

export const metadata: Metadata = {
    title: "Conserve Sites",
    description: "Find an active Conserve Site near you.",
}

const sites = [
    {
        name: "Yaba",
        address: "18 Herbert Macaulay Way, Yaba, Lagos",
        materials: "Plastic · Paper & Cardboard · Glass · Metal",
    },
]

export default function CollectionPointsPage() {
    return (
        <main className="mx-auto min-h-svh w-full max-w-4xl px-5 pt-8 pb-12 sm:px-8">
            <header className="flex items-center justify-between">
                <Link className="font-display text-lg" href="/">
                    Conserve Naija
                </Link>
                <span className="text-sm text-muted-foreground">
                    Conserve Sites
                </span>
            </header>
            <section className="py-16">
                <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                    Find a site
                </p>
                <h1 className="font-display mt-4 text-5xl tracking-tight">
                    Bring it back to the loop.
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
                    Choose a Conserve Site, bring your materials, and use the
                    machine there to start a mission.
                </p>
                <div className="mt-10 space-y-4">
                    {sites.map((site) => (
                        <article
                            key={site.name}
                            className="surface-raised rounded-2xl border border-border p-6"
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
                                        {site.materials}
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
                    ))}
                </div>
            </section>
        </main>
    )
}
