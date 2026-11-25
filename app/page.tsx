"use client";

import { Header } from "@/components/header";
import { SiteFooter } from "@/components/site-footer";
import { ToolModeSelector } from "@/components/tool-mode-selector";
import { UploadZone } from "@/components/upload-zone";
import type { SourceImage } from "@/shared/upload/process-upload";
import { useEffect, useState } from "react";
import { DEFAULT_TOOL_ID, TOOLS, findTool, type ToolId } from "./tools";

export default function HomePage() {
  const [toolId, setToolId] = useState<ToolId>(DEFAULT_TOOL_ID);
  const [source, setSource] = useState<SourceImage | null>(null);
  const tool = findTool(toolId);

  // The page owns the uploaded image, so it frees the preview URL when the image is replaced or the page unmounts.
  useEffect(() => {
    if (!source) {
      return;
    }
    const { previewUrl } = source;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [source]);

  const renderToolSelector = (disabled: boolean) => (
    <ToolModeSelector
      tools={TOOLS}
      value={toolId}
      disabled={disabled}
      onChange={setToolId}
    />
  );

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent"
      />
      <Header onReset={() => setSource(null)} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center p-4 sm:p-6 lg:py-8">
        <div className="w-full max-w-7xl space-y-4 transition-all duration-500 sm:space-y-5">
          {source ? (
            <tool.Panel
              key={tool.id}
              source={source}
              onSourceChange={setSource}
              onReset={() => setSource(null)}
              renderToolSelector={({ disabled }) =>
                renderToolSelector(disabled)
              }
            />
          ) : (
            <>
              {renderToolSelector(false)}
              <UploadZone copy={tool.upload} onFileSelected={setSource} />
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
