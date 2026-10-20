import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const SAMPLE = 'tests/e2e/fixtures/sample.pdf';
const PAGE_W = 842;

async function openPdf(page: Page, file = SAMPLE) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('welcome-open').click();
  await (await chooser).setFiles(file);
  await expect(page.getByTestId('page-count')).toHaveText('/ 3');
  await expect(page.locator('.page-canvas')).toHaveAttribute('data-rendering', 'false');
}

/** 페이지 좌표(pt) → 화면 좌표 */
async function toScreen(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('overlay').boundingBox())!;
  const s = box.width / PAGE_W;
  return { x: box.x + x * s, y: box.y + y * s };
}

async function drag(page: Page, from: [number, number], to: [number, number], steps = 8) {
  const a = await toScreen(page, ...from);
  const b = await toScreen(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

const rows = (page: Page) => page.getByTestId('markup-row');

/** 캔버스 한 점의 색 (페이지 좌표) */
async function pixelAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const c = document.querySelector<HTMLCanvasElement>('.page-canvas')!;
      const s = c.width / 842;
      const d = c.getContext('2d')!.getImageData(Math.round(px * s), Math.round(py * s), 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    [x, y],
  );
}

test('1. PDF를 열면 첫 페이지·페이지 수·썸네일이 보인다', async ({ page }) => {
  await openPdf(page);
  await expect(page.getByTestId('page')).toBeVisible();
  await expect(page.getByTestId('page-input')).toHaveValue('1');
  await expect(page.getByTestId('thumbnails').locator('.thumb')).toHaveCount(3);
  // 테두리 선(30pt, 위에서 30pt) 위치가 검게 그려졌는지
  const [r, g, b] = await pixelAt(page, 30, 300);
  expect(r + g + b).toBeLessThan(200);
});

test('2. 확대/축소·Ctrl+휠·폭 맞춤·페이지 이동', async ({ page }) => {
  await openPdf(page);
  const label = page.getByTestId('zoom-label');
  const before = await label.textContent();
  await page.getByTestId('btn-zoom-in').click();
  await expect(label).not.toHaveText(before!);
  const zoomed = parseInt((await label.textContent())!, 10);
  await page.getByTestId('btn-zoom-out').click();
  expect(parseInt((await label.textContent())!, 10)).toBeLessThan(zoomed);

  const vb = (await page.getByTestId('viewer').boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  const w0 = parseInt((await label.textContent())!, 10);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(async () => parseInt((await label.textContent())!, 10)).toBeGreaterThan(w0);

  await page.getByTestId('btn-zoom-in').click();
  await page.getByTestId('btn-fit').click();
  const pageBox = (await page.getByTestId('page').boundingBox())!;
  expect(Math.abs(vb.width - 48 - pageBox.width)).toBeLessThan(4);

  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('page')).toHaveAttribute('data-page', '2');
  await page.getByTestId('btn-prev').click();
  await expect(page.getByTestId('page')).toHaveAttribute('data-page', '1');
  await page.getByTestId('page-input').fill('3');
  await page.getByTestId('page-input').press('Enter');
  await expect(page.getByTestId('page')).toHaveAttribute('data-page', '3');
  await page.getByTestId('thumbnails').locator('.thumb').first().click();
  await expect(page.getByTestId('page')).toHaveAttribute('data-page', '1');
});

test('3. 모든 도구로 그리고, 선택해서 옮기고, Delete로 지운다', async ({ page }) => {
  await openPdf(page);
  const shapes: [string, [number, number], [number, number]][] = [
    ['pen', [100, 100], [180, 140]],
    ['highlight', [100, 160], [250, 160]],
    ['line', [300, 100], [400, 100]],
    ['arrow', [300, 140], [400, 180]],
    ['rect', [450, 100], [550, 180]],
    ['ellipse', [600, 100], [700, 180]],
    ['cloud', [100, 250], [300, 350]],
    ['length', [400, 300], [600, 300]],
  ];
  for (const [tool, a, b] of shapes) {
    await page.getByTestId(`tool-${tool}`).click();
    await drag(page, a, b);
  }
  await expect(rows(page)).toHaveCount(8);
  for (const [tool] of shapes) await expect(page.locator(`[data-kind="${tool}"]`)).toHaveCount(1);

  // 텍스트
  await page.getByTestId('tool-text').click();
  const p = await toScreen(page, 450, 400);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId('text-input').fill('Check door width');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.locator('[data-kind="text"] text')).toHaveText('Check door width');
  await expect(rows(page)).toHaveCount(9);

  // 선택 → 이동
  await page.getByTestId('tool-select').click();
  const rectPath = page.locator('[data-kind="rect"] path').first();
  const d0 = await rectPath.getAttribute('d');
  await drag(page, [500, 140], [520, 200]);
  await expect(page.locator('[data-kind="rect"] .selection-box')).toHaveCount(1);
  await expect(rectPath).not.toHaveAttribute('d', d0!);
  expect(await rectPath.getAttribute('d')).toContain('M 470 160');

  // Delete
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-kind="rect"]')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(8);
});

