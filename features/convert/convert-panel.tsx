"use client";

import { CompareSlider } from "@/components/compare-slider";
import { OptionsLayout } from "@/components/options-layout";
import { ProcessingState } from "@/components/processing-state";
import { ResultFrame } from "@/components/result-frame";
import { outputFileName } from "@/shared/image/file-name";
import type { ToolPanelProps } from "@/shared/tools/tool-definition";
import type { SourceImage } from "@/shared/upload/process-upload";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ConvertOptions } from "./convert-options";
import { DEFAULT_QUALITY, OUTPUT_FORMATS, type OutputFormat } from "./formats";
import { useConvert } from "./use-convert";
import { useEncodableFormats } from "./use-encodable-formats";

export function ConvertPanel({
  source,
  onSourceChange,
  onReset,
  renderToolSelector,
}: ToolPanelProps) {
  const job = useConvert();
  const encodable = useEncodableFormats();
  const [format, setFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  function handleSourceChange(next: SourceImage) {
    job.reset();
    onSourceChange(next);
  }

  function renderBody() {
    const { state } = job;
    switch (state.status) {
      case "running":
        return (
          <ProcessingState
            title="Converting your image"
            description="Running client-side in your browser."
            icon={RefreshCw}
            iconAnimation="spin"
            progress={state.progress}
            stage={state.stage}
            onCancel={job.cancel}
          />
        );

      case "done":
        return (
          <ResultFrame
            title="Conversion complete"
            footnote={`Converted to ${OUTPUT_FORMATS[state.value.format].label} in your browser.`}
            download={{
              url: state.value.url,
              fileName: outputFileName(source.file.name, {
                extension: OUTPUT_FORMATS[state.value.format].extension,
              }),
              label: "Download Converted",
            }}
            onReset={onReset}
          >
            <CompareSlider
              beforeUrl={source.previewUrl}
              afterUrl={state.value.url}
              beforeLabel="Original"
              afterLabel="Converted"
            />
          </ResultFrame>
        );

      case "idle":
      case "failed":
        return (
          <OptionsLayout source={source} onSourceChange={handleSourceChange}>
            <ConvertOptions
              format={format}
              quality={quality}
              encodable={encodable}
              warning={
                state.status === "failed" ? state.error.message : source.warning
              }
              onFormatChange={setFormat}
              onQualityChange={setQuality}
              onConvert={() =>
                job.start({ file: source.file, format, quality })
              }
            />
          </OptionsLayout>
        );
    }
  }

  return (
    <>
      {renderToolSelector({ disabled: job.state.status === "running" })}
      {renderBody()}
    </>
  );
}
