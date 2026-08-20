/**
 * src/apps/QqApp/GroupFiles.tsx — QQ 群文件（frontend-qq 独占。信息架构 §3.3）。
 *
 * 读 data/qq/group-files.json（writer-qq 自描述结构，loader 无 getter，直接 fetch）。
 *
 * 文件类型：
 *   - pdf：点击打开 PDF 门禁；加密 PDF（心理筛查通知 gf-screening-notice-pdf，对应
 *     puzzle-pdf-screening，答案 0312 在 puzzles.json，@/game/answerCheck 校验）需先输密码
 *   - image：点击放大（查看即取证的装饰已废）
 *   - xlsx/link：展示信息
 * relatePageId 文件提示"对应官网页面"（pageId 由 BrowserApp 处理，§6.4 不外跳）。
 */
import { useState } from 'react'
import { getContact } from '@/data/loader'
import { checkAnswer } from '@/game/answerCheck'
import { useGameStore } from '@/game/gameStore'
import { openSitePage } from '@/sites/sitePage'
import { PUZZLE_PDF_SCREENING } from './qqConstants'
import type { QqGroupFile } from './qqData'
import { loadGroupFiles } from './qqData'
import {
  Avatar,
  EmptyState,
  ErrorState,
  ImageViewer,
  Loading,
  formatTime,
  useAsync,
} from './components'

export function GroupFiles() {
  const { data: gf, error } = useAsync(loadGroupFiles, [])
  const [zoomAsset, setZoomAsset] = useState<{ assetId: string; alt: string } | null>(null)
  const [openPdf, setOpenPdf] = useState<QqGroupFile | null>(null)

  if (error) return <ErrorState text={`加载群文件失败：${error}`} />
  if (!gf) return <Loading text="加载群文件…" />
  if (gf.groups.length === 0) return <EmptyState text="暂无群文件" />

  return (
    <div className="qq-groupfiles">
      <h2 className="qq-panel-title">群文件</h2>
      {gf.groups.map((g) => (
        <section key={g.threadId} className="qq-groupfiles-group">
          <h3 className="qq-groupfiles-group-title">{g.title}</h3>
          <ul className="qq-groupfiles-list">
            {g.files.map((f) => (
              <GroupFileRow
                key={f.id}
                file={f}
                onOpenPdf={() => setOpenPdf(f)}
                onZoomImage={(assetId) => setZoomAsset({ assetId, alt: f.name })}
              />
            ))}
          </ul>
        </section>
      ))}

      {zoomAsset && (
        <ImageViewer assetId={zoomAsset.assetId} alt={zoomAsset.alt} onClose={() => setZoomAsset(null)} />
      )}
      {openPdf && <PdfGate file={openPdf} onClose={() => setOpenPdf(null)} />}
    </div>
  )
}

