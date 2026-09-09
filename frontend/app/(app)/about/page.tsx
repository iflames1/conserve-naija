import { PageContainer } from "@/components/common/page-container"

export default function AboutPage() {
    return (
        <PageContainer width="narrow" className="space-y-6">
            <header>
                <h1 className="font-display text-4xl">About</h1>
                <p className="mt-3 text-lg text-muted-foreground">
                    Walk up to a machine, turn in what you&apos;ve got, get paid
                    for it.
                </p>
            </header>
            <div className="space-y-4 rounded-2xl border border-border/70 p-5 text-sm leading-relaxed text-muted-foreground surface-raised">
                <p>
                    Organisations run the machines and haul the material. Plastic
                    is first. Paper, glass, metal, and e-waste can use the same
                    machines when a site is ready for them.
                </p>
                <p>
                    One Green Point is ₦1. The machine weighs. Your phone holds
                    the code and the wallet.
                </p>
            </div>
        </PageContainer>
    )
}
