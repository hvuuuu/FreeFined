import type { Metadata } from "next";

export const siteConfig = {
  name: "FreeFined",
  url: "https://freefined.vercel.app",
  title: "FreeFined - Free AI Image Enhancer",
  description:
    "FreeFined is a free browser-based AI image enhancer for upscaling, denoising, and sharpening JPG, PNG, and WEBP images without an account.",
  creator: "Vuntra",
  ogImagePath: "/opengraph-image",
  googleSiteVerification:
    process.env.GOOGLE_SITE_VERIFICATION ??
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  keywords: [
    "FreeFined",
    "free AI image enhancer",
    "free image enhancer",
    "AI image upscaler",
    "photo enhancer",
    "image upscaling",
    "browser image enhancer",
    "no account image enhancer",
    "JPG image enhancer",
    "PNG image enhancer",
    "WEBP image enhancer",
  ],
} as const;

export const sitemapRoutes = [
  {
    path: "/",
    lastModified: "2026-05-18",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/about",
    lastModified: "2026-05-18",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/privacy",
    lastModified: "2026-05-18",
    changeFrequency: "monthly",
    priority: 0.6,
  },
] as const;

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}

export function buildPageMetadata({
  title,
  description = siteConfig.description,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: siteConfig.name,
      title,
      description,
      url: absoluteUrl(path),
      images: [
        {
          url: siteConfig.ogImagePath,
          width: 1200,
          height: 630,
          alt: "FreeFined AI image enhancer",
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImagePath],
    },
  };
}
