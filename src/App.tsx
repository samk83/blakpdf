import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Dialog } from './components/Dialog';
import { PageView } from './components/PageView';
import { MarkupList, PropertiesPanel } from './components/SidePanel';
import { Thumbnails } from './components/Thumbnails';
import { TOOLS, Toolbar, clampZoom, nextZoom } from './components/Toolbar';
import { calibrate, DEFAULT_CALIBRATION, distance } from './markup/measure';
import { historyReducer, initHistory, newId, type DocState } from './markup/store';
import type { Markup, Point, ShapeKind, Style, Tool } from './markup/types';
import { exportPdf } from './pdf/exportPdf';
import { closePdf, getPageSizes, loadPdf, type PageSize, type PdfDoc, type PdfPage } from './pdf/loader';
import { rasterizeText } from './pdf/rasterizeText';
import { isDesktop, markupFileName, openFileDialog, readFile, saveFileDialog, type OpenedFile } from './platform';

const DEFAULT_STYLES: Record<ShapeKind, Style> = {
  pen: { color: '#e5322d', width: 2, opacity: 1 },
  highlight: { color: '#f5d90a', width: 14, opacity: 0.4 },
  line: { color: '#e5322d', width: 2, opacity: 1 },
  arrow: { color: '#e5322d', width: 2, opacity: 1 },
  rect: { color: '#e5322d', width: 2, opacity: 1 },
  ellipse: { color: '#e5322d', width: 2, opacity: 1 },
  cloud: { color: '#e5322d', width: 2, opacity: 1 },
  text: { color: '#e5322d', width: 1, opacity: 1 },
  length: { color: '#1f6fe5', width: 1.5, opacity: 1 },
};

const TOOL_HINT: Partial<Record<Tool, string>> = {
  select: '마크업을 눌러 선택 · 끌어서 이동 · Shift+클릭 여러 개 · Delete 삭제 · 텍스트는 두 번 눌러 고치기',
  pan: '끌어서 화면 이동 (마우스 가운데 버튼으로도 가능)',
  pen: '끌어서 자유롭게 그리기',
  highlight: '끌어서 형광펜 칠하기',
  line: '끌어서 선 그리기 · Shift = 45° 단위',
  arrow: '끌어서 화살표 그리기 · Shift = 45° 단위',
  rect: '끌어서 사각형 그리기',
  ellipse: '끌어서 원 그리기',
  cloud: '끌어서 구름(리비전 클라우드) 그리기',
  text: '글자를 넣을 곳을 누르세요',
  length: '재려는 두 점 사이를 끌어서 길이 측정',
  calibrate: '길이를 알고 있는 두 점 사이를 끈 뒤 실제 길이를 입력하세요',
};

type DialogState =
  | { kind: 'text'; at: Point; editId?: string; value: string }
  | { kind: 'calibrate'; a: Point; b: Point; length: string; unit: string; error?: string }
  | null;

/** 글자를 입력하는 칸에서는 Delete·Ctrl+Z 등을 그 칸에 맡긴다. 슬라이더·색 선택칸은 단축키를 그대로 쓴다 */
function isTextField(el: HTMLElement): boolean {
  if (el.closest('textarea, select, [contenteditable]')) return true;
  const input = el.closest('input');
  return !!input && !['range', 'color', 'checkbox', 'radio', 'button'].includes(input.type);
}

const isDrawTool = (t: Tool): t is ShapeKind => t !== 'select' && t !== 'pan' && t !== 'calibrate';

