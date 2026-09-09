"use client"

import * as React from "react"

import { authClient } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"

export function GoogleOAuthButton({ callbackURL = "/" }: { callbackURL?: string }) {
    const [pending, setPending] = React.useState(false)

    return (
        <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={async () => {
                setPending(true)
                await authClient.signIn.social({
                    provider: "google",
                    callbackURL,
                    newUserCallbackURL: callbackURL,
                })
            }}
        >
            Continue with Google
        </Button>
    )
}
