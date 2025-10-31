#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const publicOnnxDir = join(projectRoot, 'public', 'onnx');
const publicSqlDir = join(projectRoot, 'public', 'sql-wasm');

// Ensure directories exist
if (!existsSync(publicOnnxDir)) {
  mkdirSync(publicOnnxDir, { recursive: true });
}
if (!existsSync(publicSqlDir)) {
  mkdirSync(publicSqlDir, { recursive: true });
}

try {
  let totalCopied = 0;

  // Copy ONNX runtime WASM files from node_modules
  console.log('📦 Copying ONNX Runtime WASM files...');
  const onnxNodeModules = join(projectRoot, 'node_modules', 'onnxruntime-web', 'dist');

  const onnxFiles = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm'
  ];

  for (const file of onnxFiles) {
    const srcPath = join(onnxNodeModules, file);
    const destPath = join(publicOnnxDir, file);

    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`  ✓ Copied ${file}`);
      totalCopied++;
    } else {
      console.warn(`  ⚠ Warning: ${file} not found`);
    }
  }

  // Copy sql.js WASM files from node_modules
  console.log('\n📦 Copying sql.js WASM files...');
  const sqlNodeModules = join(projectRoot, 'node_modules', 'sql.js', 'dist');

  const sqlFiles = [
    'sql-wasm.wasm',
    'sql-wasm.js'
  ];

  for (const file of sqlFiles) {
    const srcPath = join(sqlNodeModules, file);
    const destPath = join(publicSqlDir, file);

    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`  ✓ Copied ${file}`);
      totalCopied++;
    } else {
      console.warn(`  ⚠ Warning: ${file} not found`);
    }
  }

  if (totalCopied > 0) {
    console.log(`\n✅ Successfully copied ${totalCopied} WASM files to public/`);
  } else {
    console.error('\n❌ No files were copied. Please check your dependencies.');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error setting up WASM files:', error.message);
  process.exit(1);
}