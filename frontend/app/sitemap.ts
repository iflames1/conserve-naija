import type { MetadataRoute } from "next"

import { siteOrigin } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = siteOrigin()
    return [
        "/",
        "/about",
        "/how-it-works",
        "/explore",
        "/collection-points",
    ].map((path) => ({
        url: `${origin}${path}`,
        lastModified: new Date(),
    }))
}
