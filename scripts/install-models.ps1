param(
  [switch]$DownloadModels
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$models = @(
  @{
    Name = "real-esrgan-x4.onnx"
    Url = "https://huggingface.co/AXERA-TECH/Real-ESRGAN/resolve/main/onnx/realesrgan-x4.onnx?download=true"
    Sha256 = "10A7A075719220EE6627124473CE57C74B7EF336B57BED4508D9353EAA8F17EF"
  },
  @{
    Name = "realesrgan-general-x4v3.onnx"
    Url = "https://huggingface.co/qualcomm/Real-ESRGAN-General-x4v3/resolve/e01c7edcbe5dc97b6a8f25507e639b43df49fa76/Real-ESRGAN-General-x4v3.onnx?download=true"
    Sha256 = "754D6BCAB2DDBC84EFA3432224903F84DFD09CF2A90CF25FC69CE3590B67A7F6"
  },
  @{
    Name = "super-resolution-lite.onnx"
    Url = "https://huggingface.co/onnxmodelzoo/super-resolution-10/resolve/main/super-resolution-10.onnx?download=true"
    Sha256 = "85F36FF88CC504A24AF5E0602148BC56A8AA09A58ECA8C0DA2756F3E8186035E"
  }
)

$modelsDir = Join-Path $PSScriptRoot "..\public\models"
$modelsDir = (Resolve-Path $modelsDir).Path
$ortAssetsDir = Join-Path $PSScriptRoot "..\public\ort"
if (-not (Test-Path $ortAssetsDir)) {
  New-Item -ItemType Directory -Path $ortAssetsDir | Out-Null
}

$shouldDownloadModels = $DownloadModels -or ($env:DOWNLOAD_MODELS -eq "1")

if ($shouldDownloadModels) {
  foreach ($model in $models) {
    $targetPath = Join-Path $modelsDir $model.Name

    $needsDownload = $true
    if (Test-Path $targetPath) {
      $currentHash = (Get-FileHash -Path $targetPath -Algorithm SHA256).Hash
      if ($currentHash -eq $model.Sha256) {
        Write-Host "Skipping $($model.Name): checksum already matches."
        $needsDownload = $false
      } else {
        Write-Host "Re-downloading $($model.Name): checksum mismatch."
      }
    }

    if ($needsDownload) {
      Write-Host "Downloading $($model.Name)..."
      Invoke-WebRequest -Uri $model.Url -OutFile $targetPath
    }

    $finalHash = (Get-FileHash -Path $targetPath -Algorithm SHA256).Hash
    if ($finalHash -ne $model.Sha256) {
      throw "Checksum validation failed for $($model.Name). Expected $($model.Sha256), got $finalHash"
    }

    $size = (Get-Item $targetPath).Length
    Write-Host "OK $($model.Name) ($size bytes)"
  }

  Write-Host "All model files are ready in $modelsDir"
} else {
  Write-Host "Skipping model downloads. Set DOWNLOAD_MODELS=1 or pass -DownloadModels to fetch them locally."
}

$ortSourceDir = Join-Path $PSScriptRoot "..\node_modules\onnxruntime-web\dist"
$ortSourceDir = (Resolve-Path $ortSourceDir).Path

$ortAssetFiles = @(
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm"
)

foreach ($fileName in $ortAssetFiles) {
  $sourcePath = Join-Path $ortSourceDir $fileName
  if (-not (Test-Path $sourcePath)) {
    throw "Missing ONNX Runtime asset: $sourcePath"
  }

  $targetPath = Join-Path $ortAssetsDir $fileName
  Copy-Item -Path $sourcePath -Destination $targetPath -Force
  $size = (Get-Item $targetPath).Length
  Write-Host "Copied runtime asset $fileName ($size bytes)"
}

Write-Host "ONNX Runtime assets are ready in $ortAssetsDir"
