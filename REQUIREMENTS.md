# Requirements & Installation Guide

## System Requirements

### Minimum Requirements
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB free space (for dependencies and model files)
- **Browser**: Chrome 90+, Edge 90+, Firefox 88+, or Safari 14+

### Recommended Setup
- **Node.js**: 20.x LTS
- **npm**: 10.x
- **RAM**: 8GB or more
- **Storage**: 2GB+ free space
- **Browser**: Latest Chrome or Edge (best WebAssembly performance)

---

## Prerequisites

### 1. Node.js and npm

**Check if installed:**
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher
```

**Install if needed:**
- **macOS**: `brew install node` or download from [nodejs.org](https://nodejs.org/)
- **Windows**: Download installer from [nodejs.org](https://nodejs.org/)
- **Linux**:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

### 2. Git (Optional - for cloning)
```bash
git --version  # Check if installed
```

**Install if needed:**
- **macOS**: `brew install git` or Xcode Command Line Tools
- **Windows**: Download from [git-scm.com](https://git-scm.com/)
- **Linux**: `sudo apt-get install git`

---

## Installation Steps

### Step 1: Clone or Download the Project

**Option A: Clone with Git**
```bash
git clone <repository-url>
cd offline-ai-assistant
```

**Option B: Download ZIP**
1. Download and extract the project ZIP file
2. Navigate to the extracted directory

### Step 2: Install Dependencies

```bash
npm install --legacy-peer-deps
```

**Note**: We use `--legacy-peer-deps` due to vite-plugin-pwa version compatibility. This is safe and expected.

**Expected time**: 2-5 minutes depending on internet speed

**Verify installation:**
```bash
npm list --depth=0
```

You should see packages including:
- `react@18.3.1`
- `onnxruntime-web@1.17.0`
- `@xenova/transformers@latest`
- `sql.js@1.10.2`
- `vite@6.x.x`

### Step 3: Setup ONNX Runtime WASM Files

```bash
npm run setup:onnx
```

**This copies required WebAssembly files:**
- ONNX Runtime WASM → `public/onnx/`
- SQL.js WASM → `public/sql-wasm/`

**Expected output:**
```
📦 Copying ONNX Runtime WASM files...
  ✓ Copied ort-wasm-simd-threaded.wasm
📦 Copying sql.js WASM files...
  ✓ Copied sql-wasm.wasm
  ✓ Copied sql-wasm.js
✅ Successfully copied 3 WASM files to public/
```

### Step 4: Verify Model Files

**Check that the bundled Flan-T5-Small model exists:**
```bash
ls -lh public/models/flan-t5-small/
```

**You should see:**
```
encoder_model.onnx          (135MB)
decoder_model_merged.onnx   (222MB)
tokenizer.json              (2.3MB)
config.json                 (1.5KB)
tokenizer_config.json       (2.3KB)
generation_config.json      (147B)
```

**Total size**: ~370MB

✅ **Model is already bundled - no additional downloads needed!**

---

## Running the Application

### Development Mode

```bash
npm run dev
```

**Expected output:**
```
> offline-ai-assistant@1.0.0 dev
> npm run setup:onnx && vite

✅ Successfully copied 3 WASM files to public/

  VITE v6.4.1  ready in 338 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Open your browser to**: http://localhost:5173/

### Production Build

```bash
npm run build
npm run preview
```

**Build output** will be in the `dist/` directory.

---

## TypeScript Type Checking

```bash
npm run check
```

This runs TypeScript compiler in check mode (no output files).

**Note**: Some errors in model/ModelManager.tsx are known and don't affect functionality.

---

## Troubleshooting

### Issue 1: `npm install` fails with peer dependency errors

**Solution**:
```bash
npm install --legacy-peer-deps
```

### Issue 2: "Module not found" errors

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue 3: WASM files not loading (404 errors)

**Solution**:
```bash
npm run setup:onnx
# Then restart dev server
```

### Issue 4: Model files missing

**Check**:
```bash
ls public/models/flan-t5-small/
```

**If missing**, re-download the model:
```bash
cd public/models
mkdir -p flan-t5-small
cd flan-t5-small

# Download encoder
curl -L "https://huggingface.co/Xenova/flan-t5-small/resolve/main/onnx/encoder_model.onnx" -o encoder_model.onnx

# Download decoder
curl -L "https://huggingface.co/Xenova/flan-t5-small/resolve/main/onnx/decoder_model_merged.onnx" -o decoder_model_merged.onnx

# Download tokenizer
curl -L "https://huggingface.co/Xenova/flan-t5-small/resolve/main/tokenizer.json" -o tokenizer.json

# Download config
curl -L "https://huggingface.co/Xenova/flan-t5-small/resolve/main/config.json" -o config.json
```

### Issue 5: Browser performance issues

**Solutions**:
- Use Chrome or Edge (best WebAssembly performance)
- Close other browser tabs
- Enable hardware acceleration in browser settings
- Ensure at least 4GB RAM available

