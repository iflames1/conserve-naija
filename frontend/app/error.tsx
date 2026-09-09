"use client"

import { Button, ButtonLink } from "@/components/ui"

export default function ErrorPage({
    reset,
}: {
    error: Error
    reset: () => void
}) {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">That page broke</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
                Try again, or go home.
            </p>
            <div className="flex gap-3">
                <Button onClick={reset} variant="primary">
                    Try again
                </Button>
                <ButtonLink href="/">Home</ButtonLink>
            </div>
        </div>
    )
}
