import Link from "next/link"

import { Brand } from "@/components/common/brand"

const navigation = [
    ["Overview", "/organisation"],
    ["Conserve Sites", "/organisation/sites"],
    ["Inventory", "/organisation/inventory"],
    ["Pickups", "/organisation/pickups"],
    ["Members", "/organisation/members"],
]

export function OpsShell({ children }: { children: React.ReactNode }) {
    return (
        <main className="mx-auto min-h-svh w-full max-w-7xl px-5 pt-6 pb-12 sm:px-8 lg:px-12">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                    <Brand />
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Organisation operations
                    </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1.5 text-xs text-primary">
                    Operations
                </span>
            </header>
            <nav className="flex gap-5 overflow-x-auto border-b border-border py-4 text-sm text-muted-foreground">
                {navigation.map(([label, href]) => (
                    <Link
                        key={href}
                        href={href}
                        className="whitespace-nowrap hover:text-foreground"
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {children}
        </main>
    )
}
