/**
 * src/apps/QqApp/QqLogin.tsx — QQ 登录页（序章核心谜题入口。CLAUDE.md §6.1）。
 *
 * 玩家输密码 → checkAnswer('puzzle-qq-login', value) 据
 * puzzles.json matchStrategy{kind:"oneOf",accepted:["20251128","1128"]} 校验 →
 * 成功 markPuzzleSolved 推进剧情；登 QQ 后会话全可见（已无 thread 门禁）。
 * 失败仅提示"密码错误"——真实登录页不会常驻解题提示（审核报告 2.E）。
 *
 * **密码 20251128 不在前端**——只 checkAnswer，答案在 puzzles.json。登录的是李桥瑞 QQ。
 * 线索：李桥瑞说"密码改成终末地公测那天"——公测日见终末地官网（2025-11-28），故答案 20251128（容错 1128）。
 * 本地 LoginSubmit 驱动 UI。
 */
import { useState } from 'react'
import { getQqContact, getContact } from '@/data/loader'
import { checkAnswer } from '@/game/answerCheck'
import { useGameStore } from '@/game/gameStore'
import { PUZZLE_QQ_LOGIN } from './qqConstants'

/** 本地提交结果（替代旧引擎 SubmitResult 的 UI 子集）。 */
interface LoginSubmit {
  success: boolean
  /** 是否游戏已结束（finished），UI 应禁输入。 */
  locked: boolean
  /** 当前累计错误次数。 */
  wrongAttempts: number
}

export function QqLogin() {
  const finished = useGameStore((s) => s.finished)
  const markPuzzleSolved = useGameStore((s) => s.markPuzzleSolved)

  const [password, setPassword] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [result, setResult] = useState<LoginSubmit | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)

  // 李桥瑞 QQ 号（从 contacts.json 读，非硬编码）
  let liNumber = ''
  let liName = '李桥瑞'
  try {
    const li = getQqContact('char-liqiaorui')
    liNumber = li?.qqNumber ?? ''
    const c = getContact('char-liqiaorui')
    liName = c?.displayName ?? c?.name ?? liName
  } catch {
    // loadGameData 未完成时回退默认展示，不影响提交（checkAnswer 不依赖账号号）
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    // 游戏已结束：直接锁定，不再处理。
    if (finished) {
      const res: LoginSubmit = { success: false, locked: true, wrongAttempts }
      setResult(res)
      setToast('游戏已结束，无法登录。')
      return
    }
    const ok = checkAnswer(PUZZLE_QQ_LOGIN, password.trim())
    if (ok) {
      // 记录已解；QqApp 顶层据 solvedPuzzleIds 自动切到主界面。
      markPuzzleSolved(PUZZLE_QQ_LOGIN)
      const res: LoginSubmit = { success: true, locked: false, wrongAttempts }
      setResult(res)
      setPassword('')
      return
    }
    // 失败分支：仅计错次并提示密码错误；不再给出解题提示。
    const nextAttempts = wrongAttempts + 1
    setWrongAttempts(nextAttempts)
    const res: LoginSubmit = { success: false, locked: false, wrongAttempts: nextAttempts }
    setResult(res)
    setPassword('')
    setToast('密码错误，请重试。')
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

        {toast && <div className="qq-toast error">{toast}</div>}

        <button
          type="submit"
          className="qq-login-submit"
          disabled={!password || result?.locked}
        >
          登 录
        </button>
      </form>
    </div>
  )
}
