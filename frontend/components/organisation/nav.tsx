"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
    { href: "/organisation", label: "Overview" },
    { href: "/organisation/points", label: "Collection points" },
    { href: "/organisation/devices", label: "Machines" },
    { href: "/organisation/pricing", label: "Materials" },
    { href: "/organisation/pickups", label: "Pickups" },
    { href: "/organisation/activity", label: "Activity" },
]

export function OrganisationNav() {
    const pathname = usePathname()
    return (
        <nav className="mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-3 text-sm">
            {LINKS.map((link) => {
                const active =
                    link.href === "/organisation"
                        ? pathname === "/organisation"
                        : pathname.startsWith(link.href)
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "relative rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground",
                            active && "text-foreground"
                        )}
                    >
                        {link.label}
                        {active ? (
                            <span className="absolute inset-x-3 -bottom-[13px] h-px bg-primary" />
                        ) : null}
                    </Link>
                )
            })}
        </nav>
    )
}
