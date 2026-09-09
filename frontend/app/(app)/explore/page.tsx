"use client"

import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { CollectionPoint } from "@/lib/api/types"
import { PageContainer } from "@/components/common/page-container"
import { MachineRowSkeleton } from "@/components/common/page-skeleton"
import { CollectionPointRow } from "@/components/explore/collection-point-row"
import { Button, EmptyState } from "@/components/ui"
import { demoMachine } from "@/lib/utils"

export default function ExplorePage() {
    const points = useQuery({
        queryKey: ["explore-points"],
        queryFn: () =>
            browserApi<CollectionPoint[]>("/collection-points", {
                auth: false,
                fallback: "Failed to load collection points",
            }),
        retry: 2,
    })

    const machine = demoMachine(points.data ?? [])

    return (
        <PageContainer>
            <header className="max-w-xl">
                <h1 className="font-display text-4xl">The machine</h1>
                <p className="mt-2 text-muted-foreground">
                    One site is open. You don&apos;t pick it in the app. Walk up
                    and get a code.
                </p>
            </header>

            <div className="mt-8">
                {points.isPending && !points.data ? (
                    <MachineRowSkeleton />
                ) : points.isError ? (
                    <EmptyState
                        title="Couldn't reach the machine"
                        description="The list comes from the site. Give it a moment, then try again. You don't register this one from here."
                        action={
                            <Button
                                variant="primary"
                                disabled={points.isFetching}
                                onClick={() => void points.refetch()}
                            >
                                {points.isFetching ? "Trying…" : "Try again"}
                            </Button>
                        }
                    />
                ) : machine ? (
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
                        <CollectionPointRow point={machine} />
                    </ul>
                ) : (
                    <EmptyState
                        title="Yaba isn't listed"
                        description="The walk-up machine should show up here on its own. You don't register it from this page."
                    />
                )}
            </div>
        </PageContainer>
    )
}
