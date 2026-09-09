"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import {
    acceptPickupAction,
    completePickupAction,
    getOrganisationOverviewAction,
    listOrgCollectionPointsAction,
    listOrgDepositsAction,
    listOrgDevicesAction,
    listOrgPickupsAction,
} from "@/actions/organisation"
import {
    Badge,
    Button,
    ButtonLink,
    Card,
    CardContent,
    EmptyState,
    Progress,
    Stat,
} from "@/components/ui"
import { OrgDashboardSkeleton } from "@/components/common/page-skeleton"
import { formatKg, formatPoints, formatRelativeTime } from "@/lib/utils"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionLoading, useSessionUser } from "@/stores/session"

function pickupBadge(status: string) {
    if (status === "ready") return "warning" as const
    if (status === "accepted") return "primary" as const
    if (status === "completed") return "success" as const
    return "outline" as const
}

function healthBadge(health?: string) {
    if (health === "online") return "success" as const
    if (health === "offline") return "destructive" as const
    return "outline" as const
}

function fillPercent(weightKg: number, thresholdKg: number) {
    if (!thresholdKg) return 0
    return Math.min(100, Math.round((weightKg / thresholdKg) * 100))
}

export function OrganisationDashboard() {
    const user = useSessionUser()
    const loading = useSessionLoading()
    const { push } = useNotificationActions()
    const [ready, setReady] = React.useState(false)

    React.useEffect(() => {
        setReady(true)
    }, [])

    const enabled = Boolean(user?.organisations.length)
    const overview = useQuery({
        queryKey: ["org-overview", user?.id],
        enabled,
        queryFn: async () => {
            const result = await getOrganisationOverviewAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })
    const points = useQuery({
        queryKey: ["org-points", user?.id],
        enabled,
        queryFn: async () => {
            const result = await listOrgCollectionPointsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })
    const devices = useQuery({
        queryKey: ["org-devices", user?.id],
        enabled,
        queryFn: async () => {
            const result = await listOrgDevicesAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })
    const pickups = useQuery({
        queryKey: ["org-pickups", user?.id],
        enabled,
        queryFn: async () => {
            const result = await listOrgPickupsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })
    const deposits = useQuery({
        queryKey: ["org-deposits", user?.id],
        enabled,
        queryFn: async () => {
            const result = await listOrgDepositsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })

    if (!ready || loading) return <OrgDashboardSkeleton />
    if (!user) {
        return (
            <EmptyState
                title="Sign in first"
                action={
                    <ButtonLink href="/auth/login" variant="primary">
                        Sign in
                    </ButtonLink>
                }
            />
        )
    }
    if (!user.organisations.length) {
        return (
            <EmptyState
                title="This desk is for recycling organisations"
                description="If you operate Conserve machines, ask an admin to add your email. Otherwise get a code from Home."
                action={
                    <ButtonLink href="/" variant="primary">
                        Go home
                    </ButtonLink>
                }
            />
        )
    }

    const stats = overview.data
    const activePickups = (pickups.data ?? []).filter(
        (pickup) => pickup.status === "ready" || pickup.status === "accepted"
    )
    const offline = (devices.data ?? []).filter((device) => device.health !== "online").length

    return (
        <div className="space-y-10">
            <div>
                <p className="text-sm text-primary">{user.organisations[0]?.name}</p>
                <h1 className="font-display text-4xl">Network</h1>
            </div>

            <section className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 p-5 surface-raised lg:grid-cols-4">
                <Stat
                    label="Machines"
                    value={`${stats?.devicesOnline ?? 0}/${stats?.devicesTotal ?? 0}`}
                    hint={offline ? `${offline} offline` : "All reachable"}
                    tone={offline ? "warning" : "success"}
                />
                <Stat label="Sites" value={stats?.collectionPoints ?? "—"} />
                <Stat
                    label="Collected"
                    value={formatKg(stats?.materialCollectedKg ?? 0)}
                />
                <Stat
                    label="Ready for pickup"
                    value={stats?.readyForPickup ?? 0}
                    tone={stats?.readyForPickup ? "warning" : "default"}
                />
            </section>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Machine health</h2>
                <div className="mt-4 space-y-2">
                    {(devices.data ?? []).map((device) => (
                        <div
                            key={device.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                        >
                            <div>
                                <p className="font-medium">{device.externalId}</p>
                                <p className="text-xs text-muted-foreground">
                                    {device.collectionPointName ?? "Unassigned"}
                                    {device.lastSeenAt
                                        ? ` · last seen ${formatRelativeTime(device.lastSeenAt)}`
                                        : " · never seen"}
                                </p>
                            </div>
                            <Badge variant={healthBadge(device.health)}>{device.health}</Badge>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Collection status</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {points.data?.map((point) => {
                        const fill = point.inventory[0]
                        const percent = fill
                            ? fillPercent(fill.weightKg, fill.pickupThresholdKg)
                            : 0
                        return (
                            <Card key={point.id}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-xl font-semibold tracking-tight">
                                            {point.name.replace(" Collection Point", "")}
                                        </h3>
                                        <span className="text-sm text-muted-foreground">
                                            {percent}% full
                                        </span>
                                    </div>
                                    <Progress
                                        className="mt-3"
                                        value={percent}
                                        tone={percent >= 90 ? "warning" : "primary"}
                                    />
                                    {fill?.readyForPickup ? (
                                        <p className="mt-3 text-sm text-warning">Pickup required</p>
                                    ) : (
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            {fill ? formatKg(fill.weightKg) : "Empty"}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Recent activity</h2>
                <div className="mt-4 space-y-2">
                    {(deposits.data ?? []).slice(0, 6).map((deposit) => (
                        <div
                            key={deposit.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3"
                        >
                            <div>
                                <p className="font-medium">
                                    +{formatKg(deposit.weightKg)} {deposit.materialName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {deposit.collectionPointName} · +{formatPoints(deposit.greenPoints)} GP
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(deposit.confirmedAt ?? deposit.createdAt)}
                            </p>
                        </div>
                    ))}
                    {!deposits.data?.length ? (
                        <p className="text-sm text-muted-foreground">
                            Drops show up here after a machine weighs them.
                        </p>
                    ) : null}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-semibold tracking-tight">Pickups</h2>
                <div className="mt-4 space-y-3">
                    {activePickups.length ? (
                        activePickups.map((pickup) => (
                            <Card key={pickup.id}>
                                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                    <div>
                                        <p className="font-medium">
                                            {pickup.collectionPointName} · {pickup.materialName}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {formatKg(pickup.inventoryKgAtReady)} waiting
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
                                                    const result = await completePickupAction(
                                                        pickup.id
                                                    )
                                                    if (!result.ok) push(result.error, "danger")
                                                    else {
                                                        void pickups.refetch()
                                                        void overview.refetch()
                                                        void points.refetch()
                                                    }
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
                        <p className="text-sm text-muted-foreground">
                            Nothing waiting. Check back when a point fills.
                        </p>
                    )}
                </div>
            </section>
        </div>
    )
}
