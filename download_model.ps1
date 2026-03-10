$modelDir = "public/models/Xenova/multilingual-e5-small"
$baseUrl = "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main"

New-Item -ItemType Directory -Force -Path $modelDir

$files = @(
    "tokenizer.json",
    "tokenizer_config.json",
    "config.json",
    "special_tokens_map.json",
    "onnx/model.onnx",
    "onnx/model_quantized.onnx"
)

New-Item -ItemType Directory -Force -Path "$modelDir/onnx"

foreach ($file in $files) {
    if (!(Test-Path "$modelDir/$file")) {
        echo "Downloading $file..."
        Invoke-WebRequest -Uri "$baseUrl/$file" -OutFile "$modelDir/$file"
    }
    else {
        echo "Skipping $file (already exists)"
    }
}
echo "Done!"
