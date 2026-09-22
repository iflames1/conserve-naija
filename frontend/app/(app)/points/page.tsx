import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Conserve Points" }

export default function PointsPage() {
    return (
        <main className="mx-auto min-h-svh max-w-3xl px-5 py-16 sm:px-8">
            <Link className="font-display" href="/">
                Conserve Naija
            </Link>
            <section className="py-20">
                <p className="text-sm tracking-[0.18em] text-primary uppercase">
                    Your balance
                </p>
                <h1 className="font-display mt-4 text-6xl">0 CP</h1>
                <p className="mt-5 text-muted-foreground">
                    Conserve Points are valued at ₦1 each for display and
                    valuation purposes.
                </p>
            </section>
        </main>
    )
}
