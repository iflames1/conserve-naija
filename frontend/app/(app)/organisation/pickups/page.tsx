"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { Pickup } from "@/lib/api/types"
import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ui"
import { formatKg, siteLabel } from "@/lib/utils"
import { usePendingKey } from "@/lib/use-pending-action"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionUser } from "@/stores/session"

function pickupBadge(status: string) {
    if (status === "ready") return "warning" as const
    if (status === "accepted") return "primary" as const
    if (status === "completed") return "success" as const
    return "outline" as const
}

export default function OrgPickupsPage() {
    const user = useSessionUser()
    const { push } = useNotificationActions()
    const action = usePendingKey()
    const pickups = useQuery({
        queryKey: ["org-pickups", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<Pickup[]>("/organisation/pickups", {
                fallback: "Failed to load pickups",
            }),
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Pickups</h1>
            <p className="mt-2 text-muted-foreground">
                When a site crosses its threshold, it shows up here. Accept, collect,
                done.
            </p>
            <div className="mt-8 space-y-3">
                {pickups.isPending && !pickups.data ? null : pickups.data?.length ? (
                    pickups.data.map((pickup) => (
                        <Card key={pickup.id}>
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                <div>
                                    <p className="font-medium">
                                        {siteLabel(pickup) || pickup.collectionPointName} · {pickup.materialName}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatKg(pickup.inventoryKgAtReady)} at ready
                                        {pickup.collectedKg != null
                                            ? ` · collected ${formatKg(pickup.collectedKg)}`
                                            : ""}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={pickupBadge(pickup.status)}>
                                        {pickup.status}
                                    </Badge>
                                    {pickup.status === "ready" ? (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            disabled={action.pendingKey === pickup.id}
                                            onClick={() => {
                                                void action.run(pickup.id, async () => {
                                                    try {
                                                        await browserApi(
                                                            `/pickups/${pickup.id}/accept`,
                                                            {
                                                                method: "POST",
                                                                body: JSON.stringify({}),
                                                                fallback: "Failed to accept pickup",
                                                            }
                                                        )
                                                        void pickups.refetch()
                                                    } catch (error) {
                                                        push(
                                                            error instanceof Error
                                                                ? error.message
                                                                : "Failed to accept pickup",
                                                            "danger"
                                                        )
                                                    }
                                                })
                                            }}
                                        >
                                            {action.pendingKey === pickup.id
                                                ? "Accepting…"
                                                : "Accept"}
                                        </Button>
                                    ) : null}
                                    {pickup.status === "accepted" ? (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            disabled={action.pendingKey === pickup.id}
                                            onClick={() => {
                                                void action.run(pickup.id, async () => {
                                                    try {
                                                        await browserApi(
                                                            `/pickups/${pickup.id}/complete`,
                                                            {
                                                                method: "POST",
                                                                body: JSON.stringify({}),
                                                                fallback:
                                                                    "Failed to complete pickup",
                                                            }
                                                        )
                                                        void pickups.refetch()
                                                    } catch (error) {
                                                        push(
                                                            error instanceof Error
                                                                ? error.message
                                                                : "Failed to complete pickup",
                                                            "danger"
                                                        )
                                                    }
                                                })
                                            }}
                                        >
                                            {action.pendingKey === pickup.id
                                                ? "Saving…"
                                                : "Mark collected"}
                                        </Button>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <EmptyState title="No pickups yet" />
                )}
            </div>
        </div>
    )
}
