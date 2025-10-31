# MARCS - Offline AI Note-Taking & Assistant

**Markdown AI Research & Content Summarizer**

A fully functional, privacy-first AI assistant with note-taking, chat, and document processing - all running locally in your browser.

---

## ⚡ Quick Start (3 Commands)

```bash
npm install --legacy-peer-deps
npm run setup:onnx
npm run dev
```

**Open**: http://localhost:5173/

✅ **AI Model included** - Flan-T5-Small (370MB) bundled and ready!

---

## 🎯 Key Features

### 📝 Note-Taking with AI Summarization
- Markdown editor with live preview
- AI-powered note summarization
- Tag and folder organization
- Full-text search across all notes
- Auto-save functionality

### 💬 AI Chat Interface
- Conversational AI assistant
- Message history persistence
- Context-aware responses
- 100% offline operation

### 📄 Document Processing
- Upload and analyze documents (PDF, DOC, TXT, MD)
- AI-powered document summarization
- Batch document processing
- Document library management

### 🤖 Bundled AI Model
- **Flan-T5-Small** (370MB) - Already included!
- Optimized for summarization and Q&A
- No additional downloads needed
- Browser-based inference via ONNX Runtime

### 🔒 Privacy-First
- **100% offline** - All processing happens locally
- **No cloud API calls** - Zero data sent to external servers
- **Local storage** - IndexedDB + SQLite for data persistence
- **Your data stays yours** - Complete privacy control

---

## 📋 Documentation

- **[SETUP.md](./SETUP.md)** - Quick setup guide
- **[REQUIREMENTS.md](./REQUIREMENTS.md)** - Detailed system requirements, troubleshooting, browser compatibility
- **[PRD](./PRD)** - Full product requirements document

---

## 💻 System Requirements

**Minimum**:
- Node.js 18+, npm 9+
- Modern browser (Chrome 90+, Edge 90+, Firefox 88+, Safari 14+)
- 4GB RAM
- 1GB free storage

**Recommended**:
- Node.js 20 LTS, npm 10+
- Chrome or Edge (best WebAssembly performance)
- 8GB RAM
- 2GB free storage

---

## 🚀 Installation

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

*Note: `--legacy-peer-deps` required due to vite-plugin-pwa compatibility*

### 2. Setup WASM Files
```bash
npm run setup:onnx
```

