export const SITE_NAME = "Conserve Naija"
export const SITE_DESCRIPTION =
    "Turn everyday recyclable materials into value with Conserve Naija."

export function siteOrigin() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}
