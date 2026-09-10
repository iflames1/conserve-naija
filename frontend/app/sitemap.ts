import type { MetadataRoute } from "next"

import { siteOrigin } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = siteOrigin()
    const now = new Date()

    return [
        {
            url: origin,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${origin}/how-it-works`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${origin}/explore`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${origin}/about`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.6,
        },
    ]
}
