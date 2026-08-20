/**
 * src/sites/site-xinxwang/BlockRenderer.tsx
 *
 * 按 page JSON 的 blocks 块类型本真渲染新希望官网视觉。
 *
 * 处理的块类型：hero / nav / articleList / paragraph / callout / image / table /
 * form / sourceComment / loginForm / pdfViewer。
 *
 * - 站内链接（nav links / articleList items / sourceComment linkPageId）统一转站内相对路径：
 *   pageId → slug → "slug"。用 react-router 的 Link/navigate。
 * - 图片一律用 PlaceholderImage（@/sites/shared/placeholder），禁止裸 img。
 * - loginForm：调 checkLogin(token, password)，token = 站点 loginTokens 第一项；
 *   成功后由调用方（页面组件）navigate 到后台页。本组件暴露 onLoginSuccess 回调。
 */
import { useState, type ReactElement } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { useSiteBase, sitePath } from '@/sites/shared/siteNav'
import { PlaceholderImage } from '@/sites/shared/placeholder'
import { checkLogin } from '@/sites/shared/answerCheck'
import type { PageBlock } from '@/types'
import { pageIdToPath } from './Layout'

export interface BlockRendererProps {
  blocks: PageBlock[]
  /** 当前页的 loginTokens（若页内有 loginForm 块，由 SitePage 抽出注入）。 */
  loginTokens?: string[]
  /** 登录成功回调（页面据此导航到后台页）。 */
  onLoginSuccess?: () => void
}

export function BlockRenderer({ blocks, loginTokens, onLoginSuccess }: BlockRendererProps): ReactElement {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} loginTokens={loginTokens} onLoginSuccess={onLoginSuccess} />
      ))}
    </>
  )
}

function BlockView({
  block,
  loginTokens,
  onLoginSuccess,
}: {
  block: PageBlock
  loginTokens?: string[]
  onLoginSuccess?: () => void
}): ReactElement | null {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} />
    case 'nav':
      return <NavBlock block={block} />
    case 'articleList':
      return <ArticleListBlock block={block} />
    case 'paragraph':
      return <p className="xw-para">{block.text}</p>
    case 'callout':
      return <CalloutBlock block={block} />
    case 'image':
      return <ImageBlock block={block} />
    case 'table':
      return <TableBlock block={block} />
    case 'form':
      return <FormBlock block={block} />
    case 'sourceComment':
      return <SourceCommentBlock block={block} />
    case 'loginForm':
      return <LoginFormBlock loginTokens={loginTokens} onLoginSuccess={onLoginSuccess} />
    case 'pdfViewer':
      return <PdfBlock block={block} />
    default:
      return null
  }
}

/* ---------- hero ---------- */
function HeroBlock({ block }: { block: Extract<PageBlock, { type: 'hero' }> }): ReactElement {
  if (block.imageAssetId) {
    return (
      <section className="xw-hero xw-hero-with-img">
        <PlaceholderImage
          assetId={block.imageAssetId}
          alt={block.heading}
          style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' } as CSSProperties}
        />
        <div className="xw-hero-body">
          <h1>{block.heading}</h1>
          {block.subheading && <p>{block.subheading}</p>}
        </div>
      </section>
    )
  }
  return (
    <section className="xw-hero">
      <h1>{block.heading}</h1>
      {block.subheading && <p>{block.subheading}</p>}
    </section>
  )
}

/* ---------- callout ---------- */
function CalloutBlock({ block }: { block: Extract<PageBlock, { type: 'callout' }> }): ReactElement {
  const cls = `xw-callout xw-callout-${block.variant}`
  return <div className={cls}>{block.text}</div>
}

/* ---------- image ---------- */
function ImageBlock({ block }: { block: Extract<PageBlock, { type: 'image' }> }): ReactElement {
  return (
    <figure className="xw-image">
      <PlaceholderImage
        assetId={block.assetId}
        alt={block.caption ?? block.assetId}
        caption={block.caption}
      />
      {block.caption && <figcaption className="xw-image-caption">{block.caption}</figcaption>}
    </figure>
  )
}

