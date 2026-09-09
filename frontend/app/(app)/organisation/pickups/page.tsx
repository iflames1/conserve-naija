"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import {
    acceptPickupAction,
    completePickupAction,
    listOrgPickupsAction,
} from "@/actions/organisation"
import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ui"
import { formatKg } from "@/lib/utils"
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
    const pickups = useQuery({
        queryKey: ["org-pickups", user?.id],
        enabled: Boolean(user),
        queryFn: async () => {
            const result = await listOrgPickupsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Pickups</h1>
            <p className="mt-2 text-muted-foreground">
                When a site crosses its threshold, it shows up here. Accept, collect,
                done.
            </p>
            <div className="mt-8 space-y-3">
                {pickups.data?.length ? (
                    pickups.data.map((pickup) => (
                        <Card key={pickup.id}>
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                <div>
                                    <p className="font-medium">
                                        {pickup.collectionPointName} · {pickup.materialName}
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
                                            onClick={async () => {
                                                const result = await acceptPickupAction(pickup.id)
                                                if (!result.ok) push(result.error, "danger")
                                                else void pickups.refetch()
                                            }}
                                        >
                                            Accept
                                        </Button>
                                    ) : null}
                                    {pickup.status === "accepted" ? (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={async () => {
                                                const result = await completePickupAction(pickup.id)
                                                if (!result.ok) push(result.error, "danger")
                                                else void pickups.refetch()
                                            }}
                                        >
                                            Mark collected
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
