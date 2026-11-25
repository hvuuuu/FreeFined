"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCEPT_ATTRIBUTE,
  processUploadFile,
  type SourceImage,
} from "@/shared/upload/process-upload";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";

interface SourceCardProps {
  source: SourceImage;
  onSourceChange: (source: SourceImage) => void;
}

/** Preview of the current source image with a "Change" button to pick another file. */
export function SourceCard({ source, onSourceChange }: SourceCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDecodingHeic, setIsDecodingHeic] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    const result = await processUploadFile(file, setIsDecodingHeic);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onSourceChange(result.source);
  }

  return (
    <Card className="mx-auto w-full max-w-[20rem] overflow-hidden md:max-w-md lg:max-w-none">
      <div className="relative mx-auto aspect-4/5 w-full bg-transparent sm:aspect-4/3 lg:aspect-square">
        {isDecodingHeic ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-red-500" />
            <p className="text-foreground animate-pulse text-xs font-medium">
              Decoding HEIC...
            </p>
          </div>
        ) : (
          <Image
            src={source.previewUrl}
            alt="Selected image preview"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 70vw, 40vw"
            unoptimized
            className="h-full w-full object-contain p-1.5 sm:p-2"
          />
        )}
      </div>
      <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-muted-foreground min-w-0 flex-1 truncate text-xs sm:text-sm"
            title={source.file.name}
          >
            {source.file.name}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isDecodingHeic}
            className="shrink-0 cursor-pointer text-xs sm:text-sm"
          >
            Change
          </Button>
        </div>
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-400 sm:text-sm">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          </div>
        )}
      </CardContent>
      <input
        type="file"
        ref={inputRef}
        onChange={(event) => void handleFileChange(event)}
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        disabled={isDecodingHeic}
      />
    </Card>
  );
}