test('4. 색·굵기·투명도가 새 마크업과 선택한 마크업에 적용된다', async ({ page }) => {
  await openPdf(page);
  await page.getByTestId('tool-rect').click();
  await page.getByTestId('swatch-1f6fe5').click();
  await page.getByTestId('width-range').fill('6');
  await drag(page, [100, 100], [200, 200]);
  const path = page.locator('[data-kind="rect"] path');
  await expect(path).toHaveAttribute('stroke', '#1f6fe5');
  await expect(path).toHaveAttribute('stroke-width', '6');

  await page.getByTestId('tool-select').click();
  await drag(page, [150, 150], [150, 150], 1); // 클릭 = 선택
  await page.getByTestId('swatch-2fb344').click();
  await page.getByTestId('opacity-range').fill('0.5');
  await expect(path).toHaveAttribute('stroke', '#2fb344');
  await expect(path).toHaveAttribute('stroke-opacity', '0.5');
});

test('5. 축척 설정 후 길이 측정이 그 축척으로 표시된다', async ({ page }) => {
  await openPdf(page);
  await page.getByTestId('tool-calibrate').click();
  // 샘플의 축척 막대: (100, 520) ~ (200, 520) = 100pt = 5 m
  await drag(page, [100, 520], [200, 520]);
  await page.getByTestId('cal-length').fill('5');
  await page.getByTestId('cal-unit').selectOption('m');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByTestId('scale-info')).toContainText('0.05000 m');

  await page.getByTestId('tool-length').click(); // 설정 후 자동으로 바뀌지만 명시적으로
  await drag(page, [200, 300], [400, 300]);
  await expect(page.locator('.measure-label')).toHaveText('10.00 m');
  await expect(rows(page).first()).toContainText('10.00 m');
});

test('6. 목록을 누르면 그 페이지로 가서 선택하고, 목록에서 지울 수 있다', async ({ page }) => {
  await openPdf(page);
  await page.getByTestId('btn-next').click();
  await page.getByTestId('tool-ellipse').click();
  await drag(page, [100, 100], [200, 200]);
  await page.getByTestId('btn-prev').click();
  await page.getByTestId('tool-line').click();
  await drag(page, [100, 100], [300, 100]);
  await expect(rows(page)).toHaveCount(2);

  await rows(page).filter({ hasText: '원' }).click();
  await expect(page.getByTestId('page')).toHaveAttribute('data-page', '2');
  await expect(page.locator('[data-kind="ellipse"] .selection-box')).toHaveCount(1);
  await expect(rows(page).filter({ hasText: '원' })).toHaveClass(/is-selected/);

  await rows(page).filter({ hasText: '원' }).getByTestId('row-delete').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('[data-kind="ellipse"]')).toHaveCount(0);
});

test('7. Ctrl+Z / Ctrl+Y', async ({ page }) => {
  await openPdf(page);
  await page.getByTestId('tool-rect').click();
  await drag(page, [100, 100], [200, 200]);
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(rows(page)).toHaveCount(1);
});

test('8. 저장한 PDF를 다시 열면 같은 위치에 마크업이 보인다', async ({ page }) => {
  await openPdf(page);
  await page.getByTestId('tool-rect').click();
  await page.getByTestId('swatch-e5322d').click();
  await page.getByTestId('width-range').fill('8');
  await drag(page, [300, 200], [500, 400]);
  await page.getByTestId('tool-text').click();
  const p = await toScreen(page, 300, 450);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId('text-input').fill('문 위치 확인 (한글)');
  await page.getByRole('button', { name: '확인' }).click();

  const dl = page.waitForEvent('download');
  await page.getByTestId('btn-save').click();
  const download = await dl;
  expect(download.suggestedFilename()).toBe('sample_markup.pdf');
  // 테스트 결과 폴더 이름(한글)은 Playwright 파일 선택에서 깨지므로 영문 임시 폴더에 저장한다
  const saved = join(await mkdtemp(join(tmpdir(), 'blakpdf-')), 'saved.pdf');
  await download.saveAs(saved);
  await expect(page.getByTestId('toast')).toContainText('저장했습니다');

  const bytes = await readFile(saved);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);

  // 저장본을 새로 열기 → 마크업 없이 열려도 사각형 왼쪽 변(x=300, y=300)이 빨갛게 그려져 있어야 한다
  await page.reload();
  await openPdf(page, saved);
  await expect(rows(page)).toHaveCount(0);
  const [r, g, b] = await pixelAt(page, 300, 300);
  expect(r).toBeGreaterThan(180);
  expect(g).toBeLessThan(120);
  expect(b).toBeLessThan(120);
  // 한글 텍스트도 이미지로 들어가 있다 (글자 주변 빨간 픽셀 존재)
  const hasText = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.page-canvas')!;
    const s = c.width / 842;
    const d = c.getContext('2d')!.getImageData(Math.round(300 * s), Math.round(450 * s), Math.round(150 * s), Math.round(25 * s)).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 120) return true;
    return false;
  });
  expect(hasText).toBe(true);
});
