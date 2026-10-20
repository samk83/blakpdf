// pdf.js 보조 파일(글꼴·문자표·wasm)과 저장용 글꼴을 public/ 으로 복사한다. dev/build 전에 자동 실행.
import { cpSync, mkdirSync, copyFileSync } from 'node:fs'

const src = 'node_modules/pdfjs-dist'
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(`${src}/${dir}`, `public/pdfjs/${dir}`, { recursive: true })
}
mkdirSync('public/fonts', { recursive: true })
copyFileSync('node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf', 'public/fonts/Pretendard-Regular.ttf')
copyFileSync('tests/fixtures/sample-plan.pdf', 'public/sample-plan.pdf')
console.log('assets copied → public/')
