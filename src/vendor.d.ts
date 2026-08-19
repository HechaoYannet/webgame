/**
 * src/vendor.d.ts — 可选第三方依赖的 ambient 模块声明（Phase4 整合）。
 *
 * pdfjs-dist 已加入 dependencies（package.json），消费代码
 * （BrowserApp/PdfViewer.tsx）静态 import 包自带类型接管，无需本文件声明。
 *
 * html2canvas 仍作为 engine/clue/ScreenshotService.ts 的可选懒加载依赖（动态
 * import() + try/catch 守卫，运行时缺失则降级占位）。无 ambient 声明时
 * `tsc --noEmit` 会报 TS2307，本文件作为**全局脚本**（无顶层 import/export）
 * 让 `declare module` 生效为全局 ambient 模块声明。
 *
 * 本文件是 type-only ambient declaration，零运行时影响。
 * 若日后把 html2canvas 从动态 import 改为静态 import，删除本文件中对应声明，
 * 由包自带类型接管。
 */

declare module 'html2canvas' {
  const html2canvas: (
    element: HTMLElement,
    options?: Record<string, unknown>,
  ) => Promise<HTMLCanvasElement>
  export default html2canvas
}
