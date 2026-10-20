/**
 * 화면 테스트: SPEC 수락기준을 실제 조작으로 확인한다.
 * 샘플 도면: A3 가로 1190.55 × 841.89 pt, 3쪽 (tests/fixtures/sample-plan.pdf)
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const PW = 1190.55
const PH = 841.89
const SHOTS = process.env.SHOTS

test.describe.configure({ mode: 'serial' })

let page: Page
const errors: string[] = []

async function box(idx = 0) {
  const b = await page.locator(`[data-page-overlay="${idx}"]`).boundingBox()
  if (!b) throw new Error(`page ${idx} not visible`)
  return b
}

/** PDF 좌표(pt, y 위쪽) → 화면 좌표 */
async function at(x: number, y: number, idx = 0) {
  const b = await box(idx)
  return { x: b.x + (x * b.width) / PW, y: b.y + ((PH - y) * b.height) / PH }
}

async function drag(from: [number, number], to: [number, number], idx = 0, steps = 8) {
  const a = await at(...from, idx)
  const b = await at(...to, idx)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps })
  await page.mouse.up()
}

async function click(x: number, y: number, idx = 0) {
  const p = await at(x, y, idx)
  await page.mouse.click(p.x, p.y)
}

async function tool(id: string) {
  await page.locator(`[data-tool="${id}"]`).click()
}

const count = () => page.locator('[data-row]').count()

async function shot(name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
})

test.afterAll(() => {
  expect(errors, errors.join('\n')).toEqual([])
})

test('#1 PDF를 열면 첫 페이지와 썸네일이 보인다', async () => {
  await shot('01-empty')
  await page.getByRole('button', { name: '샘플 도면 열기' }).click()
  await expect(page.locator('[data-thumb]')).toHaveCount(3)
  await expect(page.getByTestId('file-name')).toHaveText('sample-plan.pdf')
  await expect(page.locator('[data-page="0"]')).not.toContainText('불러오는 중')
  // 캔버스에 실제로 무언가 그려졌는지 (흰색이 아닌 픽셀)
  const drawn = await page.locator('[data-page="0"] canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let dark = 0
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 128) dark++
    return dark
  })
  expect(drawn).toBeGreaterThan(50)
  await expect(page.getByTestId('page-total')).toHaveText('/ 3')
})

test('#2 확대/축소, 폭 맞춤, 페이지 이동', async () => {
  const z0 = await page.getByTestId('zoom').textContent()
  await page.getByRole('button', { name: '확대' }).click()
  await expect(page.getByTestId('zoom')).not.toHaveText(z0!)
  const z1 = parseInt((await page.getByTestId('zoom').textContent())!)
  expect(z1).toBeGreaterThan(parseInt(z0!))
  // Ctrl+휠 축소
  const v = await page.getByTestId('viewer').boundingBox()
  await page.mouse.move(v!.x + 300, v!.y + 200)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 400)
  await page.keyboard.up('Control')
  await expect.poll(async () => parseInt((await page.getByTestId('zoom').textContent())!)).toBeLessThan(z1)
  await page.getByRole('button', { name: '폭 맞춤' }).click()
  await expect(page.getByTestId('zoom')).toHaveText(z0!)
  // 썸네일 클릭 → 3쪽
  await page.locator('[data-thumb="2"]').click()
  await expect(page.getByTestId('page-input')).toHaveValue('3')
  await page.getByRole('button', { name: '이전 페이지' }).click()
  await expect(page.getByTestId('page-input')).toHaveValue('2')
  await page.locator('[data-thumb="0"]').click()
  await expect(page.getByTestId('page-input')).toHaveValue('1')
  await page.waitForTimeout(600)
})

