let cached: Promise<Uint8Array | undefined> | null = null

/** 저장할 때 PDF에 넣을 한글 글꼴 (Pretendard, OFL) */
export function loadSaveFont(): Promise<Uint8Array | undefined> {
  cached ??= fetch(new URL('./fonts/Pretendard-Regular.ttf', document.baseURI).href)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((b) => new Uint8Array(b))
    .catch(() => undefined)
  return cached
}
