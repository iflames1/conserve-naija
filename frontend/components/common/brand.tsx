import Image from "next/image"
import Link from "next/link"

import { SITE_NAME } from "@/lib/seo"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
    return (
        <Image
            src="/logo.png"
            alt=""
            width={64}
            height={64}
            priority
            className={cn("size-8 rounded-[0.55rem]", className)}
        />
    )
}

export function Brand({
    href = "/",
    className,
}: {
    href?: string
    className?: string
}) {
    return (
        <Link
            href={href}
            className={cn(
                "inline-flex items-center gap-2.5 transition-opacity hover:opacity-90",
                className
            )}
        >
            <LogoMark />
            <span className="font-display text-lg tracking-tight">
                {SITE_NAME}
            </span>
        </Link>
    )
}