test('#3 11가지 마크업 도구로 그리면 목록에 1행씩 추가된다', async () => {
  await tool('line')
  await drag([120, 780], [260, 740])
  await tool('arrow')
  await drag([300, 780], [420, 730])
  await tool('rect')
  await drag([460, 790], [560, 730])
  await tool('ellipse')
  await drag([600, 790], [700, 730])
  await tool('polygon')
  await click(760, 780)
  await click(840, 790)
  await click(820, 730)
  await page.keyboard.press('Enter')
  await tool('cloud')
  await click(880, 790)
  await click(1000, 790)
  await click(1000, 720)
  const p = await at(880, 720)
  await page.mouse.dblclick(p.x, p.y)
  expect(await count()).toBe(6)

  await tool('text')
  await click(130, 690)
  await expect(page.getByLabel('마크업 내용')).toBeFocused()
  await page.keyboard.type('창호 규격 확인')
  await page.keyboard.press('Escape')
  await tool('callout')
  await drag([450, 600], [520, 660])
  await page.keyboard.type('벽체 두께 재검토')
  await page.keyboard.press('Escape')
  await tool('note')
  await click(800, 660)
  await expect(page.locator('#prop-text')).toBeFocused()
  await page.keyboard.type('현장 확인 필요')
  await page.locator('#prop-text').blur()
  await tool('pen')
  await drag([150, 560], [260, 520], 0, 15)
  await tool('highlighter')
  await drag([560, 460], [690, 460], 0, 10)

  await expect(page.locator('[data-row]')).toHaveCount(11)
  const types = await page.locator('[data-row] td:nth-child(2)').allTextContents()
  expect(types.sort()).toEqual(['선', '화살표', '사각형', '타원', '다각형', '구름', '텍스트', '콜아웃', '메모', '펜', '형광펜'].sort())
  await expect(page.locator('[data-row]', { hasText: '창호 규격 확인' })).toHaveCount(1)
  await expect(page.locator('[data-row]', { hasText: '벽체 두께 재검토' })).toHaveCount(1)
  await expect(page.locator('[data-row]', { hasText: '현장 확인 필요' })).toHaveCount(1)
  // 도면 위에 그려졌는지
  await expect(page.locator('[data-page-overlay="0"] [data-markup-id]')).toHaveCount(11)
  await expect(page.getByTestId('dirty')).toBeVisible()
  await tool('select')
  await shot('02-markups')
})

test('#4 선택·이동·삭제·속성 변경, #5 실행 취소/다시 실행', async () => {
  await tool('select')
  // 사각형 테두리 클릭 → 선택
  await click(460, 760)
  const sel = page.locator('[data-selection]')
  await expect(sel).toHaveCount(1)
  const before = await sel.boundingBox()
  await drag([460, 760], [500, 720])
  const after = await sel.boundingBox()
  expect(after!.x - before!.x).toBeGreaterThan(20)
  expect(after!.y - before!.y).toBeGreaterThan(20)
  // 속성: 색 바꾸기
  await page.getByRole('radiogroup', { name: '선 색' }).getByRole('radio', { name: '#2f9e44' }).click()
  const id = await sel.getAttribute('data-selection')
  await expect(page.locator(`[data-markup-id="${id}"] path`).first()).toHaveAttribute('stroke', '#2f9e44')
  // 투명도
  await page.locator('#prop-opacity').fill('50')
  await expect(page.locator(`[data-markup-id="${id}"]`)).toHaveAttribute('opacity', '0.5')
  // 실행 취소: 투명도 → 색 → 이동
  await page.keyboard.press('Control+z')
  await expect(page.locator(`[data-markup-id="${id}"]`)).toHaveAttribute('opacity', '1')
  await page.keyboard.press('Control+z')
  await expect(page.locator(`[data-markup-id="${id}"] path`).first()).toHaveAttribute('stroke', '#e03131')
  await page.keyboard.press('Control+y')
  await expect(page.locator(`[data-markup-id="${id}"] path`).first()).toHaveAttribute('stroke', '#2f9e44')
  // 삭제 → 되돌리기
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-row]')).toHaveCount(10)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-row]')).toHaveCount(11)
  await page.keyboard.press('Escape')
})

test('#6 축척 보정, #7 길이·면적·둘레·개수 측정', async () => {
  // 샘플 도면 격자: 100pt = 1m. 벽 100→700 (600pt) = 6m
  await tool('calibrate')
  await click(100, 200)
  await click(700, 200)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('#cal-real').fill('6')
  await page.locator('#cal-unit').selectOption('m')
  await page.getByTestId('cal-apply').click()
  await expect(page.getByTestId('scale')).toContainText('600.0pt = 6 m')

  await tool('length')
  await drag([100, 300], [300, 300])
  await expect(page.getByTestId('measure-value')).toHaveText('2.00 m')
  await tool('area')
  await click(100, 400)
  await click(400, 400)
  await click(400, 600)
  await click(100, 600)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('measure-value')).toHaveText('6.00 m²')
  await tool('perimeter')
  await click(450, 250)
  await click(650, 250)
  await click(650, 350)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('measure-value')).toHaveText('3.00 m')
  await tool('count')
  await click(150, 650)
  await click(200, 650)
  await click(250, 650)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('measure-value')).toHaveText('3 ea')
  // 도면 위 라벨 + 목록 측정값 열
  const overlay = page.locator('[data-page-overlay="0"]')
  for (const label of ['2.00 m', '6.00 m²', '3.00 m', '3 ea']) {
    await expect(overlay.locator('text', { hasText: label })).toHaveCount(1)
    await expect(page.locator('[data-row] td:nth-child(4)', { hasText: label })).toHaveCount(1)
  }
  await tool('select')
  await page.keyboard.press('Escape')
  await shot('03-measure')
})

