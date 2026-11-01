import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Рекурсивно находим все .ts файлы
function getAllTsFiles(dir, files = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const entryPoints = getAllTsFiles('./src');

await build({
  entryPoints,
  bundle: false, // НЕ бандлим — оставляем импорты
  outdir: 'dist',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  minify: false,
}).then(() => {
  console.log('✅ Bot compiled successfully');
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