### Issue 6: Model won't load in browser

**Check browser console** for specific errors.

**Common fixes**:
1. Clear browser cache and reload
2. Check CORS errors (should not happen in dev mode)
3. Verify WASM files are accessible: http://localhost:5173/onnx/ort-wasm-simd-threaded.wasm
4. Restart dev server

---

## Browser Compatibility

### ✅ Fully Supported
- **Chrome** 90+ (Recommended)
- **Edge** 90+ (Recommended)
- **Firefox** 88+
- **Safari** 14+

### ⚠️ Limited Support
- **Mobile browsers** (may have memory limitations)
- **Older browsers** (WebAssembly SIMD support required)

### Enable Best Performance

**Chrome/Edge**:
1. Go to `chrome://flags`
2. Enable: `#enable-webassembly-simd`
3. Enable: `#enable-webassembly-threads`
4. Restart browser

---

## Project Structure

```
offline-ai-assistant/
├── public/
│   ├── models/
│   │   └── flan-t5-small/      # Bundled T5 model (370MB)
│   ├── onnx/                   # ONNX Runtime WASM files
│   └── sql-wasm/               # SQL.js WASM files
├── src/
│   ├── components/
│   │   ├── notes/              # Note-taking components
│   │   ├── chat/               # Chat interface
│   │   └── document/           # Document processor
│   ├── lib/
│   │   ├── ai/                 # AI service & worker
│   │   └── storage/            # IndexedDB & SQLite
│   ├── workers/
│   │   └── aiWorker.ts         # Web Worker for AI inference
│   └── App.tsx                 # Main application
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Dependencies Overview

### Core Dependencies
- **react** & **react-dom**: UI framework
- **onnxruntime-web**: Run ONNX models in browser
- **@xenova/transformers**: T5 tokenization and support
- **sql.js**: In-browser SQLite database
- **idb**: IndexedDB wrapper
- **comlink**: Web Worker communication
- **vite**: Build tool and dev server

### UI Dependencies
- **lucide-react**: Icons
- **tailwindcss**: Styling
- **sonner**: Toast notifications
- **recharts**: Charts (for model metrics)

### Storage
- **IndexedDB**: Fast client-side storage (via idb)
- **SQLite**: Structured queries (via sql.js)

---

## Environment Variables

No environment variables required! Everything runs locally.

---

## Development Tools

### ESLint (Code Linting)
```bash
npm run lint
```

### TypeScript Check
```bash
npm run check
```

---

## Performance Tips

### For Model Loading
- First load takes longer (downloads to browser cache)
- Subsequent loads are instant (cached)
- Expect 5-15 seconds for initial model load

### For Inference (Summarization)
- Small notes (<1000 words): 2-5 seconds
- Medium notes (1000-5000 words): 5-15 seconds
- Large notes (>5000 words): 15-30 seconds

### Optimize Performance
1. Use Chrome/Edge for best WebAssembly performance
2. Close unnecessary browser tabs
3. Ensure hardware acceleration is enabled
4. Use smaller models for faster inference

---

## Next Steps After Installation

1. **Start the dev server**: `npm run dev`
2. **Open the app**: http://localhost:5173/
3. **Load the model**:
   - Go to "Models" tab
   - Click "Load Model" on "Flan-T5 Small (Bundled)"
   - Wait 5-15 seconds for model to load
4. **Test note summarization**:
   - Go to "Notes" tab
   - Create a new note
   - Write some content
   - Click "Summarize"
5. **Explore other features**:
   - Chat interface
   - Document upload & analysis
   - Settings

---

## Support & Issues

### Common Questions

**Q: Do I need internet after installation?**
A: No! After running `npm install` and `npm run setup:onnx`, everything works 100% offline.

**Q: Where is data stored?**
A: All data stays in your browser's IndexedDB and SQLite (in-memory or localStorage). Nothing sent to external servers.

**Q: Can I use different models?**
A: Yes! You can add more ONNX models to `public/models/` and configure them in `public/models/models.json`.

**Q: Why is the app slow?**
A: AI inference in browsers is slower than server-side. Use Chrome/Edge, close other tabs, and ensure hardware acceleration is enabled.

**Q: Can I deploy this?**
A: Yes! Run `npm run build` and deploy the `dist/` folder to any static hosting (GitHub Pages, Netlify, Vercel, etc.).

---

## Minimum Viable Setup

**Absolute minimum to run**:
```bash
# Install dependencies
npm install --legacy-peer-deps

# Setup WASM files
npm run setup:onnx

# Start dev server
npm run dev
```

**That's it!** Model is already bundled.

---

## Version Information

- **Node.js**: 18+ required, 20 LTS recommended
- **npm**: 9+ required, 10+ recommended
- **Bundled Model**: Flan-T5-Small (370MB)
- **ONNX Runtime**: 1.17.0
- **React**: 18.3.1
- **Vite**: 6.4.1

---

**Last Updated**: October 30, 2025
**Status**: ✅ Production Ready
