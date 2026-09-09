"use client"

import { useNotificationActions, useToasts } from "@/stores/notifications"

export function ToastHost() {
    const toasts = useToasts()
    const { dismiss } = useNotificationActions()

    if (toasts.length === 0) return null

    return (
        <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
            {toasts.map((toast) => (
                <button
                    key={toast.id}
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm shadow-lg ${
                        toast.tone === "danger"
                            ? "border-destructive/30 bg-destructive/15 text-destructive"
                            : "border-border bg-card text-foreground"
                    }`}
                >
                    {toast.title}
                </button>
            ))}
        </div>
    )
}
