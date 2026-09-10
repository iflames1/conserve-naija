"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { GpPill } from "@/components/shell/gp-pill"
import { UserMenu } from "@/components/shell/user-menu"
import { HeaderActionsSkeleton } from "@/components/common/page-skeleton"
import { cn } from "@/lib/utils"
import { useSessionLoading, useSessionUser } from "@/stores/session"

const PUBLIC_LINKS = [
    { href: "/how-it-works", label: "How it works" },
    { href: "/explore", label: "Explore" },
    { href: "/about", label: "About" },
]

const CITIZEN_LINKS = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/profile", label: "Profile" },
]

function isActive(pathname: string, href: string) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppHeader({ brand }: { brand: React.ReactNode }) {
    const user = useSessionUser()
    const loading = useSessionLoading()
    const pathname = usePathname()
    const links = user ? CITIZEN_LINKS : PUBLIC_LINKS

    return (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
            <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
                {brand}

                <nav className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "relative rounded-lg px-3 py-2 text-sm font-medium",
                                isActive(pathname, link.href)
                                    ? "text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {link.label}
                            {isActive(pathname, link.href) ? (
                                <span className="absolute inset-x-3 -bottom-px h-px bg-primary" />
                            ) : null}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2 sm:gap-3">
                    {loading && !user ? (
                        <HeaderActionsSkeleton />
                    ) : user ? (
                        <>
                            <div className="hidden sm:block">
                                <GpPill />
                            </div>
                            <UserMenu />
                        </>
                    ) : (
                        <UserMenu />
                    )}
                </div>
            </div>
            {!loading && !user ? (
                <div className="flex gap-4 overflow-x-auto border-t border-border/50 px-4 py-2 text-sm md:hidden">
                    {PUBLIC_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "shrink-0 text-muted-foreground",
                                isActive(pathname, link.href) && "text-foreground"
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            ) : null}
        </header>
    )
}

export function CitizenDock() {
    const user = useSessionUser()
    const pathname = usePathname()
    if (!user) return null
    if (pathname.startsWith("/organisation") || pathname.startsWith("/admin")) {
        return null
    }

    return (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-lg grid-cols-3 px-2 py-2 text-xs">
                {CITIZEN_LINKS.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "rounded-lg py-2 text-center text-muted-foreground",
                            isActive(pathname, link.href) && "bg-muted text-foreground"
                        )}
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
        </nav>
    )
}