function GroupFileRow({
  file: f,
  onOpenPdf,
  onZoomImage,
}: {
  file: QqGroupFile
  onOpenPdf: () => void
  onZoomImage: (assetId: string) => void
}) {
  const uploader = getContact(f.uploaderCharacterId)
  const uploaderName = uploader?.displayName ?? uploader?.name ?? f.uploaderCharacterId
  const typeLabel: Record<QqGroupFile['type'], string> = {
    pdf: 'PDF',
    xlsx: '表格',
    image: '图片',
    link: '链接',
  }

  function handleClick() {
    // 重写后线索注册装饰已废：查看群文件不再注册线索。PDF 门禁与图片放大逻辑保留。
    if (f.type === 'pdf') onOpenPdf()
    else if (f.type === 'image' && f.assetId) onZoomImage(f.assetId)
  }

  return (
    <li className="qq-groupfile-row" onClick={handleClick}>
      <div className={`qq-groupfile-icon ${f.type}`}>{typeLabel[f.type]}</div>
      <div className="qq-groupfile-info">
        <div className="qq-groupfile-name">
          {f.name}
          {f.type === 'pdf' && <span className="qq-groupfile-tag">PDF</span>}
          {f.type === 'image' && <span className="qq-groupfile-tag img">点击放大</span>}
          {f.type === 'link' && <span className="qq-groupfile-tag link">仅显示</span>}
        </div>
        <div className="qq-groupfile-meta">
          <Avatar charId={f.uploaderCharacterId} name={uploaderName} size={16} />
          <span>{uploaderName}</span>
          <span>·</span>
          <span>{formatTime(f.uploadedAt)}</span>
          <span>·</span>
          <span>{f.sizeKB}KB</span>
        </div>
        {/* {f.relatePageId && (

          
          <button
            type="button"
            className="qq-groupfile-note qq-groupfile-link-btn"
            onClick={() => openSitePage(f.relatePageId!)}
          >
            对应官网页面（{f.relatePageId}）›
          </button>
        )} */}
        {f.note && <div className="qq-groupfile-note">{f.note}</div>}
        {f.link && (
          <div className="qq-groupfile-link"
          onClick={() => openSitePage("https://endfield.hypergryph.com/news/1181")}
          >
            <div className="qq-groupfile-link-title">{f.link.title}</div>
            {f.link.url && <div className="qq-groupfile-link-url">{f.link.url}</div>}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * PDF 门禁：加密 PDF（心理筛查通知 gf-screening-notice-pdf）需 checkAnswer
 * puzzle-pdf-screening 密码（0312，由 puzzles.json + @/game/answerCheck 校验，前端不持答案）。
 * 解密成功后在本组件内嵌展示占位 PDF 内容（FilesApp 已删，不再外部渲染）。
 */
function PdfGate({ file, onClose }: { file: QqGroupFile; onClose: () => void }) {
  const solved = useGameStore((s) => s.solvedPuzzleIds.includes(PUZZLE_PDF_SCREENING))
  const finished = useGameStore((s) => s.finished)
  const markPuzzleSolved = useGameStore((s) => s.markPuzzleSolved)
  const [pwd, setPwd] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // 该 PDF 是否对应加密谜题：screening-notice-pdf 关联 page-lvzhong-screening-pdf
  // 非加密 PDF 直接展示。
  const needsPassword = file.id === 'gf-screening-notice-pdf'
  const unlocked = !needsPassword || solved

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!pwd) return
    if (finished) {
      setToast('游戏已结束，无法解密。')
      return
    }
    const ok = checkAnswer(PUZZLE_PDF_SCREENING, pwd.trim())
    if (ok) {
      markPuzzleSolved(PUZZLE_PDF_SCREENING)
      setToast(null)
      setPwd('')
    } else {
      setToast('密码错误，请重试。')
      setPwd('')
    }
  }

  return (
    <div className="qq-pdf-gate" onClick={onClose} role="dialog" aria-label="PDF 查看">
      <div className="qq-pdf-gate-inner" onClick={(e) => e.stopPropagation()}>
        <header className="qq-pdf-gate-head">
          <span className="qq-pdf-gate-title">{file.name}</span>
          <button type="button" className="qq-pdf-gate-close" onClick={onClose}>
            ×
          </button>
        </header>
        {needsPassword && !unlocked ? (
          <div className="qq-pdf-gate-unlock">
            <p className="qq-pdf-gate-hint">该 PDF 已加密，请输入密码：</p>
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                className="qq-field-input"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="请输入 PDF 密码"
                autoFocus
                autoComplete="off"
                inputMode="numeric"
                disabled={finished}
              />
              <button
                type="submit"
                className="qq-pdf-gate-submit"
                disabled={!pwd || finished}
              >
                解密
              </button>
            </form>
            {toast && <div className="qq-toast error">{toast}</div>}
            {file.note && <p className="qq-pdf-gate-note">{file.note}</p>}
          </div>
        ) : (
          <div className="qq-pdf-gate-content">
            <p className="qq-pdf-gate-content-label">【PDF 预览】</p>
            <p className="qq-pdf-gate-content-body">
              {file.note ?? `${file.name}（已${unlocked ? '解密' : '打开'}，详细内容由 PDF 即时渲染）`}
            </p>
            <p className="qq-pdf-gate-content-hint">
              提示：完整 PDF 可在「文件」App 中查看完整页面（pdfViewer）。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
