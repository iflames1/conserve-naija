"use client"

import { create } from "zustand"

type Toast = {
    id: string
    title: string
    tone?: "default" | "danger"
}

type NotificationState = {
    toasts: Toast[]
    actions: {
        push: (title: string, tone?: Toast["tone"]) => void
        dismiss: (id: string) => void
    }
}

export const useNotificationStore = create<NotificationState>((set) => ({
    toasts: [],
    actions: {
        push: (title, tone = "default") => {
            const id = crypto.randomUUID()
            set((state) => ({
                toasts: [...state.toasts, { id, title, tone }],
            }))
            window.setTimeout(() => {
                useNotificationStore.getState().actions.dismiss(id)
            }, 4200)
        },
        dismiss: (id) =>
            set((state) => ({
                toasts: state.toasts.filter((toast) => toast.id !== id),
            })),
    },
}))

export const useToasts = () => useNotificationStore((s) => s.toasts)
export const useNotificationActions = () =>
    useNotificationStore((s) => s.actions)
