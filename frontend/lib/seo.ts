import type { Metadata } from "next";

import { appUrl } from "@/lib/config";

export const SITE_NAME = "Conserve Naija";

export const SITE_DESCRIPTION =
	"Walk up to Conserve Site — Yaba, turn in mixed waste, and get paid. 1 CP = ₦1.";

export const HOME_TITLE = "Conserve Naija | Get paid to recycle";

export const HOME_DESCRIPTION =
	"Walk up to a Conserve Site in Nigeria, dump mixed waste, and earn Conserve Points. One point is ₦1.";

/** Search metadata only — not shown in titles or descriptions. */
export const SITE_KEYWORDS = [
	"Conserve Naija",
	"recycling Nigeria",
	"recycle plastic Nigeria",
	"get paid to recycle",
	"Conserve Points",
	"Conserve Site",
	"Yaba recycling",
	"mixed waste recycling",
	"reverse vending machine Nigeria",
	"PET recycling Nigeria",
	"paper glass metal recycling",
	"circular economy Nigeria",
	"IoT recycling",
	"waste to cash",
	"Nigeria recycle and earn",
];

export function siteOrigin(): string {
	const fromApp = process.env.APP_URL?.trim();
	if (fromApp) return fromApp.replace(/\/$/, "");
	const vercel =
		process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
		process.env.VERCEL_URL?.trim();
	if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
	return appUrl() || "http://localhost:3000";
}

export const OG_IMAGE_PATH = "/opengraph-image";

export function siteOgImages(alt = SITE_NAME) {
	return [
		{
			url: OG_IMAGE_PATH,
			width: 1200,
			height: 630,
			alt,
			type: "image/png",
		},
	] satisfies NonNullable<Metadata["openGraph"]>["images"];
}

export function siteTwitterImages() {
	return [OG_IMAGE_PATH];
}

export function organizationJsonLd() {
	const origin = siteOrigin();
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				"@id": `${origin}/#org`,
				name: SITE_NAME,
				url: origin,
				logo: `${origin}/logo.png`,
				description: SITE_DESCRIPTION,
			},
			{
				"@type": "WebSite",
				"@id": `${origin}/#website`,
				name: SITE_NAME,
				url: origin,
				description: SITE_DESCRIPTION,
				keywords: SITE_KEYWORDS.join(", "),
				publisher: { "@id": `${origin}/#org` },
			},
		],
	};
}

export function pageMeta(
	title: string,
	description: string,
	path = "/",
): Metadata {
	const url = `${siteOrigin()}${path}`;
	return {
		title,
		description,
		keywords: SITE_KEYWORDS,
		alternates: { canonical: url },
		openGraph: {
			title: `${title} · ${SITE_NAME}`,
			description,
			url,
			images: siteOgImages(`${title} · ${SITE_NAME}`),
		},
		twitter: {
			title: `${title} · ${SITE_NAME}`,
			description,
			images: siteTwitterImages(),
		},
	};
}
