import { Trash2 } from 'lucide-react';
import { formatMeasure, measureLength } from '../markup/measure';
import { KIND_LABEL, type Calibration, type Markup, type Style } from '../markup/types';

export const PALETTE = ['#e5322d', '#f28c28', '#f5d90a', '#2fb344', '#1f6fe5', '#7a3ff2', '#000000', '#ffffff'];

interface PropsPanel {
  style: Style;
  fontSize: number;
  showFont: boolean;
  selectedCount: number;
  onStyle: (patch: Partial<Style>) => void;
  onFontSize: (n: number) => void;
  calibration: Calibration;
  calibrated: boolean;
}

export function PropertiesPanel(p: PropsPanel) {
  return (
    <section className="panel" aria-labelledby="props-title" data-testid="properties">
      <h2 id="props-title" className="panel-title">
        속성 {p.selectedCount > 0 && <span className="muted">· 선택 {p.selectedCount}개에 적용</span>}
      </h2>
      <div className="field">
        <span className="field-label" id="color-label">색</span>
        <div className="swatches" role="group" aria-labelledby="color-label">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${p.style.color.toLowerCase() === c ? 'is-active' : ''}`}
              style={{ background: c }}
              aria-label={`색 ${c}`}
              aria-pressed={p.style.color.toLowerCase() === c}
              data-testid={`swatch-${c.slice(1)}`}
              onClick={() => p.onStyle({ color: c })}
            />
          ))}
          <input type="color" aria-label="직접 색 고르기" value={p.style.color} onChange={(e) => p.onStyle({ color: e.target.value })} />
        </div>
      </div>
      <label className="field">
        <span className="field-label">
          선 굵기 <output data-testid="width-value">{p.style.width}pt</output>
        </span>
        <input type="range" min={0.5} max={20} step={0.5} value={p.style.width} data-testid="width-range" onChange={(e) => p.onStyle({ width: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span className="field-label">
          투명도 <output data-testid="opacity-value">{Math.round(p.style.opacity * 100)}%</output>
        </span>
        <input type="range" min={0.1} max={1} step={0.05} value={p.style.opacity} data-testid="opacity-range" onChange={(e) => p.onStyle({ opacity: Number(e.target.value) })} />
      </label>
      {p.showFont && (
        <label className="field">
          <span className="field-label">
            글자 크기 <output>{p.fontSize}pt</output>
          </span>
          <input type="range" min={6} max={72} step={1} value={p.fontSize} onChange={(e) => p.onFontSize(Number(e.target.value))} />
        </label>
      )}
      <p className="hint" data-testid="scale-info">
        축척: {p.calibrated ? `1pt = ${p.calibration.unitsPerPoint.toPrecision(4)} ${p.calibration.unit}` : '설정 안 됨 (기본 1:1 mm)'}
      </p>
    </section>
  );
}

interface ListProps {
  markups: Markup[];
  selectedIds: string[];
  calibrations: Record<number, Calibration>;
  defaultCalibration: Calibration;
  onPick: (m: Markup) => void;
  onDelete: (id: string) => void;
}

export function describeMarkup(m: Markup, cal: Calibration): string {
  if (m.kind === 'text') return m.text ?? '';
  if (m.kind === 'length') return formatMeasure(measureLength(m.points, cal), cal.unit);
  return '';
}

export function MarkupList(p: ListProps) {
  return (
    <section className="panel panel-grow" aria-labelledby="list-title">
      <h2 id="list-title" className="panel-title">
        마크업 목록 <span className="muted" data-testid="markup-count">{p.markups.length}</span>
      </h2>
      {p.markups.length === 0 ? (
        <p className="empty">아직 마크업이 없습니다. 위 도구 막대에서 도구를 골라 도면 위에 그려 보세요.</p>
      ) : (
        <table className="markup-table" data-testid="markup-list">
          <thead>
            <tr>
              <th scope="col">종류</th>
              <th scope="col">쪽</th>
              <th scope="col">내용</th>
              <th scope="col"><span className="sr-only">삭제</span></th>
            </tr>
          </thead>
          <tbody>
            {p.markups.map((m) => (
              <tr
                key={m.id}
                className={p.selectedIds.includes(m.id) ? 'is-selected' : ''}
                onClick={() => p.onPick(m)}
                data-testid="markup-row"
                data-id={m.id}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && p.onPick(m)}
              >
                <td>
                  <span className="dot" style={{ background: m.style.color }} />
                  {KIND_LABEL[m.kind]}
                </td>
                <td>{m.page}</td>
                <td className="cell-text">{describeMarkup(m, p.calibrations[m.page] ?? p.defaultCalibration)}</td>
                <td>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    aria-label="이 마크업 삭제"
                    data-testid="row-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDelete(m.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
