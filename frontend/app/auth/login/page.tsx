import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
    title: "Sign in",
    description:
        "Sign in to start a recycling mission and follow your Conserve Points.",
}

export default function LoginPage() {
    return (
        <Suspense>
            <AuthForm mode="sign-in" />
        </Suspense>
    )
}
