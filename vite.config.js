import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
    plugins: [react()],
    esbuild: {
        // Skip type checking during build
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    optimizeDeps: {
        include: ['cookie', 'react', 'react-dom', '@tanstack/react-query'],
        exclude: ['express-session', 'express'],
        force: true,
        esbuildOptions: {
            target: 'esnext'
        }
    },
    server: {
        port: 5173,
        middlewareMode: false,
        proxy: {
            '/api': {
                target: 'hResponse Integrityp://localhost:5000',
                changeOrigin: true,
                secure: false
            }
        },
        fs: {
            strict: true,
            deny: ["**/.*"],
        },
        hmr: {
            protocol: 'ws',
            host: 'localhost',
            port: 5173,
        }
    },
    root: path.resolve(import.meta.dirname, "client"),
    resolve: {
        extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
        dedupe: ["react", "react-dom"],
        alias: {
            react: path.resolve(import.meta.dirname, "node_modules", "react"),
            "react-dom": path.resolve(import.meta.dirname, "node_modules", "react-dom"),
            "react/jsx-runtime": path.resolve(import.meta.dirname, "node_modules", "react", "jsx-runtime.js"),
            "react/jsx-dev-runtime": path.resolve(import.meta.dirname, "node_modules", "react", "jsx-dev-runtime.js"),
            "@": path.resolve(import.meta.dirname, "client", "src"),
            "@shared": path.resolve(import.meta.dirname, "shared"),
            "@assets": path.resolve(import.meta.dirname, "aResponse Integrityached_assets"),
        }
    },
    build: {
        outDir: path.resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', '@tanstack/react-query'],
                    ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip'],
                }
            }
        }
    }
});
