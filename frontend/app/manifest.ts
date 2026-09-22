import type { MetadataRoute } from "next"

import { APP_BACKGROUND } from "@/lib/theme"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        display: "standalone",
        background_color: APP_BACKGROUND,
        theme_color: APP_BACKGROUND,
    }
}
