The app can load ONNX models from this folder when they are downloaded locally. If a local file is missing, the API route falls back to the pinned upstream URL.

Optional local download (for offline dev or testing):

```powershell
$env:DOWNLOAD_MODELS=1
pnpm models:install
```

This also copies ONNX Runtime WebAssembly files to `public/ort` for worker inference.

Current pinned model sources:

- `https://huggingface.co/AXERA-TECH/Real-ESRGAN/resolve/main/onnx/realesrgan-x4.onnx?download=true`
- `https://huggingface.co/qualcomm/Real-ESRGAN-General-x4v3/resolve/e01c7edcbe5dc97b6a8f25507e639b43df49fa76/Real-ESRGAN-General-x4v3.onnx?download=true`
- `https://huggingface.co/onnxmodelzoo/super-resolution-10/resolve/main/super-resolution-10.onnx?download=true`
- `https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx?download=true`
- `https://huggingface.co/Heliosoph/u2net-onnx/resolve/main/u2netp.onnx?download=true`

If an enhancement model cannot be loaded, the app still runs using the built-in fallback enhancement path. If BiRefNet-lite cannot be loaded for background removal, the worker retries with U2Netp.
