import type { Metadata } from "next"

import { HomeScreen } from "@/components/home/home-screen"
import {
    HOME_DESCRIPTION,
    HOME_TITLE,
    siteOgImages,
    siteTwitterImages,
} from "@/lib/seo"

export const metadata: Metadata = {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    openGraph: {
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        url: "/",
        images: siteOgImages(),
    },
    twitter: {
        card: "summary_large_image",
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        images: siteTwitterImages(),
    },
    alternates: { canonical: "/" },
}

export default function HomePage() {
    return <HomeScreen />
}
