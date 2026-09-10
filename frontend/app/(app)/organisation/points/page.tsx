"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { CollectionPoint } from "@/lib/api/types"
import {
    Button,
    Card,
    CardContent,
    Input,
    Label,
    Progress,
} from "@/components/ui"
import { OrgFillCardSkeleton } from "@/components/common/page-skeleton"
import { formatKg } from "@/lib/utils"
import { usePendingAction } from "@/lib/use-pending-action"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionUser } from "@/stores/session"

export default function OrgPointsPage() {
    const user = useSessionUser()
    const { push } = useNotificationActions()
    const [name, setName] = React.useState("")
    const [address, setAddress] = React.useState("")
    const addSite = usePendingAction()

    const points = useQuery({
        queryKey: ["org-points", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<CollectionPoint[]>("/organisation/collection-points", {
                fallback: "Failed to load organisation points",
            }),
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Sites</h1>
            <p className="mt-2 text-muted-foreground">
                A Conserve Site hosts one or more machines. People walk up.
                They don&apos;t pick this in the app first.
            </p>
            <Card className="mt-8">
                <CardContent className="p-5">
                    <form
                        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void addSite.run(async () => {
                                try {
                                    await browserApi("/organisation/collection-points", {
                                        method: "POST",
                                        body: JSON.stringify({ name, address }),
                                        fallback: "Failed to create site",
                                    })
                                    setName("")
                                    setAddress("")
                                    void points.refetch()
                                } catch (error) {
                                    push(
                                        error instanceof Error
                                            ? error.message
                                            : "Failed to create site",
                                        "danger"
                                    )
                                }
                            })
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Surulere"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={address}
                                onChange={(event) => setAddress(event.target.value)}
                            />
                        </div>
                        <Button
                            className="self-end"
                            type="submit"
                            variant="primary"
                            disabled={addSite.pending || !name.trim() || !address.trim()}
                        >
                            {addSite.pending ? "Adding…" : "Add site"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
                {points.isPending && !points.data ? <OrgFillCardSkeleton /> : null}
                {points.data?.map((point) => {
                    const fill = point.inventory[0]
                    const percent = fill
                        ? Math.min(
                              100,
                              Math.round((fill.weightKg / fill.pickupThresholdKg) * 100)
                          )
                        : 0
                    return (
                        <Card key={point.id}>
                            <CardContent className="p-5">
                                <h2 className="text-xl font-semibold tracking-tight">
                                    <Link
                                        href={`/organisation/points/${point.id}`}
                                        className="hover:underline"
                                    >
                                        {point.name}
                                    </Link>
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">{point.address}</p>
                                <Progress className="mt-4" value={percent} />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {fill ? formatKg(fill.weightKg) : "Empty"} · {percent}% of pickup
                                    threshold
                                </p>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
