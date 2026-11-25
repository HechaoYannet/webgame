/**
 * site-ai-pdf —— 论文 AI 翻译解读工具站（仿 AI 论文解读工具）。
 *
 * 两页内容（经 getPageContent 取自 public/data/browser/pages/）:
 *  - page-ai-pdf-home   工具首页（功能介绍 + 上传校验，本站默认落地页）
 *  - page-ai-interpret  解读结果页（上传校验通过后展示的 AI 解读文章，含实验室后台
 *    lab.shanhe-med.cn/admin / 账号 admin / 密码=基金号后6位 线索）
 *
 * 无 loginForm block，无后台，无登录门控——首页公开，解读结果由上传校验成功后跳转到达。
 *
 * 核心交互（home 页）：
 *  - 选 PDF → crypto.subtle.digest("SHA-256") 算 sha256 hex 小写 → 与 EXPECTED_PAPER_SHA256 比对。
 *  - 占位态（EXPECTED_PAPER_SHA256 以 "TODO" 开头）：放行任意 PDF（开发期不卡死，仅提示占位宽松通过）。
 *  - 生产态（回填真实 hex）：严格匹配，失配则提示"文件哈希不匹配"。
 *  - 校验通过 → navigate(result) + reportPuzzleSolved("puzzle-upload-paper")（站点唯一触游戏状态处）。
 *
 * 站内导航：<Route> 相对 path；链接用 sitePath(useSiteBase(), ...) 绝对路径（修过 404 累积 bug）。
 *
 * 边界（强制）: 仅 import react / react-router / @/sites/shared 子目录 / @/types / 本目录。
 * 严禁 import @/engine、@/game、@/data/loader、@/ui、@/utils、src/apps、@/sites/sitePage。
 * 游戏回调只能经 @/sites/shared/gameEvent 间接调 reportPuzzleSolved。
 */
import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router'
import { getPageContent, type SitePage } from '@/sites/shared/pageContent'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import { reportEvidenceCollected, reportPuzzleSolved } from '@/sites/shared/gameEvent'
import type { PageBlock } from '@/types'
import { Layout } from './Layout'
import { BlockView } from './BlockView'
import { EXPECTED_PAPER_SHA256 } from './manifest'

export const siteId = 'site-ai-pdf'

/** 上传谜题 id（puzzles.json 单一真源 puzzle-upload-paper）。校验通过时上报游戏已解。 */
const UPLOAD_PUZZLE_ID = 'puzzle-upload-paper'

/** 占位态判定：预期哈希以 "TODO" 开头 = 待回填，放行任意 PDF。 */
function isPlaceholderHash(hash: string): boolean {
  return hash.startsWith('TODO')
}

/** 把 ArrayBuffer 转 hex 小写字符串。 */
function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex.toLowerCase()
}