export default function App() {
  const [file, setFile] = useState<OpenedFile | null>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [page, setPage] = useState<PdfPage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [toolStyles, setToolStyles] = useState(DEFAULT_STYLES);
  const [fontSize, setFontSize] = useState(14);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, dispatch] = useReducer(historyReducer, undefined, () => initHistory());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [savedDoc, setSavedDoc] = useState<DocState>(history.present);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const { markups, calibrations } = history.present;
  const dirty = !!file && history.present !== savedDoc;
  const calibration = calibrations[pageNum] ?? DEFAULT_CALIBRATION;
  const selected = markups.filter((m) => selectedIds.includes(m.id));
  const panelStyle: Style = selected[0]?.style ?? (isDrawTool(tool) ? toolStyles[tool] : toolStyles.pen);
  const panelFont = selected.find((m) => m.kind === 'text')?.fontSize ?? fontSize;
  const pageMarkups = useMemo(() => markups.filter((m) => m.page === pageNum), [markups, pageNum]);
  const markupCounts = useMemo(() => markups.reduce<Record<number, number>>((acc, m) => ({ ...acc, [m.page]: (acc[m.page] ?? 0) + 1 }), {}), [markups]);

  const notify = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => setToast({ text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === 'error' ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- 파일 열기 ----------
  const fitWidth = useCallback((size: PageSize | undefined) => {
    const el = viewerRef.current;
    if (!size || !el) return;
    setZoom(clampZoom((el.clientWidth - 48) / size.width));
  }, []);

  const openBytes = useCallback(
    async (f: OpenedFile) => {
      if (dirty && !window.confirm('저장하지 않은 마크업이 있습니다. 버리고 새 파일을 열까요?')) return;
      setBusy(true);
      try {
        const d = await loadPdf(f.data);
        const s = await getPageSizes(d);
        closePdf(doc);
        dispatch({ type: 'reset' }); // 저장 기준점은 아래 effect가 새 상태로 맞춘다
        setFile(f);
        setDoc(d);
        setSizes(s);
        setPageNum(1);
        setSelectedIds([]);
        setSavedPath(null);
        setTool('select');
        requestAnimationFrame(() => fitWidth(s[0]));
      } catch (e) {
        notify(`PDF를 열 수 없습니다: ${(e as Error).message}. 손상되었거나 암호가 걸린 파일인지 확인해 주세요.`, 'error');
      } finally {
        setBusy(false);
      }
    },
    [dirty, doc, fitWidth, notify],
  );

  // reset 직후 present가 새 객체가 되므로 저장 기준점을 맞춘다
  useEffect(() => {
    if (history.past.length === 0 && history.future.length === 0 && history.present.markups.length === 0) setSavedDoc(history.present);
  }, [history]);

  const onOpen = useCallback(async () => {
    const f = await openFileDialog();
    if (f) await openBytes(f);
  }, [openBytes]);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    doc.getPage(pageNum).then((p) => alive && setPage(p));
    return () => {
      alive = false;
    };
  }, [doc, pageNum]);

  // ---------- 저장 ----------
  const save = useCallback(
    async (asNew: boolean) => {
      if (!file) return;
      setBusy(true);
      try {
        const bytes = await exportPdf(file.data, markups, calibrations, { rasterizeText });
        // 원본 PDF는 덮어쓰지 않는다: 처음 저장은 항상 "다른 이름으로" (기본 이름: 원본_markup.pdf)
        const res = await saveFileDialog(asNew ? null : savedPath, bytes, markupFileName(file.name));
        if (res) {
          setSavedPath(res.path);
          setSavedDoc(history.present);
          notify(`저장했습니다: ${res.name}`);
        }
      } catch (e) {
        notify(`저장하지 못했습니다: ${(e as Error).message}`, 'error');
      } finally {
        setBusy(false);
      }
    },
    [file, markups, calibrations, savedPath, history.present, notify],
  );

  // ---------- 마크업 조작 ----------
  const addMarkup = useCallback((m: Omit<Markup, 'id' | 'createdAt'>) => {
    const full: Markup = { ...m, id: newId(), createdAt: Date.now() };
    dispatch({ type: 'add', markup: full });
  }, []);

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    dispatch({ type: 'remove', ids: selectedIds });
    setSelectedIds([]);
  }, [selectedIds]);

  const onStyle = (patch: Partial<Style>, key?: string) => {
    if (selectedIds.length > 0) dispatch({ type: 'restyle', ids: selectedIds, style: patch, coalesceKey: key && `${key}:${selectedIds.join()}` });
    const target: ShapeKind | null = selected[0]?.kind ?? (isDrawTool(tool) ? tool : null);
    if (target) setToolStyles((s) => ({ ...s, [target]: { ...s[target], ...patch } }));
  };

  const goPage = useCallback(
    (n: number) => {
      if (!doc) return;
      const p = Math.min(doc.numPages, Math.max(1, n));
      setPageNum(p);
      viewerRef.current?.scrollTo({ top: 0 });
    },
    [doc],
  );

  const pickMarkup = (m: Markup) => {
    setTool('select');
    setSelectedIds([m.id]);
    if (m.page !== pageNum) setPageNum(m.page);
  };

  const editTextAt = (p: Point) => {
    const hit = [...pageMarkups].reverse().find((m) => m.kind === 'text' && selectedIds.includes(m.id));
    if (hit) setDialog({ kind: 'text', at: hit.points[0], editId: hit.id, value: hit.text ?? '' });
    else if (tool === 'text') setDialog({ kind: 'text', at: p, value: '' });
  };

  // ---------- 키보드 ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (dialog || isTextField(t)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (ctrl && k === 'z' && !e.shiftKey) dispatch({ type: 'undo' });
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) dispatch({ type: 'redo' });
      else if (ctrl && k === 'o') onOpen(); // PC 프로그램 메뉴는 단축키를 표시만 한다 (electron/main.cjs)
      else if (ctrl && k === 's') save(e.shiftKey);
      else if (ctrl && (k === '=' || k === '+')) setZoom((z) => nextZoom(z, 1));
      else if (ctrl && k === '-') setZoom((z) => nextZoom(z, -1));
      else if (ctrl && k === '0') fitWidth(sizes[pageNum - 1]);
      else if (ctrl) return;
      else if (k === 'delete' || k === 'backspace') removeSelected();
      else if (k === 'escape') {
        setSelectedIds([]);
        setTool('select');
      } else if (k === 'pagedown') goPage(pageNum + 1);
      else if (k === 'pageup') goPage(pageNum - 1);
      else if (doc) {
        const found = TOOLS.find((x) => x.key.toLowerCase() === k);
        if (!found) return;
        setTool(found.tool);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onOpen, save, fitWidth, sizes, pageNum, removeSelected, goPage, doc]);

  // Ctrl+휠 = 확대/축소 (passive가 아닌 리스너여야 기본 스크롤을 막을 수 있다)
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---------- PC 프로그램(Electron) 연결 ----------
  useEffect(() => {
    if (!window.blakpdf) return;
    return window.blakpdf.onMenu((cmd) => {
      if (cmd === 'open') onOpen();
      if (cmd === 'save') save(false);
      if (cmd === 'saveAs') save(true);
    });
  }, [onOpen, save]);

  useEffect(() => {
    const title = file ? `${file.name}${dirty ? ' *' : ''} - blakpdf` : 'blakpdf';
    document.title = title;
    window.blakpdf?.setTitle(title);
    window.blakpdf?.setDirty(dirty);
  }, [file, dirty]);

  useEffect(() => {
    if (isDesktop()) return; // PC 프로그램은 창 닫기 확인을 main 프로세스가 한다
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---------- 대화상자 ----------
  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'text') {
      const text = dialog.value.trim();
      if (dialog.editId) {
        if (text) dispatch({ type: 'update', id: dialog.editId, patch: { text } });
        else dispatch({ type: 'remove', ids: [dialog.editId] });
      } else if (text) {
        addMarkup({ kind: 'text', page: pageNum, points: [dialog.at], style: { ...toolStyles.text }, text, fontSize });
      }
      setDialog(null);
      return;
    }
    const len = Number(dialog.length.replace(',', '.'));
    try {
      const cal = calibrate(dialog.a, dialog.b, len, dialog.unit.trim() || 'm');
      dispatch({ type: 'setCalibration', page: pageNum, calibration: cal });
      setDialog(null);
      setTool('length');
      notify(`${pageNum}쪽 축척을 설정했습니다. 이제 길이 측정 도구로 재 보세요.`);
    } catch (e) {
      setDialog({ ...dialog, error: (e as Error).message });
    }
  };

  const size = sizes[pageNum - 1];

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = [...e.dataTransfer.files].find((x) => /\.pdf$/i.test(x.name) || x.type === 'application/pdf');
        if (f) await openBytes(await readFile(f));
        else if (e.dataTransfer.files.length) notify('PDF 파일만 열 수 있습니다.', 'error');
      }}
    >
      <Toolbar
        hasDoc={!!doc}
        tool={tool}
        onTool={(t) => {
          setTool(t);
          if (t !== 'select') setSelectedIds([]);
        }}
        onOpen={onOpen}
        onSave={() => save(false)}
        onSaveAs={() => save(true)}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        zoom={zoom}
        onZoom={(z) => setZoom(clampZoom(z))}
        onFit={() => fitWidth(size)}
        page={pageNum}
        pageCount={doc?.numPages ?? 0}
        onPage={goPage}
      />
      <div className="workspace">
        <aside className="sidebar">{doc && <Thumbnails doc={doc} current={pageNum} markupCounts={markupCounts} onPick={goPage} />}</aside>
        <main
          className="viewer"
          ref={viewerRef}
          data-testid="viewer"
          onDoubleClick={(e) => {
            const svg = (e.target as Element).closest('svg.page-overlay');
            if (!svg) return;
            const r = svg.getBoundingClientRect();
            editTextAt({ x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom });
          }}
        >
          {doc && size ? (
            <PageView
              page={page && page.pageNumber === pageNum ? page : null}
              pageNumber={pageNum}
              size={size}
              zoom={zoom}
              tool={tool}
              style={isDrawTool(tool) ? toolStyles[tool] : toolStyles.pen}
              fontSize={fontSize}
              markups={pageMarkups}
              selectedIds={selectedIds}
              calibration={calibration}
              onAdd={addMarkup}
              onSelect={setSelectedIds}
              onMove={(ids, dx, dy) => dispatch({ type: 'translate', ids, dx, dy })}
              onRequestText={(at) => setDialog({ kind: 'text', at, value: '' })}
              onRequestCalibrate={(a, b) => setDialog({ kind: 'calibrate', a, b, length: '', unit: calibrations[pageNum]?.unit ?? 'm' })}
              onCursor={setCursor}
              onPan={(dx, dy) => viewerRef.current?.scrollBy(dx, dy)}
            />
          ) : (
            <div className="welcome">
              <h1>blakpdf</h1>
              <p>도면·문서 PDF를 열어 마크업하고, 길이를 재고, 마크업이 들어간 PDF로 저장합니다.</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={onOpen} data-testid="welcome-open">
                PDF 열기 (Ctrl+O)
              </button>
              <p className="muted">또는 PDF 파일을 이 창으로 끌어다 놓으세요.</p>
            </div>
          )}
          {busy && <div className="busy" role="status">처리 중…</div>}
        </main>
        <aside className="right">
          <PropertiesPanel
            style={panelStyle}
            fontSize={panelFont}
            showFont={tool === 'text' || selected.some((m) => m.kind === 'text')}
            selectedCount={selected.length}
            onStyle={(patch) => onStyle(patch, Object.keys(patch).join())}
            onFontSize={(n) => {
              setFontSize(n);
              const textIds = selected.filter((m) => m.kind === 'text').map((m) => m.id);
              if (textIds.length) dispatch({ type: 'restyle', ids: textIds, style: {}, fontSize: n, coalesceKey: `font:${textIds.join()}` });
            }}
            calibration={calibration}
            calibrated={!!calibrations[pageNum]}
          />
          <MarkupList
            markups={markups}
            selectedIds={selectedIds}
            calibrations={calibrations}
            defaultCalibration={DEFAULT_CALIBRATION}
            onPick={pickMarkup}
            onDelete={(id) => {
              dispatch({ type: 'remove', ids: [id] });
              setSelectedIds((s) => s.filter((x) => x !== id));
            }}
          />
        </aside>
      </div>
      <footer className="statusbar" data-testid="statusbar">
        <span>{doc ? TOOL_HINT[tool] : '파일을 열어 주세요'}</span>
        <span className="spacer" />
        {cursor && size && (
          <span className="mono">
            X {cursor.x.toFixed(0)} · Y {cursor.y.toFixed(0)} pt
          </span>
        )}
        {file && <span>{file.name}{dirty ? ' · 저장 안 됨' : ''}</span>}
      </footer>

      {dialog?.kind === 'text' && (
        <Dialog title={dialog.editId ? '텍스트 고치기' : '텍스트 넣기'} onCancel={() => setDialog(null)} onSubmit={submitDialog}>
          <textarea
            className="input"
            rows={4}
            data-testid="text-input"
            value={dialog.value}
            placeholder="내용을 입력하세요 (Ctrl+Enter = 확인)"
            onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
          />
        </Dialog>
      )}
      {dialog?.kind === 'calibrate' && (
        <Dialog title="축척 설정 (Calibrate)" onCancel={() => setDialog(null)} onSubmit={submitDialog} submitLabel="설정">
          <p className="hint">방금 그은 선의 실제 길이를 입력하세요. (도면상 {distance(dialog.a, dialog.b).toFixed(1)} pt)</p>
          <div className="row">
            <input
              className="input"
              inputMode="decimal"
              aria-label="실제 길이"
              data-testid="cal-length"
              value={dialog.length}
              placeholder="예: 5"
              onChange={(e) => setDialog({ ...dialog, length: e.target.value, error: undefined })}
            />
            <select className="input" aria-label="단위" data-testid="cal-unit" value={dialog.unit} onChange={(e) => setDialog({ ...dialog, unit: e.target.value })}>
              {['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd'].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          {dialog.error && <p className="error" role="alert">{dialog.error}</p>}
        </Dialog>
      )}
      {dragOver && <div className="drop-hint">여기에 놓으면 PDF를 엽니다</div>}
      {toast && (
        <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'} data-testid="toast">
          {toast.text}
        </div>
      )}
    </div>
  );
}
