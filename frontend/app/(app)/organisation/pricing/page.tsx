"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { browserApi } from "@/lib/api/browser"
import type { Material } from "@/lib/api/types"
import { Button, Card, CardContent, Input } from "@/components/ui"
import { formatNaira } from "@/lib/utils"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionUser } from "@/stores/session"

export default function PricingPage() {
    const user = useSessionUser()
    const { push } = useNotificationActions()
    const [drafts, setDrafts] = React.useState<Record<string, string>>({})

    const materials = useQuery({
        queryKey: ["org-materials", user?.id],
        enabled: Boolean(user),
        queryFn: () =>
            browserApi<Material[]>("/organisation/materials", {
                fallback: "Failed to load materials",
            }),
    })

    return (
        <div>
            <h1 className="text-4xl font-semibold tracking-tight">Materials & pricing</h1>
            <p className="mt-2 text-muted-foreground">
                New deposits use whatever you set here. Old deposits keep what
                they already earned.
            </p>
            <div className="mt-8 space-y-3">
                {materials.data?.map((material) => (
                    <Card key={material.id}>
                        <CardContent className="p-0">
                            <form
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                                onSubmit={async (event) => {
                                    event.preventDefault()
                                    const raw =
                                        drafts[material.id] ??
                                        String(material.pricePerKgNaira ?? "")
                                    const price = Number(raw)
                                    try {
                                        await browserApi(
                                            "/organisation/material-prices",
                                            {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    materialId: material.id,
                                                    pricePerKgNaira: price,
                                                }),
                                                fallback: "Failed to update price",
                                            }
                                        )
                                        push(
                                            `${material.name} is now ${formatNaira(price)} / kg`
                                        )
                                        void materials.refetch()
                                    } catch (error) {
                                        push(
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to update price",
                                            "danger"
                                        )
                                    }
                                }}
                            >
                                <div>
                                    <p className="font-medium">{material.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Now {formatNaira(material.pricePerKgNaira ?? 0)} / kg
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        className="w-28"
                                        value={drafts[material.id] ?? ""}
                                        placeholder="₦ / kg"
                                        onChange={(event) =>
                                            setDrafts((current) => ({
                                                ...current,
                                                [material.id]: event.target.value,
                                            }))
                                        }
                                    />
                                    <Button size="sm" type="submit" variant="primary">
                                        Save
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
