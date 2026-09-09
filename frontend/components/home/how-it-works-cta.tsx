"use client"

import { ButtonLink } from "@/components/ui"
import { useSessionLoading, useSessionUser } from "@/stores/session"

export function HowItWorksCta() {
    const user = useSessionUser()
    const loading = useSessionLoading()

    if (loading || !user) {
        return (
            <div className="flex flex-wrap items-center gap-3">
                <ButtonLink href="/auth/sign-up" variant="primary">
                    Create an account
                </ButtonLink>
                <ButtonLink href="/explore" variant="ghost">
                    Find a machine
                </ButtonLink>
            </div>
        )
    }

    return (
        <ButtonLink href="/" variant="primary">
            Get a code
        </ButtonLink>
    )
}
