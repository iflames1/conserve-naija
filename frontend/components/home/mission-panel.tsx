"use client"

import { Clock3, Copy, MapPin, Smartphone } from "lucide-react"
import { useMission } from "@/stores/session"

export function MissionPanel() {
    const mission = useMission()
    const otp = mission?.otp ?? "------"

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col px-5 pt-6 pb-10 sm:px-8">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-display text-foreground">
                    Conserve Naija
                </span>
                <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-live" /> Waiting for
                    machine
                </span>
            </div>
            <section className="mt-16 space-y-8">
                <div>
                    <p className="mb-3 text-sm font-medium tracking-[0.18em] text-primary uppercase">
                        Recycling mission
                    </p>
                    <h1 className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
                        Your Conserve OTP is ready.
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
                        Enter this code on the machine at your Conserve Site.
                        Your phone will update as the mission moves forward.
                    </p>
                </div>
                <div className="rounded-2xl border border-border-strong p-6 surface-raised sm:p-8">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                            <Smartphone className="size-4" /> Conserve OTP
                        </span>
                        <Copy className="size-4" />
                    </div>
                    <p className="tnum mt-5 font-mono text-5xl font-semibold tracking-[0.22em] text-primary sm:text-6xl">
                        {otp}
                    </p>
                    <div className="mt-7 grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-2">
                        <span className="flex items-center gap-2">
                            <Clock3 className="size-4" /> Expires in about 2
                            minutes
                        </span>
                        <span className="flex items-center gap-2">
                            <MapPin className="size-4" /> Use any active machine
                        </span>
                    </div>
                </div>
            </section>
        </main>
    )
}
