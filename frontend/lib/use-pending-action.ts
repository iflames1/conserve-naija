"use client"

import * as React from "react"

export function usePendingAction() {
    const [pending, setPending] = React.useState(false)
    const locked = React.useRef(false)

    const run = React.useCallback(async (action: () => Promise<void>) => {
        if (locked.current) return
        locked.current = true
        setPending(true)
        try {
            await action()
        } finally {
            locked.current = false
            setPending(false)
        }
    }, [])

    return { pending, run }
}

export function usePendingKey() {
    const [pendingKey, setPendingKey] = React.useState<string | null>(null)
    const locked = React.useRef(false)

    const run = React.useCallback(async (key: string, action: () => Promise<void>) => {
        if (locked.current) return
        locked.current = true
        setPendingKey(key)
        try {
            await action()
        } finally {
            locked.current = false
            setPendingKey(null)
        }
    }, [])

    return { pendingKey, run }
}
