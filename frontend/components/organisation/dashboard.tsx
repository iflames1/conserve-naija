"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type {
    AppUser,
    CollectionPoint,
    Deposit,
    Device,
    OrganisationOverview,
    Pickup,
} from "@/lib/api/types"
import {
    Badge,
    Button,
    ButtonLink,
    Card,
    CardContent,
    EmptyState,
    Input,
    Progress,
    Stat,
} from "@/components/ui"
import { OrgDashboardSkeleton } from "@/components/common/page-skeleton"
import { cpAmount, formatKg, formatPoints, formatRelativeTime, siteLabel } from "@/lib/utils"
import { usePendingAction, usePendingKey } from "@/lib/use-pending-action"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionActions, useSessionLoading, useSessionUser } from "@/stores/session"

function isOrgForbidden(error: unknown) {
    const message = error instanceof Error ? error.message : ""
    return (
        message.includes("forbidden") ||
        message.includes("join an organisation") ||
        message.includes("not a member")
    )
}

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
    const { setUser } = useSessionActions()
    const addMember = usePendingAction()
    const pickupAction = usePendingKey()
    const [inviteEmail, setInviteEmail] = React.useState("")

    const enabled = Boolean(user)
    const overview = useQuery({
        queryKey: ["org-overview", user?.id],
        enabled,
        queryFn: () =>
            browserApi<OrganisationOverview>("/organisation", {
                fallback: "Failed to load organisation",
            }),
    })
    const points = useQuery({
        queryKey: ["org-points", user?.id],
        enabled,
        queryFn: () =>
            browserApi<CollectionPoint[]>("/organisation/collection-points", {
                fallback: "Failed to load organisation points",
            }),
    })
    const devices = useQuery({
        queryKey: ["org-devices", user?.id],
        enabled,
        queryFn: () =>
            browserApi<Device[]>("/organisation/devices", {
                fallback: "Failed to load devices",
            }),
    })
    const pickups = useQuery({
        queryKey: ["org-pickups", user?.id],
        enabled,
        queryFn: () =>
            browserApi<Pickup[]>("/organisation/pickups", {
                fallback: "Failed to load pickups",
            }),
    })
    const deposits = useQuery({
        queryKey: ["org-deposits", user?.id],
        enabled,
        queryFn: () =>
            browserApi<Deposit[]>("/organisation/deposits", {
                fallback: "Failed to load organisation activity",
            }),
    })

    if (!user) {
        if (loading) return <OrgDashboardSkeleton />
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
    if (overview.isError && isOrgForbidden(overview.error)) {
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
    if (overview.isError) {
        return (
            <EmptyState
                title="Couldn't reach the desk"
                description="The organisation pages talk to the site. Give it a moment, then try again."
                action={
                    <Button
                        variant="primary"
                        disabled={overview.isFetching}
                        onClick={() => void overview.refetch()}
                    >
                        {overview.isFetching ? "Trying…" : "Try again"}
                    </Button>
                }
            />
        )
    }
    if (!user.organisations?.length && !overview.isPending && !overview.data) {
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

    if (overview.isPending && !overview.data) {
        return <OrgDashboardSkeleton />
    }

    const stats = overview.data
    const activePickups = (pickups.data ?? []).filter(
        (pickup) => pickup.status === "ready" || pickup.status === "accepted"
    )
    const offline = (devices.data ?? []).filter((device) => device.health !== "online").length

    return (
        <div className="space-y-10">
            <div>
                <p className="text-sm text-primary">
                    {user.organisations[0]?.name ?? "Recycle Lagos"}
                </p>
                <h1 className="font-display text-4xl">Network</h1>
            </div>

            <section className="rounded-2xl border border-border/70 p-5 surface-raised">
                <h2 className="text-2xl font-semibold tracking-tight">Teammates</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Put their email in. Recycle Lagos will be waiting.
                </p>
                <form
                    className="mt-4 flex flex-wrap gap-2"
                    onSubmit={(event) => {
                        event.preventDefault()
                        const submitted = inviteEmail.trim()
                        void addMember.run(async () => {
                            try {
                                const result = await browserApi<{
                                    ok: boolean
                                    pending?: boolean
                                }>("/organisation/members", {
                                    method: "POST",
                                    fallback: "Couldn't add that email",
                                    body: JSON.stringify({ email: submitted }),
                                })
                                push(
                                    result.pending
                                        ? "Recycle Lagos will be there when they sign in."
                                        : `${submitted} can open the desk now.`
                                )
                                setInviteEmail("")
                                const me = await browserApi<AppUser>("/me", {
                                    fallback: "Failed to load profile",
                                })
                                setUser(me)
                            } catch (error) {
                                push(
                                    error instanceof Error
                                        ? error.message
                                        : "Couldn't add that email",
                                    "danger"
                                )
                            }
                        })
                    }}
                >
                    <Input
                        type="email"
                        value={inviteEmail}
                        disabled={addMember.pending}
                        placeholder="teammate@email.com"
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className="max-w-sm"
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={addMember.pending || !inviteEmail.trim()}
                    >
                        {addMember.pending ? "Adding…" : "Add them"}
                    </Button>
                </form>
            </section>

            <section className="grid grid-cols-2 gap-5 rounded-2xl border border-border/70 p-5 surface-raised lg:grid-cols-4">
                <Stat
                    label="Machines"
                    value={`${stats?.devicesOnline ?? 0}/${stats?.devicesTotal ?? 0}`}
                    hint={offline ? `${offline} offline` : "All reachable"}
                    tone={offline ? "warning" : "success"}
                />
                <Stat label="Sites" value={stats?.sites ?? stats?.collectionPoints ?? "—"} />
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
                                    {siteLabel(device) || "Unassigned"}
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
                <h2 className="text-2xl font-semibold tracking-tight">Site inventory</h2>
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
                                            {siteLabel(point) || point.name}
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
                                    {siteLabel(deposit)} · +{formatPoints(cpAmount(deposit))} CP
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(deposit.confirmedAt ?? deposit.createdAt)}
                            </p>
                        </div>
                    ))}
                    {!deposits.data?.length && !deposits.isPending ? (
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
                                            {siteLabel(pickup)} · {pickup.materialName}
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
                                                disabled={
                                                    pickupAction.pendingKey === pickup.id
                                                }
                                                onClick={() => {
                                                    void pickupAction.run(
                                                        pickup.id,
                                                        async () => {
                                                            try {
                                                                await browserApi(
                                                                    `/pickups/${pickup.id}/accept`,
                                                                    {
                                                                        method: "POST",
                                                                        body: JSON.stringify(
                                                                            {}
                                                                        ),
                                                                        fallback:
                                                                            "Failed to accept pickup",
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
                                                        }
                                                    )
                                                }}
                                            >
                                                {pickupAction.pendingKey === pickup.id
                                                    ? "Accepting…"
                                                    : "Accept"}
                                            </Button>
                                        ) : null}
                                        {pickup.status === "accepted" ? (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                disabled={
                                                    pickupAction.pendingKey === pickup.id
                                                }
                                                onClick={() => {
                                                    void pickupAction.run(
                                                        pickup.id,
                                                        async () => {
                                                            try {
                                                                await browserApi(
                                                                    `/pickups/${pickup.id}/complete`,
                                                                    {
                                                                        method: "POST",
                                                                        body: JSON.stringify(
                                                                            {}
                                                                        ),
                                                                        fallback:
                                                                            "Failed to complete pickup",
                                                                    }
                                                                )
                                                                void pickups.refetch()
                                                                void overview.refetch()
                                                                void points.refetch()
                                                            } catch (error) {
                                                                push(
                                                                    error instanceof Error
                                                                        ? error.message
                                                                        : "Failed to complete pickup",
                                                                    "danger"
                                                                )
                                                            }
                                                        }
                                                    )
                                                }}
                                            >
                                                {pickupAction.pendingKey === pickup.id
                                                    ? "Saving…"
                                                    : "Mark collected"}
                                            </Button>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Nothing waiting. Check back when a site fills.
                        </p>
                    )}
                </div>
            </section>
        </div>
    )
}
