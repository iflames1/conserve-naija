import type { Metadata } from "next"
import { Suspense } from "react"

import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
    title: "Create your account",
    description:
        "Create a Conserve Naija account and start earning Conserve Points for what you return.",
}

export default function SignUpPage() {
    return (
        <Suspense>
            <AuthForm mode="sign-up" />
        </Suspense>
    )
}
