import { useEffect, useRef } from 'react';
import type { PdfDoc } from '../pdf/loader';
import { renderPage } from '../pdf/loader';

interface Props {
  doc: PdfDoc;
  current: number;
  markupCounts: Record<number, number>;
  onPick: (page: number) => void;
}

export function Thumbnails({ doc, current, markupCounts, onPick }: Props) {
  return (
    <nav className="thumbs" aria-label="페이지 썸네일" data-testid="thumbnails">
      {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`thumb ${n === current ? 'is-active' : ''}`}
          onClick={() => onPick(n)}
          aria-current={n === current ? 'page' : undefined}
          aria-label={`${n}쪽으로 이동`}
        >
          <Thumb doc={doc} pageNumber={n} />
          <span className="thumb-label">
            {n}
            {markupCounts[n] ? <span className="thumb-badge">{markupCounts[n]}</span> : null}
          </span>
        </button>
      ))}
    </nav>
  );
}

function Thumb({ doc, pageNumber }: { doc: PdfDoc; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: ReturnType<typeof renderPage> | null = null;
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled || !ref.current) return;
      const vp = page.getViewport({ scale: 1 });
      task = renderPage(page, ref.current, 120 / vp.width);
      task.promise.catch(() => undefined);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber]);
  return <canvas ref={ref} className="thumb-canvas" />;
}
