export const SITE_NAME = "Conserve Naija"
export const SITE_TAGLINE = "Keeping resources in circulation."
export const SITE_DESCRIPTION =
    "Bring recyclable materials to a Conserve Site, connect to a machine, and earn Conserve Points for what you return."

export function siteOrigin() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}
