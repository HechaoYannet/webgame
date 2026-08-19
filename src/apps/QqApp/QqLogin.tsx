/**
 * src/apps/QqApp/QqLogin.tsx — QQ 登录页（序章核心谜题入口。CLAUDE.md §6.1）。
 *
 * 玩家输密码 → usePuzzle('puzzle-qq-login').submit(value) → engine 据
 * puzzles.json matchStrategy{kind:"oneOf",accepted:["0328","20260328"]} 校验 →
 * 成功 onSuccess：收集 ev-qq-chat-plan + advanceChapter ch-1 + 解锁闫欣泽等会话。
 * 失败：onFailure 加风险；错 attemptsToHint(=3) 由引擎 SubmitResult.hintTriggered
 * 标记并触发对应 hint。
 *
 * **密码 0328 不在前端**——只 submit，校验交给 engine。登录的是李桥瑞 QQ。
 * SubmitResult.success/.hintTriggered/.error 驱动 UI。
 */
import { useState } from 'react'
import type { SubmitResult } from '@/engine/puzzle/PuzzleService'
import { getQqContact, getContact } from '@/data/loader'
import { usePuzzle } from '@/engine/hooks/usePuzzle'
import { PUZZLE_QQ_LOGIN } from './qqConstants'

export function QqLogin() {
  const puzzle = usePuzzle(PUZZLE_QQ_LOGIN)

  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<{ kind: 'error' | 'hint'; text: string } | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)

  // 李桥瑞 QQ 号（从 contacts.json 读，非硬编码）
  let liNumber = ''
  let liName = '李桥瑞'
  try {
    const li = getQqContact('char-liqiaorui')
    liNumber = li?.qqNumber ?? ''
    const c = getContact('char-liqiaorui')
    liName = c?.displayName ?? c?.name ?? liName
  } catch {
    // loadGameData 未完成时回退默认展示，不影响提交（puzzle 校验不依赖账号号）
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    const res = puzzle.submit(password.trim())
    setResult(res)
    if (res.success) {
      // onSuccess 已生效；QqApp 顶层据 puzzle.solved 自动切到主界面
      setPassword('')
      return
    }
    if (res.error === 'game-finished') {
      setToast({ kind: 'error', text: '游戏已结束，无法登录。' })
      return
    }
    setPassword('')
    if (res.hintTriggered) {
      setToast({
        kind: 'hint',
        text: `密码错误（第 ${res.wrongAttempts} 次）。提示密码与李桥瑞最在意的事有关。`,
      })
    } else {
      setToast({ kind: 'error', text: `密码错误，请重试。${res.riskDelta ? '' : ''}`.trim() })
    }
  }

  return (
    <div className="qq-login">
      <div className="qq-login-hero">
        <div className="qq-login-logo">QQ</div>
        <h1 className="qq-login-title">QQ 登录</h1>
        <p className="qq-login-sub">
          当前账号：{liName}
          {liNumber ? `（${liNumber}）` : ''}
        </p>
      </div>

      <form className="qq-login-form" onSubmit={handleSubmit}>
        <label className="qq-field">
          <span className="qq-field-label">QQ 号</span>
          <input
            className="qq-field-input"
            type="text"
            value={liNumber}
            readOnly
            placeholder={liNumber || '李桥瑞'}
          />
        </label>

        <label className="qq-field">
          <span className="qq-field-label">密码</span>
          <input
            className="qq-field-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoComplete="off"
            autoFocus
            inputMode="numeric"
            disabled={result?.locked}
          />
        </label>

        {toast && (
          <div className={`qq-toast ${toast.kind === 'hint' ? 'hint' : 'error'}`}>
            {toast.text}
          </div>
        )}

        <button
          type="submit"
          className="qq-login-submit"
          disabled={!password || result?.locked}
        >
          登 录
        </button>

        <p className="qq-login-hint">
          提示：密码与李桥瑞关心的事有关。输错 3 次会有进一步线索。
        </p>
      </form>
    </div>
  )
}
