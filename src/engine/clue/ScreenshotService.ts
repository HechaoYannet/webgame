/**
 * src/engine/clue/ScreenshotService.ts
 *
 * 纯前端截图入相册（CLAUDE.md agent 定义 §clue）。
 *
 * 用 html2canvas 对目标 DOM 截图存内存相册（纯前端、零依赖后端）。
 * html2canvas 作为可选依赖懒加载（动态 import），不在主 bundle；若未安装则降级为占位图，
 * 不阻塞游戏——截图是沉浸体验增强，非关键路径。
 */

export interface ScreenshotRecord {
  id: string
  /** 关联线索/证据 id。 */
  clueId?: string
  evidenceId?: string
  /** dataURL（PNG），或占位 base64。 */
  dataUrl: string
  /** 截图标题（线索标题）。 */
  title: string
  createdAt: string
}

const _album: ScreenshotRecord[] = []

/** 取相册全部。 */
export function getAlbum(): readonly ScreenshotRecord[] {
  return _album
}

/** 取某证据关联截图。 */
export function getScreenshotForEvidence(evidenceId: string): ScreenshotRecord | undefined {
  return _album.find((s) => s.evidenceId === evidenceId)
}

/**
 * 对目标 DOM 截图并存相册。
 * html2canvas 懒加载；失败/未安装时写占位（避免阻塞线索注册流程）。
 */
export async function capture(
  el: HTMLElement | null | undefined,
  opts: { id: string; title: string; clueId?: string; evidenceId?: string },
): Promise<ScreenshotRecord> {
  let dataUrl: string
  if (el) {
    try {
      const mod = await import(/* @vite-ignore */ 'html2canvas' as string).catch(() => null)
      // 动态 import 失败（包未装）→ 占位
      const html2canvas = (mod as { default?: typeof import('html2canvas').default } | null)?.default
      if (html2canvas) {
        const canvas = await html2canvas(el, { backgroundColor: '#0a0a0a', scale: 1, logging: false })
        dataUrl = canvas.toDataURL('image/png')
      } else {
        dataUrl = placeholderDataUrl(opts.title)
      }
    } catch {
      dataUrl = placeholderDataUrl(opts.title)
    }
  } else {
    dataUrl = placeholderDataUrl(opts.title)
  }
  const record: ScreenshotRecord = {
    id: opts.id,
    clueId: opts.clueId,
    evidenceId: opts.evidenceId,
    dataUrl,
    title: opts.title,
    createdAt: new Date().toISOString(),
  }
  // 去重：同 id 覆盖
  const idx = _album.findIndex((s) => s.id === opts.id)
  if (idx >= 0) _album[idx] = record
  else _album.push(record)
  return record
}

/** 纯文字占位图（html2canvas 未安装时降级）。 */
function placeholderDataUrl(title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#0a0a0a"/><text x="12" y="80" fill="#888" font-family="sans-serif" font-size="14">${escapeXml(title.slice(0, 20))}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

/** 清空相册。 */
export function resetAlbum(): void {
  _album.length = 0
}
