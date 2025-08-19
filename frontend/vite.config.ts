import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

// The plugin might be a default export, or it might be under a 'default' property.
const MonacoEditorPlugin = (monacoEditorPlugin as any).default || monacoEditorPlugin;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: 8080, // or your desired port
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Updated to localhost for local development
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), MonacoEditorPlugin({})],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
