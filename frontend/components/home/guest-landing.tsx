"use client"

import { useQuery } from "@tanstack/react-query"
import { RiArrowRightLine } from "@remixicon/react"

import { browserApi } from "@/lib/api/browser"
import { MachineRowItemSkeleton } from "@/components/common/page-skeleton"
import { CollectionPointRow } from "@/components/explore/collection-point-row"
import { MachineKiosk } from "@/components/home/machine-kiosk"
import { ButtonLink, LiveDot } from "@/components/ui"
import type { CollectionPoint } from "@/lib/api/types"
import { demoMachine, formatNaira, machineIsOpen } from "@/lib/utils"

const STEPS = [
    {
        title: "Get a code",
        body: "Open the app at the machine. Six digits show up for the keypad.",
    },
    {
        title: "Turn it in",
        body: "Type the code, put the plastic on the scale, press weigh.",
    },
    {
        title: "Get paid",
        body: "Green Points land in your wallet. One point is ₦1.",
    },
]

export function GuestLanding() {
    const points = useQuery({
        queryKey: ["explore-points"],
        queryFn: () =>
            browserApi<CollectionPoint[]>("/collection-points", {
                auth: false,
                fallback: "Failed to load collection points",
            }),
    })
    const all = points.data ?? []
    const machine = demoMachine(all)
    const listed = machine ? [machine] : []
    const openCount = listed.filter((point) => machineIsOpen(point.status)).length
    const plasticRate = firstPlasticRate(listed)

    return (
        <div className="space-y-14 pb-8">
            <section className="relative isolate overflow-hidden rounded-3xl border border-border/70 bg-grid">
                <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-br from-primary/18 via-transparent to-warning/10"
                />
                <div className="relative grid gap-10 px-6 py-14 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-14 lg:py-20">
                    <div className="flex max-w-xl flex-col gap-7">
                        {openCount > 0 ? (
                            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs">
                                <LiveDot />
                                <span className="font-medium">{openCount}</span>
                                <span className="text-muted-foreground">
                                    {openCount === 1 ? "machine open" : "machines open"}
                                </span>
                            </span>
                        ) : (
                            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
                                Plastic · paid on the spot
                            </p>
                        )}

                        <div className="space-y-4">
                            <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">
                                Turn in your plastic.
                                <br />
                                Get paid for it.
                            </h1>
                            <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
                                Walk up with a bag. Get a code, type it on the
                                keypad, put it on the scale. The machine weighs.
                                Points show up in your wallet.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <ButtonLink
                                href="/auth/sign-up"
                                size="lg"
                                variant="primary"
                            >
                                Create an account
                                <RiArrowRightLine />
                            </ButtonLink>
                            <ButtonLink href="/explore" size="lg" variant="ghost">
                                Find a machine
                            </ButtonLink>
                        </div>

                        <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border/60 pt-6">
                            <Figure label="Pay" value="1 GP = ₦1" />
                            <Figure
                                label="Plastic"
                                value={
                                    plasticRate != null
                                        ? `${formatNaira(plasticRate)}/kg`
                                        : "On the machine"
                                }
                            />
                            <Figure label="Who weighs" value="The machine" />
                        </dl>
                    </div>

                    <MachineKiosk />
                </div>
            </section>

            <section className="space-y-5">
                <div>
                    <h2 className="font-display text-2xl sm:text-3xl">
                        At the machine
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        You don&apos;t pick a site in the app first. You walk up.
                    </p>
                </div>
                <ol className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
                    {STEPS.map((step, index) => (
                        <li
                            key={step.title}
                            className="flex gap-4 px-4 py-5 sm:px-5"
                        >
                            <span className="tnum grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm text-primary">
                                {index + 1}
                            </span>
                            <div>
                                <p className="font-medium">{step.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.body}
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="font-display text-2xl sm:text-3xl">
                            The machine
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            One site is running. Walk up, get a code, turn it in.
                        </p>
                    </div>
                </div>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
                    {points.isPending && !points.data ? (
                        <MachineRowItemSkeleton />
                    ) : listed.length ? (
                        listed.map((point) => (
                            <CollectionPointRow
                                key={point.id}
                                point={point}
                            />
                        ))
                    ) : (
                        <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                            The machine isn&apos;t listed yet.
                        </li>
                    )}
                </ul>
            </section>

            <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-grid px-6 py-14 text-center sm:px-10">
                <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-t from-primary/14 via-transparent to-transparent"
                />
                <div className="relative mx-auto max-w-md space-y-5">
                    <h2 className="font-display text-3xl sm:text-4xl">
                        Got a bag of plastic?
                    </h2>
                    <p className="text-muted-foreground">
                        Make an account, walk up to a machine, get a code.
                    </p>
                    <ButtonLink href="/auth/sign-up" size="lg" variant="primary">
                        Create an account
                    </ButtonLink>
                </div>
            </section>
        </div>
    )
}

function firstPlasticRate(points: CollectionPoint[]): number | null {
    for (const point of points) {
        const plastic = point.materials.find(
            (material) =>
                material.slug === "plastic" ||
                material.name.toLowerCase() === "plastic"
        )
        if (plastic?.pricePerKgNaira != null) return plastic.pricePerKgNaira
    }
    return null
}

function Figure({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="mt-1 font-display text-xl">{value}</dd>
        </div>
    )
}
