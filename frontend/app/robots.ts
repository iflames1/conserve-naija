import type { MetadataRoute } from "next"

import { siteOrigin } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
    const origin = siteOrigin()
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/auth/",
                "/profile",
                "/organisation",
                "/admin",
                "/activity",
                "/deposit",
                "/points",
                "/collection-points/",
            ],
        },
        sitemap: `${origin}/sitemap.xml`,
    }
}
