import Link from "next/link"

import { LogoMark } from "@/components/common/brand"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
    return (
        <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
            <LogoMark className="size-12" />
            <p className="font-mono text-sm text-primary">404</p>
            <h1 className="font-display text-3xl">Nothing here</h1>
            <p className="max-w-sm text-muted-foreground">
                That page is gone, or it never existed.
            </p>
            <Link
                href="/"
                className={cn(buttonVariants({ size: "lg" }), "rounded-xl")}
            >
                Back to Conserve Naija
            </Link>
        </main>
    )
}
