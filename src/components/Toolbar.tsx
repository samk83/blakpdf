import {
  ArrowUpRight, Circle, Cloud, FolderOpen, Hand, Highlighter, Minus, MousePointer2, PenLine, Redo2, Ruler, Save,
  SaveAll, Square, Type, Undo2, ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight, RulerDimensionLine,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Tool } from '../markup/types';

export const TOOLS: { tool: Tool; label: string; key: string; icon: ReactNode }[] = [
  { tool: 'select', label: '선택', key: 'V', icon: <MousePointer2 size={18} /> },
  { tool: 'pan', label: '이동(손)', key: 'H', icon: <Hand size={18} /> },
  { tool: 'pen', label: '펜', key: 'P', icon: <PenLine size={18} /> },
  { tool: 'highlight', label: '형광펜', key: 'I', icon: <Highlighter size={18} /> },
  { tool: 'line', label: '선', key: 'L', icon: <Minus size={18} /> },
  { tool: 'arrow', label: '화살표', key: 'A', icon: <ArrowUpRight size={18} /> },
  { tool: 'rect', label: '사각형', key: 'R', icon: <Square size={18} /> },
  { tool: 'ellipse', label: '원', key: 'E', icon: <Circle size={18} /> },
  { tool: 'cloud', label: '구름 (리비전 클라우드)', key: 'C', icon: <Cloud size={18} /> },
  { tool: 'text', label: '텍스트', key: 'T', icon: <Type size={18} /> },
  { tool: 'length', label: '길이 측정', key: 'M', icon: <Ruler size={18} /> },
  { tool: 'calibrate', label: '축척 설정 (Calibrate)', key: 'K', icon: <RulerDimensionLine size={18} /> },
];

interface Props {
  hasDoc: boolean;
  tool: Tool;
  onTool: (t: Tool) => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFit: () => void;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}

function IconButton(p: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ${p.active ? 'is-active' : ''}`}
      onClick={p.onClick}
      disabled={p.disabled}
      title={p.label}
      aria-label={p.label}
      aria-pressed={p.active}
      data-testid={p.testId}
    >
      {p.children}
    </button>
  );
}

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
export const clampZoom = (z: number) => Math.min(8, Math.max(0.1, z));
export const nextZoom = (z: number, dir: 1 | -1) =>
  dir > 0 ? (ZOOM_STEPS.find((s) => s > z + 0.001) ?? 8) : ([...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? 0.1);

export function Toolbar(p: Props) {
  const [pageInput, setPageInput] = useState(String(p.page));
  useEffect(() => setPageInput(String(p.page)), [p.page]);

  return (
    <header className="toolbar" role="toolbar" aria-label="도구 막대">
      <div className="tool-group">
        <IconButton label="열기 (Ctrl+O)" onClick={p.onOpen} testId="btn-open">
          <FolderOpen size={18} />
        </IconButton>
        <IconButton label="저장 (Ctrl+S)" onClick={p.onSave} disabled={!p.hasDoc} testId="btn-save">
          <Save size={18} />
        </IconButton>
        <IconButton label="다른 이름으로 저장 (Ctrl+Shift+S)" onClick={p.onSaveAs} disabled={!p.hasDoc} testId="btn-save-as">
          <SaveAll size={18} />
        </IconButton>
      </div>
      <div className="tool-group">
        <IconButton label="실행 취소 (Ctrl+Z)" onClick={p.onUndo} disabled={!p.canUndo} testId="btn-undo">
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="다시 실행 (Ctrl+Y)" onClick={p.onRedo} disabled={!p.canRedo} testId="btn-redo">
          <Redo2 size={18} />
        </IconButton>
      </div>
      <div className="tool-group tools" aria-label="마크업 도구">
        {TOOLS.map((t) => (
          <IconButton key={t.tool} label={`${t.label} (${t.key})`} onClick={() => p.onTool(t.tool)} active={p.tool === t.tool} disabled={!p.hasDoc} testId={`tool-${t.tool}`}>
            {t.icon}
          </IconButton>
        ))}
      </div>
      <div className="spacer" />
      <div className="tool-group">
        <IconButton label="이전 페이지" onClick={() => p.onPage(p.page - 1)} disabled={!p.hasDoc || p.page <= 1} testId="btn-prev">
          <ChevronLeft size={18} />
        </IconButton>
        <form
          className="page-input"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(pageInput, 10);
            if (n >= 1 && n <= p.pageCount) p.onPage(n);
            else setPageInput(String(p.page));
          }}
        >
          <input
            aria-label="페이지 번호"
            data-testid="page-input"
            value={pageInput}
            disabled={!p.hasDoc}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => setPageInput(String(p.page))}
          />
          <span className="muted" data-testid="page-count">/ {p.pageCount}</span>
        </form>
        <IconButton label="다음 페이지" onClick={() => p.onPage(p.page + 1)} disabled={!p.hasDoc || p.page >= p.pageCount} testId="btn-next">
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <div className="tool-group">
        <IconButton label="축소 (Ctrl+-)" onClick={() => p.onZoom(nextZoom(p.zoom, -1))} disabled={!p.hasDoc} testId="btn-zoom-out">
          <ZoomOut size={18} />
        </IconButton>
        <span className="zoom-label" data-testid="zoom-label">{Math.round(p.zoom * 100)}%</span>
        <IconButton label="확대 (Ctrl++)" onClick={() => p.onZoom(nextZoom(p.zoom, 1))} disabled={!p.hasDoc} testId="btn-zoom-in">
          <ZoomIn size={18} />
        </IconButton>
        <IconButton label="폭 맞춤 (Ctrl+0)" onClick={p.onFit} disabled={!p.hasDoc} testId="btn-fit">
          <Maximize size={18} />
        </IconButton>
      </div>
    </header>
  );
}
