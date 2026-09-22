import type { Metadata } from "next"

import { AppHeader } from "@/components/common/app-header"
import { MachineKiosk } from "@/components/home/machine-kiosk"
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
                <div className="flex flex-col items-center gap-6">
                    <MachineKiosk />
                    <p className="max-w-xs text-center text-sm leading-6 text-muted-foreground">
                        The machine measures what you bring, and your phone
                        shows what it is worth. 1 CP = ₦1.
                    </p>
                </div>
            </section>
        </main>
    )
}