/* ---------- table ---------- */
function TableBlock({ block }: { block: Extract<PageBlock, { type: 'table' }> }): ReactElement {
  const single = block.headers.length === 1
  return (
    <div className="xw-table-wrap">
      <table className={`xw-table${single ? ' xw-table-single' : ''}`}>
        {!single && (
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- nav ---------- */
function NavBlock({ block }: { block: Extract<PageBlock, { type: 'nav' }> }): ReactElement {
  const base = useSiteBase()
  return (
    <nav className="xw-nav-block">
      {block.links.map((l, i) => (
        <Link key={i} to={sitePath(base, pageIdToPath(l.pageId))}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

/* ---------- articleList ---------- */
function ArticleListBlock({ block }: { block: Extract<PageBlock, { type: 'articleList' }> }): ReactElement {
  const base = useSiteBase()
  return (
    <ul className="xw-article-list">
      {block.items.map((it, i) => (
        <li key={i}>
          <Link to={sitePath(base, pageIdToPath(it.pageId))}>
            <span className="xw-al-title">{it.title}</span>
            {it.date && <span className="xw-al-date">{it.date}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ---------- form ---------- */
function FormBlock({ block }: { block: Extract<PageBlock, { type: 'form' }> }): ReactElement {
  const [submitted, setSubmitted] = useState(false)
  if (submitted) {
    return <div className="xw-form-msg">{block.onSubmitMessage}</div>
  }
  return (
    <form
      className="xw-form"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
      }}
    >
      <div className="xw-form-row">
        <label htmlFor={`xw-${block.formId}-name`}>家长姓名</label>
        <input id={`xw-${block.formId}-name`} type="text" required placeholder="请填写家长姓名" />
      </div>
      <div className="xw-form-row">
        <label htmlFor={`xw-${block.formId}-phone`}>联系电话</label>
        <input id={`xw-${block.formId}-phone`} type="tel" required placeholder="请填写手机号" />
      </div>
      <div className="xw-form-row">
        <label htmlFor={`xw-${block.formId}-child`}>孩子情况简述</label>
        <textarea id={`xw-${block.formId}-child`} rows={4} placeholder="请简要描述孩子目前存在的问题（网瘾/叛逆/厌学等）" />
      </div>
      <button type="submit" className="xw-form-submit">
        提交申请
      </button>
    </form>
  )
}

/* ---------- sourceComment ---------- */
function SourceCommentBlock({ block }: { block: Extract<PageBlock, { type: 'sourceComment' }> }): ReactElement {
  const base = useSiteBase()
  return (
    <div className="xw-source-comment">
      {'/* '}{block.comment}
      {block.linkPageId && (
        <>
          {' · 参见 '}
          <Link to={sitePath(base, pageIdToPath(block.linkPageId))}>相关页面</Link>
        </>
      )}
      {' */'}
    </div>
  )
}

/* ---------- loginForm ---------- */
function LoginFormBlock({
  loginTokens,
  onLoginSuccess,
}: {
  loginTokens?: string[]
  onLoginSuccess?: () => void
}): ReactElement {
  const token = loginTokens?.[0] ?? ''
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!token) {
      setError('系统未配置登录凭据，请联系管理员。')
      return
    }
    setLoading(true)
    setError('')
    // checkLogin 是同步纯函数（无副作用），但保持异步语义以匹配真实登录体验
    const ok = checkLogin(token, pwd)
    setLoading(false)
    if (ok) {
      onLoginSuccess?.()
    } else {
      setError('密码错误。请确认您输入的是8位数字管理员密码。')
      setPwd('')
    }
  }

  return (
    <form className="xw-loginform" onSubmit={submit}>
      <h3 className="xw-loginform-title">管理员登录</h3>
      <p className="xw-loginform-hint">本系统仅授权人员可访问。密码须为8位数字。</p>
      <div className="xw-form-row">
        <label htmlFor="xw-admin-pwd">管理员密码</label>
        <input
          id="xw-admin-pwd"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{8}"
          maxLength={8}
          required
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="请输入8位数字密码"
          autoComplete="off"
        />
      </div>
      <button type="submit" className="xw-form-submit" disabled={loading}>
        {loading ? '验证中…' : '登录后台'}
      </button>
      {error && <div className="xw-loginform-error">{error}</div>}
    </form>
  )
}

/* ---------- pdfViewer ---------- */
function PdfBlock({ block }: { block: Extract<PageBlock, { type: 'pdfViewer' }> }): ReactElement {
  return (
    <div className="xw-pdf">
      <div style={{ fontSize: 32, marginBottom: 8 }}>PDF</div>
      <div>文档加载中：{block.assetId}</div>
      <div style={{ fontSize: 12, marginTop: 8, color: '#b8c0c4' }}>
        如未自动显示，请刷新或联系中心信息科
      </div>
    </div>
  )
}
