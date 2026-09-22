import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "How recycling works" }

const steps = [
    ["01", "Start a mission", "Your phone creates a short-lived Conserve OTP."],
    ["02", "Connect at a Conserve Site", "Enter the OTP on an active machine."],
    [
        "03",
        "Deposit your materials",
        "The machine sorts and measures what you bring.",
    ],
    [
        "04",
        "Receive your CP",
        "The backend validates the measurement and awards Conserve Points.",
    ],
]

export default function HowItWorksPage() {
    return (
        <main className="mx-auto min-h-svh max-w-4xl px-5 py-16 sm:px-8">
            <Link className="font-display" href="/">
                Conserve Naija
            </Link>
            <h1 className="font-display mt-20 text-5xl tracking-tight">
                A clear path from material to value.
            </h1>
            <div className="mt-12 divide-y divide-border border-y border-border">
                {steps.map(([number, title, copy]) => (
                    <div
                        key={number}
                        className="grid gap-4 py-7 sm:grid-cols-[5rem_1fr]"
                    >
                        <span className="font-mono text-sm text-primary">
                            {number}
                        </span>
                        <div>
                            <h2 className="font-display text-2xl">{title}</h2>
                            <p className="mt-2 text-muted-foreground">{copy}</p>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    )
}
