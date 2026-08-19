/**
 * src/apps/QqApp/QqApp.tsx — QQ App 主界面（frontend-qq 独占。CLAUDE.md §3 + §6.1）。
 *
 * 视点：李桥瑞 QQ 账号（direction：李桥瑞发的=sent，他人发的=received）。
 *
 * 顶层先 `await loadGameData()`（loader 缓存幂等），让子组件可同步读 getQqThreads()/
 * getQzone()/getContact()/getQqContact()；登录态用 usePuzzle('puzzle-qq-login').solved。
 * 四个底部 Tab：消息 / 空间 / 群文件 / 通讯录。
 * 不硬编码剧情/密码——答案在 puzzles.json，由 engine 校验。
 */
import { useState } from 'react'
import { loadGameData, getQqThreads } from '@/data/loader'
import type { ChatThread } from '@/types'
import { usePuzzle } from '@/engine/hooks/usePuzzle'
import { Avatar, ErrorState, Loading, useAsync } from './components'
import { getContact, getQqContact } from '@/data/loader'
import type { QqContact } from '@/types'
import { PUZZLE_QQ_LOGIN } from './qqConstants'
import { QqLogin } from './QqLogin'
import { ChatList, ChatView } from './ChatView'
import { Qzone } from './Qzone'
import { GroupFiles } from './GroupFiles'
import './qq.css'

type Tab = 'messages' | 'qzone' | 'groupFiles' | 'contacts'

export default function QqApp() {
  // 登录态（puzzle-qq-login.solved）。success 收集 ev-qq-chat-plan + advanceChapter ch-1
  const loginPuzzle = usePuzzle(PUZZLE_QQ_LOGIN)
  const loggedIn = loginPuzzle.solved

  // 加载全局数据（loader 幂等缓存；同步 getter 需先 await）
  const { error: loadError } = useAsync(loadGameData, [])

  const [tab, setTab] = useState<Tab>('messages')
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)

  if (loadError) return <ErrorState text={`数据加载失败：${loadError}`} />

  // 未登录：登录页（序章核心谜题入口）
  if (!loggedIn) {
    return <QqLogin />
  }

  // 加载未完成时：显示 loading（避免同步 getter 抛错）
  let threads: ChatThread[]
  try {
    threads = getQqThreads()
  } catch {
    return <Loading text="登录 QQ…" />
  }

  // 打开会话：渲染会话页（自带返回）
  if (openThreadId && tab === 'messages') {
    const thread = threads.find((t) => t.id === openThreadId)
    if (thread) {
      return <ChatView thread={thread} onBack={() => setOpenThreadId(null)} />
    }
  }

  return (
    <div className="qq-app">
      <div className="qq-body">
        {tab === 'messages' && (
          <ChatList threads={threads} onOpen={(id) => setOpenThreadId(id)} />
        )}
        {tab === 'qzone' && <Qzone />}
        {tab === 'groupFiles' && <GroupFiles />}
        {tab === 'contacts' && <ContactsPanel />}
      </div>

      <nav className="qq-tabbar">
        <button type="button" className={`qq-tab${tab === 'messages' ? ' active' : ''}`} onClick={() => setTab('messages')}>
          消息
        </button>
        <button type="button" className={`qq-tab${tab === 'qzone' ? ' active' : ''}`} onClick={() => setTab('qzone')}>
          空间
        </button>
        <button type="button" className={`qq-tab${tab === 'groupFiles' ? ' active' : ''}`} onClick={() => setTab('groupFiles')}>
          群文件
        </button>
        <button type="button" className={`qq-tab${tab === 'contacts' ? ' active' : ''}`} onClick={() => setTab('contacts')}>
          通讯录
        </button>
      </nav>
    </div>
  )
}

function ContactsPanel() {
  const qqContacts = getAllQqContactsForPanel()
  return (
    <div className="qq-contacts">
      <h2 className="qq-panel-title">通讯录</h2>
      <ul className="qq-contact-list">
        {qqContacts.map((c) => {
          const char = getContact(c.characterId)
          const display = c.qqRemark || c.qqNickname
          return (
            <li key={`${c.characterId}-${c.qqNumber}`} className="qq-contact-row">
              <Avatar charId={c.characterId} name={display} isGroup={c.isGroup} />
              <div className="qq-contact-info">
                <div className="qq-contact-name">{display}</div>
                {c.isGroup ? (
                  <div className="qq-contact-sub">{c.memberCount ?? 0}人</div>
                ) : (
                  <div className="qq-contact-sub">
                    {c.status === 'lost' ? '已失联' : c.status === 'offline' ? '离线' : '在线'}
                    {char ? ` · ${char.schoolClass ?? ''}` : ''}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// 通讯录：从 loader 的 snapshot.qqContacts 取。loader 未直接导出全量 QqContact[]，
// 借 getQqContact 按 characterId 反查——但 contacts.json 含同一 characterId 的多条目
// （群聊用不同 characterId 占位），故这里走 loadGameData 之后的同步快照。下面的包装
// 复用 getQqThreads 里出现的群 + 已知好友 characterId，足够覆盖面板展示。
function getAllQqContactsForPanel(): QqContact[] {
  const seen = new Set<string>()
  const out: QqContact[] = []
  // 已知 characterId（来自 threads 参与者 + meta characters 中师生）的 QQ 条目
  const known = [
    'char-yanxinze', 'char-linzhe', 'char-liqiaorui-mom',
    'char-chenyutong', 'char-zhouming', 'char-zhaotianyu',
  ]
  for (const id of known) {
    const q = getQqContact(id)
    if (q && !seen.has(q.qqNumber)) {
      seen.add(q.qqNumber)
      out.push(q)
    }
  }
  // 群聊：threads 中 type==='group' 的标题 + 占位 characterId
  for (const t of getQqThreads()) {
    if (t.type !== 'group') continue
    const placeholderId = t.participantCharacterIds.find((id) => id !== 'char-liqiaorui') ?? t.participantCharacterIds[0]
    const q = getQqContact(placeholderId)
    if (q && !seen.has(q.qqNumber)) {
      seen.add(q.qqNumber)
      out.push({ ...q, qqNickname: t.title, qqRemark: t.title, isGroup: true, memberCount: q.memberCount })
    }
  }
  return out.sort((a, b) => (a.qqNickname || '').localeCompare(b.qqNickname || '', 'zh'))
}