export default function AiPdfSite(): ReactElement {
  const base = useSiteBase()
  return (
    <Layout>
      <Routes>
        <Route index element={<Navigate to={sitePath(base, 'home')} replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="result" element={<ResultPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

/** 工具首页（page-ai-pdf-home）：渲染介绍 blocks + 上传校验交互。 */
function HomePage(): ReactElement {
  const base = useSiteBase()
  const navigate = useNavigate()
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)
  const [status, setStatus] = useState<'idle' | 'verifying' | 'ok' | 'fail'>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    void getPageContent('page-ai-pdf-home').then((p) => {
      if (!alive) return
      setPage(p)
    })
    return () => {
      alive = false
    }
  }, [])

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus('verifying')
    setErrMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', buf)
      const hex = bufferToHex(digest)
      if (isPlaceholderHash(EXPECTED_PAPER_SHA256)) {
        // 占位态：待用户提供真 paper-source-crystal.pdf 后回填真实 sha256。
        // 开发期放行任意 PDF，仅提示占位宽松通过；生产回填后严格匹配（走下方 else 分支）。
        setStatus('ok')
        reportPuzzleSolved(UPLOAD_PUZZLE_ID)
        reportEvidenceCollected('ev-paper-pdf')
        navigate(sitePath(base, 'result'))
        return
      }
      if (hex === EXPECTED_PAPER_SHA256) {
        // 生产态：哈希严格匹配 → 通过
        setStatus('ok')
        reportPuzzleSolved(UPLOAD_PUZZLE_ID)
        reportEvidenceCollected('ev-paper-pdf')
        navigate(sitePath(base, 'result'))
        return
      }
      setStatus('fail')
      setErrMsg('AI解读失败；换一个 PDF 试试。')
    } catch (err) {
      setStatus('fail')
      setErrMsg('文件读取失败，请重试。')
      console.warn('[site-ai-pdf] sha256 校验异常', err)
    }
  }

  if (page === undefined) {
    return <div className="site-ai-pdf-loading">加载中…</div>
  }
  if (page === null) {
    return <NotFound />
  }

  return (
    <div className="site-ai-pdf-content">
      {/* 渲染介绍文案 blocks（hero / callout / paragraph） */}
      {page.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}

      {/* 上传区：仿 AI 工具的拖拽式上传框 */}
      <div className="site-ai-pdf-upload">
        <p className="site-ai-pdf-upload-title">选择论文 PDF</p>
        <p className="site-ai-pdf-upload-hint">支持各种学术论文 PDF 格式</p>
        <input
          ref={inputRef}
          className="site-ai-pdf-upload-input"
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            void onFileChange(e)
          }}
        />
        <button
          type="button"
          className="site-ai-pdf-upload-btn"
          disabled={status === 'verifying'}
          onClick={() => inputRef.current?.click()}
        >
          {status === 'verifying' ? '校验中…' : '选择论文 PDF'}
        </button>

        <div className="site-ai-pdf-upload-status">
          {fileName && status === 'verifying' && (
            <div>
              <span className="site-ai-pdf-upload-file">{fileName}</span>
              {' · '}
              <span className="site-ai-pdf-upload-verifying">正在计算哈希…</span>
            </div>
          )}
          {fileName && status === 'ok' && (
            <div className="site-ai-pdf-upload-file">{fileName} · 校验通过，生成解读中…</div>
          )}
          {status === 'fail' && errMsg && (
            <div className="site-ai-pdf-upload-error">{errMsg}</div>
          )}
        </div>


      </div>
    </div>
  )
}

/** 解读结果页（page-ai-interpret）：取解读文章 blocks，用 BlockView 渲染。 */
function ResultPage(): ReactElement {
  const base = useSiteBase()
  const [page, setPage] = useState<SitePage | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void getPageContent('page-ai-interpret').then((p) => {
      if (!alive) return
      setPage(p)
    })
    return () => {
      alive = false
    }
  }, [])

  // 查看解读结果 → 归档论文证据（幂等；上传成功路径已收集，此处兜底回看）。
  useEffect(() => {
    if (page) reportEvidenceCollected('ev-paper-pdf')
  }, [page])

  if (page === undefined) {
    return <div className="site-ai-pdf-loading">加载中…</div>
  }
  if (page === null) {
    return <NotFound />
  }

  return (
    <div className="site-ai-pdf-content">
      <div className="site-ai-pdf-crumb">
        <a href={sitePath(base, 'home')}>首页</a>
        <span className="site-ai-pdf-crumb-sep">›</span>
        <span>AI 解读结果</span>
      </div>

      {page.blocks.map((b: PageBlock, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  )
}

function NotFound(): ReactElement {
  const base = useSiteBase()
  return (
    <div className="site-ai-pdf-notfound">
      <div style={{ fontSize: 44, marginBottom: 10 }}>404</div>
      <div>页面未找到</div>
      <div style={{ marginTop: 12 }}>
        <a href={sitePath(base, 'home')}>返回工具首页</a>
      </div>
    </div>
  )
}
