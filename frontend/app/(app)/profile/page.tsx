import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Profile" }

export default function ProfilePage() {
    return (
        <main className="mx-auto min-h-svh max-w-3xl px-5 py-16 sm:px-8">
            <Link className="font-display" href="/">
                Conserve Naija
            </Link>
            <section className="py-20">
                <p className="text-sm tracking-[0.18em] text-primary uppercase">
                    Profile
                </p>
                <h1 className="font-display mt-4 text-5xl">
                    Your recycling record.
                </h1>
                <p className="mt-5 text-muted-foreground">
                    Sign in to see your balance, weight returned, and mission
                    history.
                </p>
            </section>
        </main>
    )
}
