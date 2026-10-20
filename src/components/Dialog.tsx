import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
}

/** 공통 모달 창. Enter=확인(텍스트 영역은 Ctrl+Enter), Esc=취소 */
export function Dialog({ title, children, onSubmit, onCancel, submitLabel = '확인' }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    return () => opener?.focus?.(); // 닫으면 원래 자리로 포커스를 돌려준다
  }, []);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          if (e.key === 'Enter' && e.ctrlKey) onSubmit();
          if (e.key === 'Tab') {
            // 포커스가 창 밖으로 나가지 않게 돌린다
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>('input, textarea, select, button')];
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
          e.stopPropagation();
        }}
      >
        <h2 className="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
