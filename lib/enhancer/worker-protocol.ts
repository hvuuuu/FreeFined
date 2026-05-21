import type {
  BackgroundRemovalMode,
  EnhancementMode,
} from "@/lib/enhancer/models";
import type { InferenceBackend } from "@/lib/enhancer/runtime-plan";

export interface EnhancementJobInput {
  file: File;
  mode: EnhancementMode;
  backend: InferenceBackend;
  timeoutMs: number;
  allowLowQualityFallback: boolean;
}

export interface BackgroundRemovalJobInput {
  file: File;
  mode: BackgroundRemovalMode;
  backend: InferenceBackend;
  timeoutMs: number;
  allowFallback: boolean;
}

export type ProcessingMode = EnhancementMode | BackgroundRemovalMode;

export type WorkerRequest = {
  type: "start";
  requestId: string;
  payload: EnhancementJobInput;
};

export type BackgroundRemovalWorkerRequest = {
  type: "start";
  requestId: string;
  payload: BackgroundRemovalJobInput;
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
      mode: ProcessingMode;
      estimatedTime: string;
      modelCached: boolean;
      usingFallback: boolean;
      warning: string | null;
    }
  | {
      type: "done";
      requestId: string;
      mode: ProcessingMode;
      backend: InferenceBackend;
      blob: Blob;
      warning: string | null;
    }
  | {
      type: "error";
      requestId: string;
      error: string;
    };
