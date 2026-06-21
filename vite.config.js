import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  // Public directory for static assets (manifest.json, sw.js, favicon.ico)
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // CSS code splitting for per-page CSS loading
    cssCodeSplit: true,
    // Asset hashing for cache-busting
    assetsDir: 'assets',
    // Rollup options for code splitting
    rollupOptions: {
      output: {
        // Manual chunk strategy for optimal caching
        manualChunks(id) {
          // Vendor chunk for node_modules (if any client-side deps are used)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          // Data/content chunks — these change less frequently
          if (id.includes('src/data/salesforceContent')) {
            return 'content-bank';
          }
          if (id.includes('src/data/careerIntelligence') || id.includes('src/data/studyAnalytics')) {
            return 'analytics';
          }
          if (id.includes('src/data/navigation')) {
            return 'navigation';
          }
          // Components chunk
          if (id.includes('src/components')) {
            return 'components';
          }
          // Code practice module
          if (id.includes('code-practice')) {
            return 'code-practice';
          }
          // UI Shell
          if (id.includes('src/ui-shell')) {
            return 'ui-shell';
          }
        },
        // Naming patterns with content hashes
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // CSS files go to css/ directory
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          // Fonts
          if (assetInfo.name && /\.(woff2?|ttf|eot|otf)$/.test(assetInfo.name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          // Images
          if (assetInfo.name && /\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
            return 'img/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Increase chunk size warning limit (we know app.js is large)
    chunkSizeWarningLimit: 500
  }
});
