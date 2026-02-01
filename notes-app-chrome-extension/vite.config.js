import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';
import { fileURLToPath } from 'url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        crx({ manifest: manifest })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../src'),
            react: path.resolve(__dirname, '../node_modules/react'),
            'react-dom': path.resolve(__dirname, '../node_modules/react-dom')
        }
    },
    build: {
        rollupOptions: {
            input: {
                index: 'index.html',
                contentScript: 'src/contentScript.ts'
            }
        },
        // Optimize bundle
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false, // Keep console.logs for debugging
                drop_debugger: true
            }
        }
    },
    // Optimize dependencies
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            'zustand',
            'dexie',
            'yjs',
            'y-webrtc'
        ]
    }
});
