import type { AppUser } from "@/lib/api/types"
import { isVerificationDisabled } from "@/lib/auth/flags"

export function userFromAuthSession(input: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    emailVerified?: boolean | null
}): AppUser {
    const email = input.email.trim().toLowerCase()
    return {
        id: input.id,
        email,
        displayName: input.name?.trim() || email.split("@")[0] || "there",
        avatarUrl: input.image,
        emailVerified: Boolean(input.emailVerified) || isVerificationDisabled(),
        greenPointsBalance: 0,
        conservePointsBalance: 0,
        nairaValue: 0,
        depositCount: 0,
        recycledKg: 0,
        roles: [],
        organisations: [],
    }
}
