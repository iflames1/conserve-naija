"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { CollectionPoint, Device } from "@/lib/api/types"
import { Badge, ButtonLink, Card, CardContent, Progress } from "@/components/ui"
import { formatKg, siteLabel } from "@/lib/utils"
import { useSessionUser } from "@/stores/session"

export default function OrgSiteDetailPage() {
    const params = useParams<{ id: string }>()
    const user = useSessionUser()
    const id = params.id

    const points = useQuery({
        queryKey: ["org-points", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<CollectionPoint[]>("/organisation/collection-points", {
                fallback: "Failed to load sites",
            }),
    })
    const devices = useQuery({
        queryKey: ["org-devices", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<Device[]>("/organisation/devices", {
                fallback: "Failed to load machines",
            }),
    })

    const site = points.data?.find((point) => point.id === id)
    const machines =
        devices.data?.filter((device) => device.collectionPointId === id) ?? []

    if (!site && !points.isPending) {
        return (
            <div>
                <h1 className="text-4xl font-semibold tracking-tight">Site</h1>
                <p className="mt-2 text-muted-foreground">This site isn&apos;t on your list.</p>
                <ButtonLink href="/organisation/points" variant="ghost" className="mt-4">
                    Back to sites
                </ButtonLink>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <header>
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    Conserve Site
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">
                    {site ? siteLabel(site) || site.name : "Site"}
                </h1>
                <p className="mt-2 text-muted-foreground">{site?.address}</p>
            </header>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Inventory</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(site?.inventory ?? []).map((row) => {
                        const percent = Math.min(
                            100,
                            Math.round((row.weightKg / row.pickupThresholdKg) * 100)
                        )
                        return (
                            <Card key={row.materialId}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-medium">{row.materialName}</h3>
                                        {row.readyForPickup ? (
                                            <Badge variant="outline">Pickup</Badge>
                                        ) : null}
                                    </div>
                                    <Progress className="mt-3" value={percent} />
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {formatKg(row.weightKg)} · {percent}% of threshold
                                    </p>
                                </CardContent>
                            </Card>
                        )
                    })}
                    {site && !site.inventory.length ? (
                        <p className="text-sm text-muted-foreground">Empty bins.</p>
                    ) : null}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Machines</h2>
                <div className="mt-4 space-y-2">
                    {machines.map((device) => (
                        <Card key={device.id}>
                            <CardContent className="flex items-center justify-between p-5">
                                <div>
                                    <p className="font-medium">{device.externalId}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {device.status} · {device.health}
                                    </p>
                                </div>
                                <Badge
                                    variant={
                                        device.health === "online" ? "success" : "outline"
                                    }
                                >
                                    {device.health}
                                </Badge>
                            </CardContent>
                        </Card>
                    ))}
                    {!machines.length && !devices.isPending ? (
                        <p className="text-sm text-muted-foreground">
                            No machine attached yet.{" "}
                            <Link href="/organisation/devices" className="underline">
                                Register one
                            </Link>
                            .
                        </p>
                    ) : null}
                </div>
            </section>
        </div>
    )
}
