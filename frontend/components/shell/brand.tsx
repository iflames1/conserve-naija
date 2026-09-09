import Link from "next/link"

export function Brand({ hideName = false }: { hideName?: boolean }) {
    return (
        <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                CN
            </span>
            {hideName ? (
                <span className="sr-only">Conserve Naija</span>
            ) : (
                <span className="font-display text-lg">Conserve Naija</span>
            )}
        </Link>
    )
}
