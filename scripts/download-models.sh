#!/bin/bash
# scripts/download-models.sh

set -e

MODELS_DIR="./models"
mkdir -p $MODELS_DIR

echo "Downloading AI models for offline use..."

# TinyLlama-1.1B (ONNX format)
if [ ! -f "$MODELS_DIR/tinyllama-1.1b.onnx" ]; then
    echo "Downloading TinyLlama-1.1B..."
    curl -L "https://huggingface.co/microsoft/TinyLlama-1.1B-Chat-v1.0-onnx/resolve/main/model.onnx" \
         -o "$MODELS_DIR/tinyllama-1.1b.onnx"
fi

# Phi-3-mini (ONNX format)
if [ ! -f "$MODELS_DIR/phi-3-mini.onnx" ]; then
    echo "Downloading Phi-3-mini..."
    curl -L "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx/resolve/main/cpu_and_mobile/cpu-int4-rtn-block-32/model.onnx" \
         -o "$MODELS_DIR/phi-3-mini.onnx"
fi

# DistilBERT (ONNX format)
if [ ! -f "$MODELS_DIR/distilbert-base.onnx" ]; then
    echo "Downloading DistilBERT..."
    curl -L "https://huggingface.co/distilbert-base-uncased/resolve/main/onnx/model.onnx" \
         -o "$MODELS_DIR/distilbert-base.onnx"
fi

echo "Model download completed!"