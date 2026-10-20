/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' : Electron이 file:// 로 dist/index.html 을 열 수 있게 상대 경로로 빌드
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
