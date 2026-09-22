import type { Metadata } from "next"

import { AppHeader } from "@/components/common/app-header"
import { MissionStart } from "@/components/home/mission-start"

export const metadata: Metadata = {
    title: "Keep resources in circulation",
    description:
        "Bring recyclable materials to a Conserve Site and earn Conserve Points.",
}

export default function Page() {
    return (
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pt-6 pb-10 sm:px-8 lg:px-12">
            <AppHeader />
            <section className="grid flex-1 items-center gap-12 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-24">
                <div className="max-w-xl">
                    <p className="mb-5 text-sm font-medium tracking-[0.2em] text-primary uppercase">
                        Keeping resources in circulation
                    </p>
                    <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
                        A small action can keep a lot moving.
                    </h1>
                    <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        Bring recyclable materials to a Conserve Site, connect
                        to a machine, and earn Conserve Points for what you
                        return.
                    </p>
                    <div className="mt-8 max-w-md">
                        <MissionStart />
                    </div>
                </div>
                <div className="relative min-h-[23rem] overflow-hidden rounded-3xl border border-border bg-grid p-6 sm:min-h-[30rem] sm:p-8">
                    <div className="absolute inset-x-8 top-8 h-px bg-border-strong" />
                    <div className="absolute right-8 bottom-8 left-8 h-px bg-border-strong" />
                    <div className="absolute top-8 bottom-8 left-1/2 w-px bg-border-strong" />
                    <div className="relative flex h-full flex-col justify-between">
                        <div className="flex items-center justify-between text-xs tracking-[0.16em] text-muted-foreground uppercase">
                            <span>Material loop</span>
                            <span className="text-primary">01 — 04</span>
                        </div>
                        <div className="flex items-center justify-center">
                            <div className="flex size-44 items-center justify-center rounded-full border border-primary/50 bg-primary/10 shadow-[0_0_80px_oklch(0.78_0.15_145_/_0.18)] sm:size-60">
                                <div className="flex size-28 items-center justify-center rounded-full border border-primary/30 bg-background sm:size-40">
                                    <span className="font-display text-5xl text-primary sm:text-6xl">
                                        CP
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5 text-sm">
                            <div>
                                <p className="text-muted-foreground">
                                    Machine measured
                                </p>
                                <p className="mt-1 font-medium">
                                    Every deposit
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">
                                    Value returned
                                </p>
                                <p className="mt-1 font-medium">1 CP = ₦1</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
