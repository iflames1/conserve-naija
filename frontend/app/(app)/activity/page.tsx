import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Activity" }

export default function ActivityPage() {
    return (
        <main className="mx-auto min-h-svh max-w-3xl px-5 py-16 sm:px-8">
            <Link className="font-display" href="/">
                Conserve Naija
            </Link>
            <section className="py-20">
                <p className="text-sm tracking-[0.18em] text-primary uppercase">
                    Your activity
                </p>
                <h1 className="font-display mt-4 text-5xl">
                    Every return counts.
                </h1>
                <p className="mt-5 text-muted-foreground">
                    Your completed missions and CP ledger will appear here after
                    your first deposit.
                </p>
            </section>
        </main>
    )
}
