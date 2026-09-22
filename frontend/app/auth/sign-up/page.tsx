"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export default function SignUpPage() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        const response = await fetch(`${API_URL}/api/v1/auth/sign-up`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ display_name: name, email, password }),
        })
        if (!response.ok) {
            setError("We could not create that account.")
            return
        }
        const result = await response.json()
        window.localStorage.setItem("conserve-naija-token", result.token)
        router.push("/")
    }

    return (
        <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-5">
            <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                Conserve Naija
            </p>
            <h1 className="font-display mt-4 text-4xl">Start your account.</h1>
            <form onSubmit={submit} className="mt-8 space-y-4">
                <label className="block text-sm">
                    Name
                    <input
                        className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
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
                        minLength={8}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button className="h-12 w-full rounded-xl" type="submit">
                    Create account
                </Button>
            </form>
        </main>
    )
}
