# Quick Setup Guide

## ⚡ Fast Track (3 Commands)

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Setup WASM files
npm run setup:onnx

# 3. Start the app
npm run dev
```

**Then open**: http://localhost:5173/

✅ **Model is already bundled** - no downloads needed!

---

## 📋 Detailed Requirements

See **[REQUIREMENTS.md](./REQUIREMENTS.md)** for:
- System requirements
- Troubleshooting
- Browser compatibility
- Performance tips

---

## Overview

**MARCS** (Markdown AI Research & Content Summarizer) is a fully functional offline AI assistant with:

✅ **Note-Taking** - Markdown editor with AI summarization
✅ **AI Chat** - Conversational interface
✅ **Document Processing** - Upload and analyze documents
✅ **Bundled AI Model** - Flan-T5-Small (370MB) included
✅ **100% Offline** - All processing happens locally
✅ **Privacy-First** - No data sent to external servers

---

## Prerequisites

- **Node.js**: 18+ (20 LTS recommended)
- **npm**: 9+ (10+ recommended)
- **Browser**: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB free space

**Check versions:**
```bash
node --version  # v18.0.0 or higher
npm --version   # v9.0.0 or higher
```

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

**Note**: `--legacy-peer-deps` is required due to vite-plugin-pwa compatibility.

**Expected time**: 2-5 minutes

### 2. Setup WASM Files

```bash
npm run setup:onnx
```

**This copies:**
- ONNX Runtime WASM → `public/onnx/`
- SQL.js WASM → `public/sql-wasm/`

**Expected output:**
```
✅ Successfully copied 3 WASM files to public/
```

### 3. Verify Bundled Model

```bash
ls -lh public/models/flan-t5-small/
```

**Should show ~370MB of model files** (encoder, decoder, tokenizer)

✅ **Already included - no download needed!**

### 4. Start Development Server

```bash
npm run dev
```

**Server starts at**: http://localhost:5173/

---

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Type Checking
```bash
npm run check
```

---

## First-Time Usage

1. **Open** http://localhost:5173/
2. **Go to Models tab**
3. **Click "Load Model"** on "Flan-T5 Small (Bundled)"
4. **Wait 5-15 seconds** for model to load into browser memory
5. **Go to Notes tab** and create your first note
6. **Click "Summarize"** to test AI functionality

---

### 🎯 Note-Taking with AI Summarization
- Create, edit, and organize notes
- Markdown editor with live preview
- Tag and folder organization
- AI-powered summarization
- Full-text search

### 💬 AI Chat Interface
- Conversational AI
- Message history
- Context-aware responses
- Uses bundled model

### 📄 Document Processing
- Upload PDF, DOC, TXT, MD files
- AI analysis and summarization
- Document library
- Batch processing

### 🤖 Bundled AI Model
- **Flan-T5-Small** (370MB) - Included!
- Optimized for summarization
- Fast browser inference
- No external downloads

### 💾 Offline Storage
- IndexedDB for fast access
- SQLite for structured queries
- Backup/export functionality
- All data stays local

---

## Bundled AI Model

### Flan-T5-Small (Included)

**Location**: `public/models/flan-t5-small/`

**Files**:
- `encoder_model.onnx` (135MB)
- `decoder_model_merged.onnx` (222MB)
- `tokenizer.json` (2.3MB)
- `config.json` (1.5KB)

**Capabilities**:
- ✅ Text summarization
- ✅ Question answering
- ✅ Text generation
- ✅ Translation (EN→DE, FR, RO)

**Performance**:
- Load time: 5-15 seconds (first time)
- Inference: 2-5 seconds (short text)
- Max sequence: 512 tokens

**Already configured in** `public/models/models.json`

---

## Adding Additional Models (Optional)

Want to add more models? See `public/models/models.json` for configuration.

**Recommended sources**:
- Hugging Face ONNX: https://huggingface.co/models?library=onnx
- Xenova's Models: https://huggingface.co/Xenova

**Add model files to**: `public/models/your-model-name/`

**Update**: `public/models/models.json` with model config

## How It Works

### Architecture

```
┌─────────────────────────────────────────────┐
│            React UI (App.tsx)               │
├─────────────────────────────────────────────┤
│     AI Service (lib/ai/aiService.ts)        │
├─────────────────────────────────────────────┤
│   AI Worker (workers/aiWorker.ts)           │
│   - Tokenization                            │
│   - ONNX Inference                          │
│   - Decoding                                │
├─────────────────────────────────────────────┤
│  ONNX Runtime Web (onnxruntime-web)         │
├─────────────────────────────────────────────┤
│    WebAssembly (Browser)                    │
└─────────────────────────────────────────────┘
```

### Inference Pipeline

1. **User Input** → Text prompt from chat or document
2. **Tokenization** → Convert text to token IDs
3. **ONNX Inference** → Run model on token IDs
4. **Decoding** → Convert output tokens back to text
5. **Response** → Display generated text to user

### Storage

- **IndexedDB**: Fast client-side storage for conversations, documents, settings
- **SQLite (sql.js)**: Structured queries and complex data relationships
- **Dual-adapter**: Automatic failover and data redundancy

## Usage

### Chat with AI

1. Start the app: `npm run dev`
2. Navigate to the Chat view
3. Load a model from the Models panel
4. Type your message and press Enter
5. AI responses are generated locally using ONNX

### Analyze Documents

1. Go to Documents view
2. Upload files (TXT, MD, PDF, DOC, JSON, HTML)
3. Click "Analyze" on any document
4. AI will process and summarize the document

### Manage Models

1. Go to Models view
2. See available models from models.json
3. Click "Load" to initialize a model
4. Click "Unload" to free memory
5. View performance metrics

## Performance Tips

### Model Selection

- **Smaller models** (< 100MB): Fast, low memory, basic responses
- **Medium models** (100-500MB): Balanced quality and speed
- **Large models** (> 500MB): High quality but slow and memory-intensive

### Browser Optimization

- **Use Chrome/Edge**: Best WebAssembly performance
- **Enable hardware acceleration**: chrome://flags
- **Close other tabs**: Free up memory for models
- **Use desktop browser**: Mobile browsers have memory limits

### Model Quantization

For better performance, use quantized models:
- **INT4**: 4x smaller, fastest (some quality loss)
- **INT8**: 2x smaller, fast (minimal quality loss)
- **FP16**: 2x smaller, good balance
- **FP32**: Full precision (largest, slowest)

## Troubleshooting

### Model Not Loading

**Error**: "Failed to load model"

**Solutions**:
- Check model file exists at specified path
- Verify models.json is valid JSON
- Check browser console for specific errors
- Try a smaller model first (< 100MB)
- Ensure ONNX WASM files are in `/public/onnx/`

### Out of Memory

**Error**: "Out of memory" or browser crashes

**Solutions**:
- Use a smaller/quantized model
- Close other browser tabs
- Increase browser memory limit (chrome://flags → #enable-webassembly-baseline)
- Try a desktop browser instead of mobile
- Unload unused models

### Slow Inference

**Issue**: Responses take too long

**Solutions**:
- Use INT4 or INT8 quantized models
- Reduce maxTokens in models.json
- Enable SIMD in browser (chrome://flags → #enable-webassembly-simd)
- Use WebAssembly threaded mode (enabled by default)
- Try a smaller model

### No Response Generated

**Issue**: Model loads but doesn't generate text

**Solutions**:
- Check model format is compatible (decoder-only for text generation)
- Verify model has correct input/output names (input_ids, logits)
- Check tokenizer vocabulary matches model
- Try adjusting temperature (0.7-1.0 recommended)
- Look at browser console for errors

## Model Compatibility

### Supported Model Types

✅ **Decoder-only** (GPT-2, GPT-Neo, LLaMA, Mistral)
✅ **Encoder-only** (BERT, DistilBERT, RoBERTa)
⚠️ **Encoder-decoder** (T5, BART) - Requires additional setup

### Required Model Inputs

Your ONNX model should accept:
- **input_ids**: int64 tensor [batch_size, sequence_length]

### Required Model Outputs

Your ONNX model should output:
- **logits** or **output**: float32 tensor [batch_size, sequence_length, vocab_size]

## Advanced Configuration

### Custom Tokenizer

To use a custom tokenizer, modify `workers/aiWorker.ts`:

```typescript
// Load custom tokenizer JSON
const tokenizerConfig = await fetch('/models/tokenizer.json');
const tokenizer = new CustomTokenizer(tokenizerConfig);
```

### Multi-Model Setup

You can load multiple models simultaneously:

```typescript
// In Model Manager
await loadModel('gpt2-small'); // For chat
await loadModel('distilbert');  // For analysis
```

### Streaming Responses

Enable streaming for real-time token generation (future feature):

```typescript
for await (const token of generateStream(prompt)) {
  console.log(token); // Display each token as generated
}
```

## Security & Privacy

🔒 **All data stays local**
- No external API calls
- No telemetry or tracking
- No cloud storage

🔒 **Data persistence**
- IndexedDB (browser storage)
- SQLite in-memory or LocalStorage
- User controls all data

🔒 **Model security**
- Models run in WebAssembly sandbox
- No code execution from models
- CORS protection on model files

## Contributing

This is a fully functional platform! To extend it:

1. Add new model types in `lib/ai/`
2. Improve tokenization in `workers/aiWorker.ts`
3. Add new UI features in `components/`
4. Enhance storage in `lib/storage/`

## Resources

- [ONNX Runtime Web Docs](https://onnxruntime.ai/docs/tutorials/web/)
- [Hugging Face ONNX Export](https://huggingface.co/docs/optimum/exporters/onnx/usage_guides/export_a_model)
- [ONNX Model Zoo](https://github.com/onnx/models)
- [WebAssembly](https://webassembly.org/)

## License

See LICENSE file for details.

---

**Ready to go!** The platform is fully functional with real ONNX inference. Just add your models and start using it.
