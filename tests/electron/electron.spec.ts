import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const SAMPLE = resolve('tests/e2e/fixtures/sample.pdf');

test('9. PC 프로그램: 파일 메뉴로 열고, 마크업하고, 저장한다', async () => {
  const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, BLAKPDF_TEST: '1' } });
  const win = await app.firstWindow();
  await expect(win.getByTestId('welcome-open')).toBeVisible();

  // 파일 메뉴 항목과 단축키
  const menu = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()!.items[0].submenu!.items.filter((i) => i.label).map((i) => `${i.label}|${i.accelerator ?? ''}`),
  );
  expect(menu).toEqual(expect.arrayContaining(['열기...|CmdOrCtrl+O', '저장|CmdOrCtrl+S', '다른 이름으로 저장...|CmdOrCtrl+Shift+S']));

  // 운영체제 열기 창 대신 정해진 파일을 돌려주게 하고, "파일 > 열기" 메뉴를 누른다
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog;
  }, SAMPLE);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items[0].submenu!.items[0].click());
  await expect(win.getByTestId('page-count')).toHaveText('/ 3');
  await expect(win.locator('.page-canvas')).toHaveAttribute('data-rendering', 'false');
  expect(await win.title()).toContain('sample.pdf');

  // 사각형 하나 그리기
  await win.getByTestId('tool-rect').click();
  const box = (await win.getByTestId('overlay').boundingBox())!;
  await win.mouse.move(box.x + 100, box.y + 100);
  await win.mouse.down();
  await win.mouse.move(box.x + 250, box.y + 200, { steps: 5 });
  await win.mouse.up();
  await expect(win.getByTestId('markup-row')).toHaveCount(1);
  await expect.poll(() => win.title()).toContain('*');

  // "파일 > 저장" → 처음 저장은 저장 위치를 묻는다
  const out = join(await mkdtemp(join(tmpdir(), 'blakpdf-')), 'out.pdf');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as typeof dialog.showSaveDialog;
  }, out);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items[0].submenu!.items.find((i) => i.label === '저장')!.click());
  await expect(win.getByTestId('toast')).toContainText('저장했습니다: out.pdf');
  await expect.poll(() => win.title()).not.toContain('*');

  const doc = await PDFDocument.load(await readFile(out));
  expect(doc.getPageCount()).toBe(3);
  await app.close();
});

test('9b. PC 프로그램: Ctrl+O / Ctrl+S / Ctrl+Shift+S 키로 열고 저장한다', async () => {
  const app = await electron.launch({ args: ['.', '--no-sandbox'], env: { ...process.env, BLAKPDF_TEST: '1' } });
  const win = await app.firstWindow();
  await expect(win.getByTestId('welcome-open')).toBeVisible();
  const dir = await mkdtemp(join(tmpdir(), 'blakpdf-'));
  await app.evaluate(({ dialog }, [file, d]) => {
    let n = 0;
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as typeof dialog.showOpenDialog;
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: `${d}/save${++n}.pdf` })) as typeof dialog.showSaveDialog;
  }, [SAMPLE, dir]);

  await win.keyboard.press('Control+o');
  await expect(win.getByTestId('page-count')).toHaveText('/ 3');

  await win.getByTestId('tool-line').click();
  const box = (await win.getByTestId('overlay').boundingBox())!;
  await win.mouse.move(box.x + 50, box.y + 50);
  await win.mouse.down();
  await win.mouse.move(box.x + 200, box.y + 60, { steps: 5 });
  await win.mouse.up();

  await win.keyboard.press('Control+s'); // 첫 저장 → 저장 창 → save1.pdf
  await expect(win.getByTestId('toast')).toContainText('save1.pdf');
  await win.keyboard.press('Control+Shift+s'); // 다른 이름으로 → save2.pdf
  await expect(win.getByTestId('toast')).toContainText('save2.pdf');
  for (const f of ['save1.pdf', 'save2.pdf']) expect((await PDFDocument.load(await readFile(join(dir, f)))).getPageCount()).toBe(3);
  await app.close();
});