*Copies ONNX Runtime and SQL.js WebAssembly files to public/*

### 3. Verify Bundled Model
```bash
ls -lh public/models/flan-t5-small/
```

*Should show ~370MB of model files*

### 4. Start Development Server
```bash
npm run dev
```

*Server starts at http://localhost:5173/*

---

## 🎓 First-Time Usage

1. **Open** http://localhost:5173/
2. **Go to Models tab**
3. **Load the bundled model** - Click "Load Model" on "Flan-T5 Small (Bundled)"
4. **Wait 5-15 seconds** - Model loads into browser memory
5. **Create a note** - Go to Notes tab and click "New Note"
6. **Test AI summarization** - Write some content and click "Summarize"

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build |
| `npm run preview` | Preview production build |
| `npm run check` | TypeScript type checking |
| `npm run lint` | ESLint code linting |
| `npm run setup:onnx` | Copy ONNX Runtime WASM files |

---

## 🏗️ Architecture

```
React UI (TypeScript + Tailwind)
         ↓
  AI Service Layer
         ↓
Web Worker (Comlink)
         ↓
ONNX Runtime Web + Transformers.js
         ↓
WebAssembly (Browser)
         ↓
IndexedDB + SQLite Storage
```

**Key Technologies**:
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **AI Runtime**: ONNX Runtime Web, Transformers.js
- **Storage**: IndexedDB (idb), SQLite (sql.js)
- **Build**: Vite 6
- **Workers**: Web Workers via Comlink

---

## 📦 Bundled Model

### Flan-T5-Small

**What is it?**
- Google's T5 model fine-tuned on diverse tasks
- Encoder-decoder architecture
- Optimized for instruction-following

**Capabilities**:
- ✅ Text summarization
- ✅ Question answering
- ✅ Text generation
- ✅ Translation (EN→DE, EN→FR, EN→RO)

**Specs**:
- **Size**: 370MB (encoder 135MB + decoder 222MB)
- **Vocab**: 32,128 tokens
- **Max Length**: 512 tokens
- **Performance**: 2-5 seconds inference for short text

**Location**: `public/models/flan-t5-small/`

---

## 🎨 Project Structure

```
offline-ai-assistant/
├── public/
│   ├── models/
│   │   └── flan-t5-small/          # Bundled T5 model (370MB)
│   │       ├── encoder_model.onnx
│   │       ├── decoder_model_merged.onnx
│   │       └── tokenizer.json
│   ├── onnx/                       # ONNX Runtime WASM
│   └── sql-wasm/                   # SQL.js WASM
├── src/
│   ├── components/
│   │   ├── notes/                  # Note-taking UI
│   │   ├── chat/                   # Chat interface
│   │   ├── document/               # Document processor
│   │   └── model/                  # Model management
│   ├── lib/
│   │   ├── ai/                     # AI service layer
│   │   ├── storage/                # Storage adapters
│   │   └── fileSystem/             # File system access
│   ├── workers/
│   │   └── aiWorker.ts             # ONNX inference worker
│   ├── App.tsx                     # Main application
│   └── main.tsx                    # Entry point
├── SETUP.md                        # Setup guide
├── REQUIREMENTS.md                 # Detailed requirements
├── PRD                             # Product requirements
├── package.json
└── vite.config.ts
```

---

## 🔧 Configuration

### Adding Custom Models

1. Place ONNX model files in `public/models/your-model/`
2. Update `public/models/models.json`:

```json
{
  "models": [
    {
      "id": "your-model",
      "name": "Your Model Name",
      "description": "Model description",
      "size": "XXXmb",
      "capabilities": ["chat", "summarization"],
      "url": "/models/your-model",
      "modelType": "decoder", // or "t5" for encoder-decoder
      "config": {
        "maxTokens": 512,
        "temperature": 0.7
      }
    }
  ]
}
```

3. Reload app and load model from Models tab

---

## 🌐 Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 90+ | ✅ Recommended | Best WebAssembly performance |
| Edge 90+ | ✅ Recommended | Best WebAssembly performance |
| Firefox 88+ | ✅ Supported | Good compatibility |
| Safari 14+ | ✅ Supported | May have memory limits |
| Mobile | ⚠️ Limited | Memory constraints |

**Enable best performance** (Chrome/Edge):
1. Go to `chrome://flags`
2. Enable `#enable-webassembly-simd`
3. Enable `#enable-webassembly-threads`
4. Restart browser

---

## 🐳 Docker Support (Optional)

### Development
```bash
npm run docker:dev
```

### Production
```bash
npm run docker:prod
```

---

## 🤝 Contributing

This is a fully functional platform. To extend:
1. Add new models in `public/models/`
2. Create custom UI components in `src/components/`
3. Extend storage layer in `src/lib/storage/`
4. Improve AI worker in `src/workers/aiWorker.ts`

---

## 📖 How It Works

### Note Summarization Flow
1. User writes note in markdown editor
2. Clicks "Summarize" button
3. Note content sent to AI worker
4. Worker loads Flan-T5 model (if not loaded)
5. Text prefixed with "summarize: " prompt
6. Encoder processes input → Decoder generates summary
7. Summary displayed in editor
8. User can save, edit, or regenerate

### Storage Architecture
- **IndexedDB**: Fast access for notes, documents, settings
- **SQLite (sql.js)**: Structured queries, complex searches
- **Dual-Write**: Data saved to both for redundancy
- **Export**: JSON/Markdown export for backups

---

## 🔒 Privacy & Security

### What we DO:
✅ Store all data in browser's IndexedDB
✅ Process everything locally with ONNX
✅ Allow data export anytime
✅ Work 100% offline after setup
✅ Use only local storage APIs

### What we DON'T do:
❌ Send data to external servers
❌ Use cloud APIs for AI
❌ Track analytics or behavior
❌ Require accounts
❌ Access data outside browser

---

## ⚠️ Known Issues

- Some TypeScript errors in `ModelManager.tsx` (don't affect functionality)
- First model load takes 5-15 seconds (subsequent loads are instant)
- Large notes (>5000 words) may take 15-30 seconds to summarize
- Mobile browsers may have memory limitations

---

## 📝 License

See LICENSE file for details.

---

## 🙏 Acknowledgments

Built with:
- [ONNX Runtime Web](https://onnxruntime.ai/)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

Model:
- [Flan-T5-Small](https://huggingface.co/google/flan-t5-small) by Google

---

## 🚀 Ready to Use!

The platform is fully functional with real ONNX inference, bundled AI model, and complete note-taking features. Just install, run, and start using!

```bash
npm install --legacy-peer-deps && npm run setup:onnx && npm run dev
```

**Questions?** See [REQUIREMENTS.md](./REQUIREMENTS.md) for troubleshooting.