test('#8 목록 정렬·필터, 행 클릭으로 이동·선택', async () => {
  // 3쪽에 마크업 하나 추가
  await page.locator('[data-thumb="2"]').click()
  await expect(page.getByTestId('page-input')).toHaveValue('3')
  await page.waitForTimeout(800)
  await tool('rect')
  await drag([500, 500], [650, 400], 2)
  await tool('select')
  await page.locator('[data-thumb="0"]').click()
  await expect(page.getByTestId('page-input')).toHaveValue('1')
  await page.waitForTimeout(800)

  // 필터
  await page.getByLabel('마크업 검색').fill('길이')
  await expect(page.getByTestId('markup-count')).toHaveText('1 / 16')
  await page.getByLabel('검색어 지우기').click()
  // 기본은 페이지 오름차순. 한 번 누르면 내림차순 → 첫 행이 3쪽
  await page.locator('th button', { hasText: '페이지' }).click()
  await expect(page.locator('[data-row] td:nth-child(1)').first()).toHaveText('3')
  // 측정값 정렬
  await page.locator('th button', { hasText: '측정값' }).click()
  await page.locator('th button', { hasText: '측정값' }).click()
  await expect(page.locator('[data-row] td:nth-child(4)').first()).toHaveText('6.00 m²')
  // 3쪽 행 클릭 → 3쪽으로 이동하고 선택
  await page.locator('th button', { hasText: '페이지' }).click()
  const row = page.locator('[data-row]').filter({ has: page.locator('td:nth-child(1)', { hasText: /^3$/ }) })
  await row.click()
  await expect(page.getByTestId('page-input')).toHaveValue('3')
  await expect(row).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-page-overlay="2"] [data-selection]')).toHaveCount(1)
})

test('#9 CSV 내보내기', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV 내보내기' }).click()])
  const text = readFileSync((await dl.path())!, 'utf8')
  expect(text.charCodeAt(0)).toBe(0xfeff)
  const lines = text.slice(1).trim().split('\r\n')
  expect(lines[0]).toBe('페이지,종류,내용,색,측정값,단위,작성자,작성일,수정일')
  expect(lines).toHaveLength(17)
  expect(text).toContain(',길이,,#3b5bdb,2,m,검토자,')
})

test('#10 저장 후 다시 열면 마크업이 복원된다, #11 저장 상태 표시', async () => {
  await expect(page.getByTestId('dirty')).toBeVisible()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '저장', exact: true }).click()])
  const saved = (await dl.path())!
  await expect(page.getByTestId('dirty')).toHaveCount(0)
  // 다른 문서 열었다가 저장본 다시 열기
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: '열기', exact: true }).click()])
  await chooser.setFiles({ name: 'reopened.pdf', mimeType: 'application/pdf', buffer: readFileSync(saved) })
  await expect(page.getByTestId('file-name')).toHaveText('reopened.pdf')
  await expect(page.locator('[data-row]')).toHaveCount(16)
  await expect(page.getByTestId('scale')).toContainText('600.0pt = 6 m')
  await expect(page.locator('[data-row]', { hasText: '창호 규격 확인' })).toHaveCount(1)
  // 화면용 사본에 중복 주석이 없어야 한다 (pdf.js 가 캔버스에 그린 주석 + SVG 가 겹치지 않음)
  await expect(page.locator('[data-page-overlay="0"] [data-markup-id]')).toHaveCount(15)
  await shot('04-reopened')
})

test('#13 테마 전환', async () => {
  await page.getByRole('button', { name: '어두운 테마' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await shot('05-dark')
  await page.getByRole('button', { name: '밝은 테마' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
