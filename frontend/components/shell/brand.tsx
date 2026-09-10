import Image from "next/image"
import Link from "next/link"

export function Brand({ hideName = false }: { hideName?: boolean }) {
    return (
        <Link href="/" className="flex items-center gap-2.5">
            <Image
                src="/logo.png"
                alt="Conserve Naija"
                width={32}
                height={32}
                className="size-8 rounded-md object-cover"
                priority
            />
            {hideName ? (
                <span className="sr-only">Conserve Naija</span>
            ) : (
                <span className="font-display text-lg">Conserve Naija</span>
            )}
        </Link>
    )
}

