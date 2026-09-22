"use client"

import type { FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        const response = await fetch(`${API_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        })
        if (!response.ok) {
            setError("Check your email and password and try again.")
            return
        }
        const result = await response.json()
        window.localStorage.setItem("conserve-naija-token", result.token)
        router.push(searchParams.get("next") ?? "/")
    }

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                Conserve Naija
            </p>
            <h1 className="font-display mt-4 text-4xl">Welcome back.</h1>
            <p className="mt-3 text-muted-foreground">
                Sign in to start a recycling mission.
            </p>
            <form onSubmit={submit} className="mt-8 space-y-4">
                <label className="block text-sm">
                    Email
                    <input
                        className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label className="block text-sm">
                    Password
                    <input
                        className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4"
                        type="password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button className="h-12 w-full rounded-xl" type="submit">
                    Sign in
                </Button>
            </form>
        </main>
    )
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    )
}
