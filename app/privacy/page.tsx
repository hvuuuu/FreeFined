import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacy",
  description:
    "FreeFined privacy details for browser image processing, local previews, model loading, and production analytics.",
  path: "/privacy",
});

const privacySections = [
  {
    title: "Image handling",
    body: "When you choose an image, FreeFined reads the file in your browser to validate its type and dimensions, create a preview, and run enhancement in a browser worker. The app does not require uploading the image to an application backend for processing.",
  },
  {
    title: "Local previews and downloads",
    body: "Preview and enhanced-image URLs are temporary browser object URLs. They are cleared when you reset the workflow, select another file, leave the page, or close the tab.",
  },
  {
    title: "Model loading",
    body: "The browser may request AI model files through FreeFined model endpoints or pinned upstream model URLs. Those requests are for loading enhancement assets, not for storing your uploaded image.",
  },
  {
    title: "Analytics",
    body: "In production, FreeFined uses Vercel Analytics to understand basic site usage and performance. The app does not require names, email addresses, or user accounts.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 justify-center flex-col gap-10 px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:py-20">
        <section className="space-y-4">
          <p className="text-sm font-medium text-red-400">
            Last updated May 18, 2026
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy
          </h1>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            FreeFined is designed as a browser-first image enhancement tool.
            This page explains what happens when you use the app.
          </p>
        </section>

        <section className="divide-y divide-border/60 border-y border-border/60">
          {privacySections.map((section) => (
            <div key={section.title} className="space-y-3 py-6">
              <h2 className="text-xl font-semibold tracking-tight">
                {section.title}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
                {section.body}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Contact</h2>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            FreeFined is maintained by Vuntra. For project questions, use the
            GitHub link in the header.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
