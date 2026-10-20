import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { exportPdf } from '../../src/pdf/exportPdf';
import type { Markup, ShapeKind } from '../../src/markup/types';
import { makeSamplePdf } from '../fixtures';

const mk = (kind: ShapeKind, page: number, extra: Partial<Markup> = {}): Markup => ({
  id: `${kind}${page}`,
  kind,
  page,
  points: [{ x: 100, y: 100 }, { x: 300, y: 200 }],
  style: { color: '#e5322d', width: 2, opacity: 0.8 },
  createdAt: 0,
  ...extra,
});

async function pageContent(bytes: Uint8Array, index: number): Promise<string> {
  // 페이지 내용 스트림(압축되어 있으면 풀어서)을 문자열로 확인
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[index];
  const contents = page.node.Contents();
  const text: string[] = [];
  const collect = (ref: unknown) => {
    const obj = doc.context.lookup(ref as never) as { getContents?: () => Uint8Array; asArray?: () => unknown[] } | undefined;
    if (obj?.asArray) obj.asArray().forEach(collect);
    else if (obj?.getContents) {
      const raw = obj.getContents();
      const flate = obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Filter')) === PDFName.of('FlateDecode');
      text.push(new TextDecoder('latin1').decode(flate ? inflateSync(raw) : raw));
    }
  };
  if (contents) collect(contents);
  return text.join('\n');
}

describe('PDF 저장', () => {
  it('모든 종류의 마크업을 그려 넣고 페이지 수를 유지한다', async () => {
    const src = await makeSamplePdf(2);
    const markups: Markup[] = [
      ...(['pen', 'highlight', 'line', 'arrow', 'rect', 'ellipse', 'cloud', 'length'] as ShapeKind[]).map((k) => mk(k, 1)),
      mk('text', 2, { points: [{ x: 50, y: 50 }], text: 'CHECK THIS', fontSize: 14 }),
    ];
    const out = await exportPdf(src, markups, { 1: { unitsPerPoint: 0.05, unit: 'm' } });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);

    const p1 = await pageContent(out, 0);
    const p2 = await pageContent(out, 1);
    // 빨간색 선 색상 (0.898 0.196 0.176 RG) 이 1쪽에 그려짐
    expect(p1).toMatch(/0\.89\d* 0\.19\d* 0\.17\d* RG/);
    // 길이 측정 라벨: 거리 sqrt(200²+100²)=223.6pt × 0.05 = 11.18 m
    expect(p1).toContain('11.18 m'.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase());
    // 텍스트는 2쪽에만
    expect(p2).toContain('CHECK THIS'.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase());
  });

  it('원본 바이트는 바꾸지 않는다', async () => {
    const src = await makeSamplePdf(1);
    const copy = src.slice();
    await exportPdf(src, [mk('rect', 1)], {});
    expect(src).toEqual(copy);
  });

  it('한글 텍스트는 이미지 변환 함수가 있으면 이미지로 넣는다', async () => {
    const src = await makeSamplePdf(1);
    // 1x1 투명 PNG
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    let called = 0;
    const out = await exportPdf(src, [mk('text', 1, { points: [{ x: 10, y: 10 }], text: '확인 필요' })], {}, {
      rasterizeText: async () => {
        called++;
        return { png, width: 40, height: 14 };
      },
    });
    expect(called).toBe(1);
    expect(await pageContent(out, 0)).toMatch(/ Do\b/);
  });

  it('이미지 변환 함수 없이 한글이면 알기 쉬운 오류', async () => {
    const src = await makeSamplePdf(1);
    await expect(exportPdf(src, [mk('text', 1, { points: [{ x: 10, y: 10 }], text: '확인' })], {})).rejects.toThrow('PDF 기본 글꼴');
  });
});
