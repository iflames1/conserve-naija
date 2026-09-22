"use client"

import { useEffect } from "react"

import { LogoMark } from "@/components/common/brand"
import { Button } from "@/components/ui/button"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Surfaced in the browser console for debugging a failed render.
        console.error(error)
    }, [error])

    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
            <LogoMark className="size-12" />
            <h1 className="font-display text-3xl">Something went wrong</h1>
            <p className="max-w-sm text-muted-foreground">
                The page could not finish loading. Try again in a moment.
            </p>
            <Button size="lg" className="rounded-xl" onClick={reset}>
                Try again
            </Button>
        </main>
    )
}
