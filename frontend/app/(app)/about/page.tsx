import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "About Conserve Naija" }

export default function AboutPage() {
    return (
        <main className="mx-auto min-h-svh w-full max-w-6xl px-5 py-16 sm:px-8 lg:px-12">
            <Link className="font-display" href="/">
                Conserve Naija
            </Link>
            <h1 className="mt-20 max-w-3xl font-display text-5xl tracking-tight">
                Keeping resources in circulation.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Conserve Naija connects people, Conserve Sites, machines, and
                recycling organisations. The machine measures what enters the
                loop; the backend validates it and calculates the value.
            </p>
        </main>
    )
}
