"use client"

import * as React from "react"

import { browserApi } from "@/lib/api/browser"
import type { AppUser } from "@/lib/api/types"
import { PageContainer } from "@/components/common/page-container"
import { Button, Input, Label } from "@/components/ui"
import { useNotificationActions } from "@/stores/notifications"
import { useSessionActions } from "@/stores/session"

const RECYCLE_LAGOS = "00000000-0000-7000-8000-000000000001"

export default function AdminPage() {
    const { push } = useNotificationActions()
    const { setUser } = useSessionActions()
    const [email, setEmail] = React.useState("")

    return (
        <PageContainer width="narrow">
            <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-2 text-muted-foreground">
                Add an email to Recycle Lagos. They can open the organisation
                desk after that.
            </p>
            <form
                className="mt-8 space-y-4"
                onSubmit={async (event) => {
                    event.preventDefault()
                    try {
                        await browserApi("/admin/members", {
                            method: "POST",
                            fallback: "Couldn't add that email",
                            body: JSON.stringify({
                                organisationId: RECYCLE_LAGOS,
                                email,
                            }),
                        })
                        push(`${email} can open the organisation desk now.`)
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
                }}
            >
                <div className="grid gap-2">
                    <Label htmlFor="email">Member email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </div>
                <Button type="submit" variant="primary">
                    Add to Recycle Lagos
                </Button>
            </form>
        </PageContainer>
    )
}
