"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"

import { LogoMark } from "@/components/common/brand"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { useAuthActions } from "@/stores/auth"

type Mode = "sign-in" | "sign-up"

const COPY = {
    "sign-in": {
        heading: "Welcome back.",
        blurb: "Sign in to start a recycling mission.",
        submit: "Sign in",
        footer: "New to Conserve Naija?",
        footerHref: "/auth/sign-up",
        footerLabel: "Create an account",
    },
    "sign-up": {
        heading: "Create your account.",
        blurb: "It only takes a moment, and your Conserve Points follow you.",
        submit: "Create account",
        footer: "Already have an account?",
        footerHref: "/auth/login",
        footerLabel: "Sign in",
    },
} as const

const FIELD_CLASS =
    "mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"

export function AuthForm({ mode }: { mode: Mode }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { startSession } = useAuthActions()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const copy = COPY[mode]

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setBusy(true)
        try {
            const destination = await startSession(
                mode === "sign-up"
                    ? "/api/v1/auth/sign-up"
                    : "/api/v1/auth/login",
                mode === "sign-up"
                    ? { display_name: name, email, password }
                    : { email, password }
            )
            router.push(searchParams.get("next") ?? destination)
        } catch (cause) {
            setError(
                cause instanceof ApiError ? cause.message : "Please try again."
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5 py-12">
            <Link href="/" className="inline-flex items-center gap-2.5">
                <LogoMark />
                <span className="font-display text-lg">Conserve Naija</span>
            </Link>

            <h1 className="mt-10 font-display text-4xl tracking-tight">
                {copy.heading}
            </h1>
            <p className="mt-3 text-muted-foreground">{copy.blurb}</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
                {mode === "sign-up" ? (
                    <label className="block text-sm">
                        Name
                        <input
                            className={FIELD_CLASS}
                            required
                            autoComplete="name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </label>
                ) : null}
                <label className="block text-sm">
                    Email
                    <input
                        className={FIELD_CLASS}
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label className="block text-sm">
                    Password
                    <input
                        className={FIELD_CLASS}
                        type="password"
                        minLength={8}
                        required
                        autoComplete={
                            mode === "sign-up"
                                ? "new-password"
                                : "current-password"
                        }
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button
                    className="h-12 w-full rounded-xl"
                    type="submit"
                    disabled={busy}
                >
                    {busy ? "Please wait…" : copy.submit}
                </Button>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
                {copy.footer}{" "}
                <Link
                    href={copy.footerHref}
                    className="text-primary hover:underline"
                >
                    {copy.footerLabel}
                </Link>
            </p>
        </main>
    )
}
