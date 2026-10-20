// Electron 데스크톱 창 동작 확인 (Linux CI용): xvfb-run node tests/electron/smoke.mjs
// Windows 에서는 npm start 로 직접 확인한다.
import { _electron as electron } from '@playwright/test'

const shots = process.env.SHOTS
const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env } })
const win = await app.firstWindow()
const errors = []
win.on('pageerror', (e) => errors.push(String(e)))
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await win.waitForSelector('text=도면 검토를 시작하세요')
console.log('title:', await win.title(), '| url:', win.url())
await win.getByRole('button', { name: '샘플 도면 열기' }).click()
await win.waitForSelector('[data-thumb="2"]')
await win.waitForFunction(() => !document.querySelector('[data-page="0"]')?.textContent?.includes('불러오는 중'))
// 마크업 하나 그려 보고 저장 표시 확인
await win.locator('[data-tool="rect"]').click()
const b = await win.locator('[data-page-overlay="0"]').boundingBox()
await win.mouse.move(b.x + 100, b.y + 100)
await win.mouse.down()
await win.mouse.move(b.x + 250, b.y + 200, { steps: 5 })
await win.mouse.up()
await win.waitForSelector('[data-row]')
console.log('title after edit:', await win.title())
const hasApi = await win.evaluate(() => typeof window.blakpdf?.openPdf === 'function')
console.log('desktop api:', hasApi)
if (shots) await win.screenshot({ path: `${shots}/06-electron.png` })
// 저장하지 않은 변경 → 닫기 확인 대화상자가 떠야 하므로 강제로 종료
await app.evaluate(({ app }) => app.exit(0))
if (errors.length) {
  console.error('errors:\n' + errors.join('\n'))
  process.exit(1)
}
if (!hasApi) process.exit(1)
console.log('ELECTRON SMOKE OK')
