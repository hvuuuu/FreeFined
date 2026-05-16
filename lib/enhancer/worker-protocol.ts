import type { EnhancementMode } from "@/lib/enhancer/models";
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan";

export interface EnhancementJobInput {
  file: File;
  mode: EnhancementMode;
  backend: InferenceBackend;
  timeoutMs: number;
  allowLowQualityFallback: boolean;
}

export type WorkerRequest = {
  type: "start";
  requestId: string;
  payload: EnhancementJobInput;
};

export type WorkerResponse =
  | {
      type: "progress";
      requestId: string;
      progress: number;
      message: string;
    }
  | {
      type: "ready";
      requestId: string;
      backend: InferenceBackend;
      mode: EnhancementMode;
      estimatedTime: string;
      modelCached: boolean;
      usingFallback: boolean;
      warning: string | null;
    }
  | {
      type: "done";
      requestId: string;
      mode: EnhancementMode;
      backend: InferenceBackend;
      blob: Blob;
      warning: string | null;
    }
  | {
      type: "error";
      requestId: string;
      error: string;
    };
