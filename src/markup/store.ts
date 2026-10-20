import type { Calibration, Markup } from './types';

// 실행 취소/다시 실행을 위해 "문서 상태" 전체를 스냅숏으로 쌓는다.
// 마크업 수가 많아도 배열·객체를 공유(얕은 복사)하므로 메모리 부담이 작다.
export interface DocState {
  markups: Markup[];
  calibrations: Record<number, Calibration>; // 페이지별 축척
}

export interface History {
  past: DocState[];
  present: DocState;
  future: DocState[];
}

export type Action =
  | { type: 'add'; markup: Markup }
  | { type: 'update'; id: string; patch: Partial<Omit<Markup, 'id'>> }
  | { type: 'updateMany'; ids: string[]; patch: Partial<Omit<Markup, 'id'>> }
  | { type: 'remove'; ids: string[] }
  | { type: 'setCalibration'; page: number; calibration: Calibration }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' };

export const HISTORY_LIMIT = 200;

export const emptyDoc: DocState = { markups: [], calibrations: {} };

export function initHistory(doc: DocState = emptyDoc): History {
  return { past: [], present: doc, future: [] };
}

function applyDoc(doc: DocState, action: Action): DocState {
  switch (action.type) {
    case 'add':
      return { ...doc, markups: [...doc.markups, action.markup] };
    case 'update':
      return { ...doc, markups: doc.markups.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) };
    case 'updateMany': {
      const set = new Set(action.ids);
      return { ...doc, markups: doc.markups.map((m) => (set.has(m.id) ? { ...m, ...action.patch } : m)) };
    }
    case 'remove': {
      const set = new Set(action.ids);
      return { ...doc, markups: doc.markups.filter((m) => !set.has(m.id)) };
    }
    case 'setCalibration':
      return { ...doc, calibrations: { ...doc.calibrations, [action.page]: action.calibration } };
    default:
      return doc;
  }
}

export function historyReducer(h: History, action: Action): History {
  switch (action.type) {
    case 'undo': {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    }
    case 'redo': {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    }
    case 'reset':
      return initHistory();
    default: {
      const next = applyDoc(h.present, action);
      if (next === h.present) return h;
      // 아무것도 안 바뀐 동작(없는 id 삭제 등)은 기록하지 않는다
      if (next.markups.length === h.present.markups.length && next.calibrations === h.present.calibrations && next.markups.every((m, i) => m === h.present.markups[i])) return h;
      const past = [...h.past, h.present].slice(-HISTORY_LIMIT);
      return { past, present: next, future: [] };
    }
  }
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}${counter.toString(36)}`;
}
