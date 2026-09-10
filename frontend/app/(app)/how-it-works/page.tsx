import { PageContainer } from "@/components/common/page-container"
import { HowItWorksCta } from "@/components/home/how-it-works-cta"

const STEPS = [
    {
        title: "Walk up to the Conserve Site",
        body: "Yaba is open. You don't pick a site in the app first.",
    },
    {
        title: "Your Conserve OTP",
        body: "Your phone shows six digits. Type them on the keypad. You've got a couple of minutes.",
    },
    {
        title: "Turn it in",
        body: "Dump mixed waste and press weigh. The machine sorts fractions and counts the kilos. Your phone never enters a weight.",
    },
    {
        title: "Get paid",
        body: "Conserve Points land in your wallet. One point is ₦1. The site sets the price per kilo.",
    },
]

export default function HowItWorksPage() {
    return (
        <PageContainer width="narrow" className="space-y-8">
            <header>
                <h1 className="font-display text-4xl">How it works</h1>
                <p className="mt-2 text-muted-foreground">
                    You&apos;re in the Conserve Site. That&apos;s the whole setup.
                </p>
            </header>
            <ol className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 surface-raised">
                {STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-4 px-4 py-5 sm:px-5">
                        <span className="tnum grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-display text-sm text-primary">
                            {index + 1}
                        </span>
                        <div>
                            <p className="font-medium text-foreground">{step.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                        </div>
                    </li>
                ))}
            </ol>
            <HowItWorksCta />
        </PageContainer>
    )
}
