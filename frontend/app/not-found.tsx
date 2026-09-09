import { ButtonLink } from "@/components/ui"

export default function NotFound() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="font-display text-3xl">Nothing here</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
                That page is gone, or it never existed.
            </p>
            <ButtonLink href="/" variant="primary">
                Home
            </ButtonLink>
        </div>
    )
}
