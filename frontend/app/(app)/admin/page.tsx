"use client"

import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import type { AppUser } from "@/lib/api/types"
import { PageContainer } from "@/components/common/page-container"
import { Button, Input, Label } from "@/components/ui"
import { usePendingAction } from "@/lib/use-pending-action"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionActions } from "@/stores/session"

const RECYCLE_LAGOS = "00000000-0000-7000-8000-000000000001"

export default function AdminPage() {
    const { push } = useNotificationActions()
    const { setUser } = useSessionActions()
    const { pending, run } = usePendingAction()
    const [email, setEmail] = React.useState("")

    return (
        <PageContainer width="narrow">
            <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-2 text-muted-foreground">
                Put their email in. Recycle Lagos will be waiting.
            </p>
            <form
                className="mt-8 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault()
                    const submitted = email.trim()
                    void run(async () => {
                        try {
                            const result = await browserApi<{
                                ok: boolean
                                pending?: boolean
                            }>("/admin/members", {
                                method: "POST",
                                fallback: "Couldn't add that email",
                                body: JSON.stringify({
                                    organisationId: RECYCLE_LAGOS,
                                    email: submitted,
                                }),
                            })
                            push(
                                result.pending
                                    ? "Recycle Lagos will be there when they sign in."
                                    : `${submitted} can open the organisation desk now.`
                            )
                            setEmail("")
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
                <div className="grid gap-2">
                    <Label htmlFor="email">Member email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled={pending}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </div>
                <Button type="submit" variant="primary" disabled={pending || !email.trim()}>
                    {pending ? "Adding…" : "Add to Recycle Lagos"}
                </Button>
            </form>
        </PageContainer>
    )
}
