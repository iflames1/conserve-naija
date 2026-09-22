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
        <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 pt-6 pb-12 sm:px-8 lg:px-12">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                    <Brand />
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Organisation operations
                    </p>
                </div>
            </header>
            <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border py-3 text-sm">
                {navigation.map(([label, href]) => (
                    <Link
                        key={href}
                        href={href}
                        className="rounded-lg px-3 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {children}
        </main>
    )
}
