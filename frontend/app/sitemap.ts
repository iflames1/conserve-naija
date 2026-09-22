import type { MetadataRoute } from "next"

import { siteOrigin } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = siteOrigin()
    return [
        "/",
        "/about",
        "/how-it-works",
        "/collection-points",
        "/auth/login",
        "/auth/sign-up",
    ].map((path) => ({
        url: `${origin}${path}`,
        lastModified: new Date(),
    }))
}
