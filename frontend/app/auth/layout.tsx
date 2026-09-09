import type { ReactNode } from "react"

import { Brand } from "@/components/shell/brand"
import { ButtonLink } from "@/components/ui"

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex flex-col">
                <div className="flex items-center justify-between px-4 py-6 sm:px-8">
                    <Brand />
                    <ButtonLink href="/" variant="ghost" size="sm">
                        Home
                    </ButtonLink>
                </div>
                <div className="flex flex-1 items-center justify-center px-4 pb-16">
                    <div className="w-full max-w-sm">{children}</div>
                </div>
            </div>
            <aside className="relative hidden overflow-hidden border-l border-border/60 bg-grid lg:block">
                <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-br from-primary/16 via-transparent to-transparent"
                />
                <div className="relative flex h-full flex-col justify-end gap-4 p-12">
                    <p className="font-display text-4xl leading-tight">
                        Turn in your plastic.
                        <br />
                        Get paid for it.
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        One point is ₦1. Type a code on the keypad. The machine
                        weighs what you drop.
                    </p>
                </div>
            </aside>
        </div>
    )
}
