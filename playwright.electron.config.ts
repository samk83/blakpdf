import { defineConfig } from '@playwright/test';

// Electron(PC 프로그램) 실행 테스트. 먼저 npm run build 로 dist 를 만든다.
export default defineConfig({
  testDir: 'tests/electron',
  timeout: 60_000,
  workers: 1,
});
