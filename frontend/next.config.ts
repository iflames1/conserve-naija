import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    env: {
        DISABLE_VERIFICATION: process.env.DISABLE_VERIFICATION ?? "1",
        API_URL: process.env.API_URL ?? "",
        APP_URL: process.env.APP_URL ?? "",
        GOOGLE_OAUTH_ENABLED:
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
                ? "1"
                : "",
    },
}

export default nextConfig
