"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth/client"
import { signInSchema, type SignInFormValues } from "@/lib/auth/schemas"

export default function LoginPage() {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        setError,
    } = useForm<SignInFormValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: { email: "", password: "" },
    })

    async function onSubmit(values: SignInFormValues) {
        const { error } = await authClient.signIn.email(values)
        if (error) {
            setError("root", {
                message: error.message || "Could not sign in. Try again.",
            })
            return
        }
        router.push("/")
        router.refresh()
    }

    return (
        <div>
            <h1 className="font-display text-3xl">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
                Same email you signed up with.
            </p>
            <div className="mt-8 space-y-4">
                {process.env.GOOGLE_OAUTH_ENABLED === "1" ? (
                    <>
                        <GoogleOAuthButton callbackURL="/" />
                        <p className="text-center text-xs text-muted-foreground">or use email</p>
                    </>
                ) : null}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" {...register("email")} />
                        {errors.email ? (
                            <p className="text-sm text-destructive">{errors.email.message}</p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" {...register("password")} />
                        {errors.password ? (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        ) : null}
                    </div>
                    {errors.root ? (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {errors.root.message}
                        </p>
                    ) : null}
                    <Button
                        className="w-full"
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Signing in…" : "Sign in"}
                    </Button>
                </form>
                <p className="text-sm text-muted-foreground">
                    New here?{" "}
                    <Link href="/auth/sign-up" className="text-foreground underline">
                        Create an account
                    </Link>
                </p>
            </div>
        </div>
    )
}
