import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { jwt } from "better-auth/plugins"
import { Pool } from "pg"

import { isVerificationDisabled } from "@/lib/auth/flags"
import {
    LOCAL_BETTER_AUTH_SECRET,
    LOCAL_DATABASE_URL,
    appUrl,
    env,
    isDev,
} from "@/lib/config"

const databaseUrl = env("DATABASE_URL", LOCAL_DATABASE_URL)
const authSecret = env("BETTER_AUTH_SECRET", LOCAL_BETTER_AUTH_SECRET)
const authUrl = appUrl()
process.env.BETTER_AUTH_SECRET = authSecret
process.env.BETTER_AUTH_URL = authUrl

const skipVerification = isVerificationDisabled()
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

export const auth = betterAuth({
    appName: "Conserve Naija",
    secret: authSecret || undefined,
    baseURL: authUrl || undefined,
    database: new Pool({ connectionString: databaseUrl }),
    trustedOrigins: [
        "http://localhost:3000",
        ...(authUrl ? [authUrl] : []),
    ],
    advanced: {
        database: {
            generateId: () => crypto.randomUUID(),
        },
        useSecureCookies: process.env.NODE_ENV === "production",
    },
    user: {
        modelName: "users",
        fields: {
            name: "display_name",
            emailVerified: "email_verified",
            image: "avatar_url",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    session: {
        modelName: "sessions",
        fields: {
            expiresAt: "expires_at",
            ipAddress: "ip_address",
            userAgent: "user_agent",
            userId: "user_id",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    account: {
        modelName: "accounts",
        fields: {
            accountId: "account_id",
            providerId: "provider_id",
            userId: "user_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            idToken: "id_token",
            accessTokenExpiresAt: "access_token_expires_at",
            refreshTokenExpiresAt: "refresh_token_expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
        accountLinking: {
            enabled: true,
            trustedProviders: ["google"],
        },
    },
    verification: {
        modelName: "verifications",
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const name =
                        user.name?.trim() || user.email.split("@")[0] || "there"
                    return { data: { ...user, name } }
                },
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        requireEmailVerification: !skipVerification,
    },
    emailVerification: {
        sendOnSignUp: !skipVerification,
        sendOnSignIn: !skipVerification,
    },
    socialProviders: {
        ...(googleClientId && googleClientSecret
            ? {
                  google: {
                      clientId: googleClientId,
                      clientSecret: googleClientSecret,
                  },
              }
            : {}),
    },
    plugins: [
        jwt({
            schema: {
                jwks: {
                    fields: {
                        publicKey: "public_key",
                        privateKey: "private_key",
                        createdAt: "created_at",
                        expiresAt: "expires_at",
                    },
                },
            },
            jwks: {
                disablePrivateKeyEncryption: isDev(),
            },
            jwt: {
                definePayload: ({ user }) => ({
                    email: user.email,
                    emailVerified: user.emailVerified,
                }),
            },
        }),
        nextCookies(),
    ],
})

export type Session = typeof auth.$Infer.Session
