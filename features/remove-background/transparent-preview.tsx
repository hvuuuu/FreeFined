"use client";

import { Card } from "@/components/ui/card";
import Image from "next/image";

const CHECKERBOARD_STYLE = {
  backgroundColor: "rgba(148, 163, 184, 0.08)",
  backgroundImage:
    "linear-gradient(45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%), linear-gradient(-45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%), linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%)",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
  backgroundSize: "20px 20px",
};

/** Shows a cut-out image over a checkerboard so transparent areas are visible. */
export function TransparentPreview({ url }: { url: string }) {
  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden ring-1 ring-red-500/20 sm:max-w-2xl">
      <div
        className="relative aspect-4/3 w-full overflow-hidden sm:aspect-16/10"
        style={CHECKERBOARD_STYLE}
      >
        <Image
          src={url}
          alt="Image with background removed"
          fill
          sizes="(max-width: 640px) 100vw, 768px"
          unoptimized
          className="absolute inset-0 h-full w-full object-contain p-2"
        />
      </div>
    </Card>
  );
}
