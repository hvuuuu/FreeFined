import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import { buildPageMetadata, siteConfig } from "@/lib/seo";
import Link from "next/link";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn how FreeFined enhances images in the browser with AI upscaling, denoising, and sharpening for JPG, PNG, and WEBP photos.",
  path: "/about",
});

const highlights = [
  "Enhances JPG, PNG, and WEBP images up to 10 MB.",
  "Runs image processing in a browser worker when possible.",
  "Chooses WebGPU, WebGL, or WASM based on the current device.",
  "Provides a fallback enhancement path if a model cannot load.",
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-1 justify-center flex-col gap-10 px-4 py-6 sm:px-6 sm:py-10 md:py-14 lg:py-20">
        <section className="space-y-4">
          <p className="text-sm font-medium text-red-400">{siteConfig.name}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            About FreeFined
          </h1>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            FreeFined is a free AI image enhancer for sharpening, denoising,
            and upscaling photos directly from the browser. The app is built
            for quick edits without accounts, paywalls, or watermarking.
          </p>
        </section>

        <section className="grid gap-4 border-y border-border/60 py-6 sm:grid-cols-2">
          {highlights.map((highlight) => (
            <div key={highlight} className="rounded-md border border-border/50 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {highlight}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            How the app works
          </h2>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            After an image is selected, FreeFined checks its format and size,
            creates a local preview, and sends the image to a browser worker for
            enhancement. The worker loads the best available model path for the
            device and returns an enhanced image that can be compared and
            downloaded.
          </p>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            Uploaded images are not processed by a FreeFined application
            backend. Model files may be loaded through the app&apos;s model route
            so the browser can perform the enhancement locally.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Privacy basics
          </h2>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base text-justify">
            FreeFined does not require an account. For more detail about local
            image handling, analytics, and model loading, read the{" "}
            <Link href="/privacy" className="text-red-400 hover:text-red-300">
              privacy page
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
