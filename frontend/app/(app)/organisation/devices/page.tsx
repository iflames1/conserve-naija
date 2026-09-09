"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import {
    associateDeviceAction,
    deactivateDeviceAction,
    listOrgCollectionPointsAction,
    listOrgDevicesAction,
    registerDeviceAction,
} from "@/actions/organisation"
import {
    Badge,
    Button,
    ButtonLink,
    Card,
    CardContent,
    EmptyState,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui"
import { OrgFormPageSkeleton } from "@/components/common/page-skeleton"
import { formatRelativeTime } from "@/lib/utils"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionUser } from "@/stores/session"

export default function MachinesPage() {
    const user = useSessionUser()
    const { push } = useNotificationActions()
    const [externalId, setExternalId] = React.useState("")
    const [collectionPointId, setCollectionPointId] = React.useState("")
    const [apiKey, setApiKey] = React.useState<string | null>(null)
    const [pointIds, setPointIds] = React.useState<Record<string, string>>({})

    const devices = useQuery({
        queryKey: ["org-devices", user?.id],
        enabled: Boolean(user),
        queryFn: async () => {
            const result = await listOrgDevicesAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })
    const points = useQuery({
        queryKey: ["org-points", user?.id],
        enabled: Boolean(user),
        queryFn: async () => {
            const result = await listOrgCollectionPointsAction()
            if (!result.ok) throw new Error(result.error)
            return result.data
        },
    })

    const [ready, setReady] = React.useState(false)
    React.useEffect(() => {
        setReady(true)
    }, [])

    if (!ready) return <OrgFormPageSkeleton titleWidth="w-36" />
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

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Machines</h1>
            <p className="mt-2 text-muted-foreground">
                Register a Conserve machine, attach it to a collection point, then
                put that identity in Wokwi. We show the API key once.
            </p>
            <Card className="mt-8">
                <CardContent className="p-5">
                    <form
                        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                        onSubmit={async (event) => {
                            event.preventDefault()
                            const result = await registerDeviceAction({
                                externalId,
                                collectionPointId: collectionPointId || undefined,
                            })
                            if (!result.ok) {
                                push(result.error, "danger")
                                return
                            }
                            setApiKey(result.data.apiKey)
                            setExternalId("")
                            void devices.refetch()
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="externalId">Machine ID</Label>
                            <Input
                                id="externalId"
                                value={externalId}
                                onChange={(event) => setExternalId(event.target.value)}
                                placeholder="CN-MACHINE-002"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Collection point</Label>
                            <Select
                                value={collectionPointId || null}
                                onValueChange={(value) =>
                                    setCollectionPointId(value ? String(value) : "")
                                }
                                items={
                                    points.data?.map((point) => ({
                                        value: point.id,
                                        label: point.name,
                                    })) ?? []
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign now (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {points.data?.map((point) => (
                                        <SelectItem key={point.id} value={point.id}>
                                            {point.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="self-end" type="submit" variant="primary">
                            Register machine
                        </Button>
                    </form>
                </CardContent>
            </Card>
            {apiKey ? (
                <p className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                    Copy this key now: <code className="break-all">{apiKey}</code>
                </p>
            ) : null}
            <div className="mt-8 space-y-3">
                {devices.data?.map((device) => (
                    <Card key={device.id}>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                            <div>
                                <p className="font-medium">{device.externalId}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {device.collectionPointName ?? "not attached"}
                                    {device.lastSeenAt
                                        ? ` · last seen ${formatRelativeTime(device.lastSeenAt)}`
                                        : " · never seen"}
                                    {device.latitude != null
                                        ? ` · ${device.latitude.toFixed(3)}, ${device.longitude?.toFixed(3)}`
                                        : ""}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant={
                                        device.health === "online" ? "success" : "destructive"
                                    }
                                >
                                    {device.health}
                                </Badge>
                                {device.status === "disabled" ? (
                                    <Badge variant="outline">disabled</Badge>
                                ) : null}
                                <form
                                    className="flex gap-2"
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        const selectedPointId = pointIds[device.id]
                                        if (!selectedPointId) return
                                        const result = await associateDeviceAction({
                                            deviceId: device.id,
                                            collectionPointId: selectedPointId,
                                        })
                                        if (!result.ok) push(result.error, "danger")
                                        else void devices.refetch()
                                    }}
                                >
                                    <Select
                                        value={pointIds[device.id] || null}
                                        onValueChange={(value) =>
                                            setPointIds((current) => ({
                                                ...current,
                                                [device.id]: value ? String(value) : "",
                                            }))
                                        }
                                        items={
                                            points.data?.map((point) => ({
                                                value: point.id,
                                                label: point.name,
                                            })) ?? []
                                        }
                                    >
                                        <SelectTrigger className="w-52">
                                            <SelectValue placeholder="Reassign" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {points.data?.map((point) => (
                                                <SelectItem key={point.id} value={point.id}>
                                                    {point.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button size="sm" type="submit">
                                        Attach
                                    </Button>
                                </form>
                                {device.status === "active" ? (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => {
                                            const result = await deactivateDeviceAction(device.id)
                                            if (!result.ok) push(result.error, "danger")
                                            else void devices.refetch()
                                        }}
                                    >
                                        Deactivate
                                    </Button>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
