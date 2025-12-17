#!/usr/bin/env node
/**
 * Post-build script to patch OpenNext worker.js for static asset serving
 * This adds ASSETS binding support for CSS/JS files in Cloudflare deployment
 */

const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '.open-next/worker.js');

console.log('📝 Patching worker.js for static asset serving...');

if (!fs.existsSync(workerPath)) {
  console.error(`❌ Worker file not found at ${workerPath}`);
  process.exit(1);
}

let content = fs.readFileSync(workerPath, 'utf8');

const marker = '            const url = new URL(request.url);';
const staticAssetCode = `            const url = new URL(request.url);

            // Serve static assets directly from ASSETS binding
            // This includes CSS, JS, images, fonts, etc. in _next/static/
            if (url.pathname.startsWith("/_next/static/") ||
                url.pathname.startsWith("/favicon.") ||
                url.pathname.startsWith("/manifest.json")) {
                if (env.ASSETS) {
                    return env.ASSETS.fetch(request);
                }
            }
`;

if (!content.includes(marker)) {
  console.error('❌ Could not find marker in worker.js');
  console.error('Expected to find:', marker);
  process.exit(1);
}

if (content.includes('// Serve static assets directly from ASSETS binding')) {
  console.log('✅ Worker already patched, skipping');
  process.exit(0);
}

content = content.replace(marker, staticAssetCode);
fs.writeFileSync(workerPath, content, 'utf8');

console.log('✅ Worker patched successfully');
console.log('   Static assets will be served from ASSETS binding');
