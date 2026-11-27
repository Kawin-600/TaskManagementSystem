/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { geminiAssistant } from './server/geminiAssistant';
import { taskNotifications } from './server/taskNotifications';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    geminiAssistant(loadEnv(mode, process.cwd(), 'GEMINI_').GEMINI_API_KEY),
    taskNotifications(loadEnv(mode, process.cwd(), ['TELEGRAM_', 'LINE_'])),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
    testTimeout: 15000,
  },
}));
