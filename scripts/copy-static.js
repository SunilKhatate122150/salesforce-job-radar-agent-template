import fs from 'fs';
import path from 'path';

// Helper to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy pages folder
const srcPages = path.resolve('pages');
const destPages = path.resolve('dist/pages');
if (fs.existsSync(srcPages)) {
  console.log(`Copying ${srcPages} to ${destPages}...`);
  copyDir(srcPages, destPages);
} else {
  console.warn(`Source pages folder does not exist: ${srcPages}`);
}

// Copy dynamic src/styles folder
const srcStyles = path.resolve('src/styles');
const destStyles = path.resolve('dist/src/styles');
if (fs.existsSync(srcStyles)) {
  console.log(`Copying ${srcStyles} to ${destStyles}...`);
  copyDir(srcStyles, destStyles);
} else {
  console.warn(`Source styles folder does not exist: ${srcStyles}`);
}

// Copy assets folder
const srcAssets = path.resolve('assets');
const destAssets = path.resolve('dist/assets');
if (fs.existsSync(srcAssets)) {
  console.log(`Copying ${srcAssets} to ${destAssets}...`);
  copyDir(srcAssets, destAssets);
} else {
  console.warn(`Source assets folder does not exist: ${srcAssets}`);
}

// Copy static root files
const filesToCopy = ['favicon.ico', 'manifest.json', 'sw.js'];
filesToCopy.forEach(file => {
  const srcFile = path.resolve(file);
  const destFile = path.resolve('dist', file);
  if (fs.existsSync(srcFile)) {
    console.log(`Copying ${srcFile} to ${destFile}...`);
    fs.copyFileSync(srcFile, destFile);
  } else {
    console.warn(`Static file does not exist: ${srcFile}`);
  }
});

console.log('Static assets copy completed!');
