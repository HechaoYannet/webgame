/**
 * site-hnga blocks 渲染器 —— 把 PageBlock[] 按"政务门户"身份本真渲染。
 *
 * 覆盖全部块类型：hero / paragraph / callout / image / table / form /
 * sourceComment / loginForm / pdfViewer / nav / articleList。
 * 登录表单调 @/sites/shared/answerCheck.checkLogin(token, password)，
 * 通过则跳站内 admin 页（本站 JSON 无 loginForm，故实践中不会出现；但留全实现）。
 *
 * 约束：只用 react、react-router、@/sites/shared、@/types、本目录文件。
 */
import { useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { checkLogin } from '@/sites/shared/answerCheck'
import { PlaceholderImage, PlaceholderPdf } from '@/sites/shared/placeholder'
import { sitePath, useSiteBase } from '@/sites/shared/siteNav'
import type { PageBlock } from '@/types'

/** 渲染整组块。 */
export function BlockList({ blocks }: { blocks: PageBlock[] }): JSX.Element {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  )
}

function BlockView({ block }: { block: PageBlock }): JSX.Element | null {
  const base = useSiteBase()
  switch (block.type) {
    case 'hero':
      return (
        <header className="hnga-hero">
          {block.imageAssetId && (
            <PlaceholderImage
              assetId={block.imageAssetId}
              alt={block.heading}
              className="hnga-hero-img"
            />
          )}
          <h2 className="hnga-hero-heading">{block.heading}</h2>
          {block.subheading && <p className="hnga-hero-sub">{block.subheading}</p>}
        </header>
      )

    case 'paragraph':
      return <p className="hnga-paragraph">{block.text}</p>

    case 'callout': {
      const cls =
        block.variant === 'warning'
          ? 'hnga-callout is-warning'
          : block.variant === 'danger'
            ? 'hnga-callout is-danger'
            : 'hnga-callout'
      return <div className={cls}>{block.text}</div>
    }

    case 'image':
      return (
        <figure className="hnga-image">
          <PlaceholderImage assetId={block.assetId} alt={block.caption ?? ''} />
          {block.caption && <figcaption className="hnga-image-caption">{block.caption}</figcaption>}
        </figure>
      )

    case 'table':
      return (
        <table className="hnga-table">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
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
      )

    case 'form':
      return <FormBlock formId={block.formId} onSubmitMessage={block.onSubmitMessage} />

    case 'sourceComment':
      return (
        <pre className="hnga-sourcecomment">
          {block.comment}
          {block.linkPageId && (
            <>
              {'\n'}
              <Link to={sitePath(base, pageIdToPath(block.linkPageId))}>查看相关页面</Link>
            </>
          )}
        </pre>
      )

    case 'loginForm':
      return <LoginFormBlock tokenHint="" />

    case 'pdfViewer':
      return (
        <div className="hnga-pdfviewer">
          <PlaceholderPdf assetId={block.assetId} style={pdfStyle} />
        </div>
      )

    case 'nav':
      return (
        <nav className="hnga-nav-block" aria-label="站内导航">
          <ul>
            {block.links.map((l, i) => (
              <li key={i}>
                <Link to={sitePath(base, pageIdToPath(l.pageId))}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )

    case 'articleList':
      return (
        <ul className="hnga-articlelist">
          {block.items.map((it, i) => (
            <li key={i}>
              <Link to={sitePath(base, pageIdToPath(it.pageId))}>{it.title}</Link>
              {it.date && <span className="hnga-articlelist-date">{it.date}</span>}
            </li>
          ))}
        </ul>
      )

    default:
      // 未覆盖的块类型忽略，避免编译期穷尽性约束影响
      return null
  }
}

/** 简易表单（公仆信箱/在线留言）。提交仅回显 onSubmitMessage，无真实提交。 */
function FormBlock({
  formId,
  onSubmitMessage,
}: {
  formId: string
  onSubmitMessage: string
}): JSX.Element {
  const [done, setDone] = useState(false)
  return (
    <form
      className="hnga-form"
      data-form-id={formId}
      onSubmit={(e) => {
        e.preventDefault()
        setDone(true)
      }}
    >
      <div className="hnga-form-row">
        <label className="hnga-form-label">姓名</label>
        <input className="hnga-form-input" type="text" name="name" required />
      </div>
      <div className="hnga-form-row">
        <label className="hnga-form-label">联系电话</label>
        <input className="hnga-form-input" type="tel" name="phone" />
      </div>
      <div className="hnga-form-row">
        <label className="hnga-form-label">内容</label>
        <textarea
          className="hnga-form-textarea"
          name="content"
          placeholder="请如实填写反映事项"
          required
        />
      </div>
      <button className="hnga-form-submit" type="submit">
        提交
      </button>
      {done && <div className="hnga-form-msg">{onSubmitMessage || '提交成功，感谢您的来信。'}</div>}
    </form>
  )
}

/** 登录表单。token 由调用方提供（来自 loginTokens[0]）。本站 JSON 暂无 loginForm。 */
function LoginFormBlock({ tokenHint }: { tokenHint: string }): JSX.Element {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const base = useSiteBase()
  return (
    <form
      className="hnga-loginform"
      onSubmit={(e) => {
        e.preventDefault()
        // tokenHint 为空时无法校验；实际使用时由 page JSON 的 loginTokens 注入
        if (!tokenHint) {
          setErr('登录未配置，请联系站点管理员。')
          return
        }
        const ok = checkLogin(tokenHint, pwd)
        if (ok) {
          // 绝对站点路径，避免 useNavigate 相对解析累积
          navigate(sitePath(base, 'admin'))
        } else {
          setErr('账号或密码错误，请重试。')
        }
      }}
    >
      <p className="hnga-loginform-title">内部办公系统登录</p>
      <div className="hnga-form-row">
        <label className="hnga-form-label">密码</label>
        <input
          className="hnga-form-input"
          type="password"
          value={pwd}
          onChange={(e) => {
            setPwd(e.target.value)
            setErr('')
          }}
          required
        />
      </div>
      <button className="hnga-form-submit" type="submit">
        登录
      </button>
      {err && <div className="hnga-loginform-error">{err}</div>}
    </form>
  )
}

const pdfStyle: CSSProperties = { width: '100%' }

/**
 * 把同站 pageId 映射为站内相对路径。
 * 约定：pageId 形如 page-hnga-xxx → 取去前缀后的站内段；page-hnga 自身 → 根。
 * 不同站点的 pageId 不应在此出现（编排层保证）。返回值是站内相对段，调用方需经
 * sitePath(base, ...) 转绝对站点路径再用于 Link to / navigate。
 */
function pageIdToPath(pageId: string): string {
  const sitePrefix = 'page-hnga-'
  if (pageId === 'page-hnga') return ''
  if (pageId.startsWith(sitePrefix)) {
    return pageId.slice(sitePrefix.length)
  }
  // 兜底：非本站 pageId，退回根（避免误跳他站）
  return ''
}
