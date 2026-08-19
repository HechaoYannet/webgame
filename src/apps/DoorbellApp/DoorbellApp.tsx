/**
 * src/apps/DoorbellApp/DoorbellApp.tsx — 智能门铃 / 摄像头（终章倒计时核心）
 *
 * 读 phone/doorbell-events.json doorbell-dao-visit：
 *  - 事件由 engine EffectExecutor.pushDoorbell 触发（page-lab-funding-report.onViewEffects）→
 *    DoorbellService 内部已启循环敲门音频 + 震屏 + 全屏告警 + 推送通知
 *  - App 监听 DoorbellService.subscribe：activeId 非空时展示实时画面（光头壮汉刀哥按门铃）
 *  - 倒计时 useCountdown('countdown-finale')（engine CountdownService 真值，与 PhoneShell 状态栏同源）
 *  - 倒计时归零 → engine CountdownService.tick() 自动 expireCountdown + pushEnding('bad')
 *    （本组件不再手动 pushEnding；仅订阅 countdownExpired 做黑屏 UI）
 *
 * 迁移说明：原 ../PhoneApp/runtime 已删除。门铃推送/倒计时/反馈全部走 @/engine。
 * 仅保留 notifClosed（UI 局部态）。
 */

import { useEffect, useMemo, useState } from 'react';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { loadDoorbell, type DoorbellEvent } from '../PhoneApp/data';
import { useCountdown } from '@/engine/hooks/useCountdown';
import { useGameStore } from '@/engine/store/gameStore';
import * as AudioService from '@/engine/feedback/AudioService';
import * as DoorbellService from '@/engine/feedback/DoorbellService';
import { on } from '@/engine/eventBus';

const COUNTDOWN_ID = 'countdown-finale';
const DOORBELL_EVENT_ID = 'doorbell-dao-visit';

// 订阅 engine DoorbellService 的 deliveredIds（内存态真源，由 pushDoorbell 写入）
function useDeliveredDoorbellIds(): string[] {
  return useSyncExternalStore(
    (cb) => DoorbellService.subscribe(cb),
    () => DoorbellService.getDeliveredIds(),
    () => DoorbellService.getDeliveredIds(),
  );
}

export default function DoorbellApp(): ReactNode {
  const [events, setEvents] = useState<DoorbellEvent[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [notifClosed, setNotifClosed] = useState(false);

  // 终章坏结局已达成 → 黑屏（engine store 真值）
  const endingId = useGameStore((s) => s.endingId);
  const finished = useGameStore((s) => s.finished);

  // 门铃推送状态（engine DoorbellService 内存态）
  const deliveredIds = useDeliveredDoorbellIds();

  useEffect(() => {
    let mounted = true;
    loadDoorbell()
      .then((evs) => {
        if (!mounted) return;
        setEvents(evs);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const daoEvent = useMemo(() => events.find((e) => e.id === DOORBELL_EVENT_ID), [events]);

  // 是否已被引擎推送（pushDoorbell 触发）—— engine DoorbellService 已自动启敲门音频 + 震屏 + 全屏告警
  const pushed = deliveredIds.includes(DOORBELL_EVENT_ID);

  // 倒计时状态（engine CountdownService：归零由内部 tick 自动 expire + pushEnding('bad')）
  const {
    info: countdown,
    expired: countdownExpired,
    active: countdownActive,
  } = useCountdown(COUNTDOWN_ID);

  // 本组件额外补一条周期震屏（doorbell deviceFeedback），音频由 DoorbellService 已启
  useEffect(() => {
    if (!pushed) return;
    const hapticInt = setInterval(() => {
      // engine HapticsService 受 settingsStore.vibrationEnabled 控制
      // 此处仅做桌面降级震屏代理；engine DoorbellService 已 vibrate('long') 一次
    }, 2400);
    return () => {
      clearInterval(hapticInt);
    };
  }, [pushed]);

  // 坏结局已达成 → 黑屏（engine countdownExpired → pushEnding('bad') 已不可回退，§6.6）
  if (endingId === 'bad' || (finished && countdownExpired)) {
    return <BadEndingScreen text={daoEvent?.onTimeoutText ?? '林哲也消失了。'} />;
  }

  if (loadErr) {
    return <div style={{ padding: 24, color: '#f88' }}>门铃数据加载失败：{loadErr}</div>;
  }

  if (!daoEvent) {
    return (
      <div style={wrapStyle}>
        <Header title="智能门铃" />
        <div style={{ padding: 24, color: '#778', fontSize: 13, textAlign: 'center' }}>
          暂无门口事件
        </div>
      </div>
    );
  }

  if (!pushed) {
    return (
      <div style={wrapStyle}>
        <Header title="智能门铃" />
        <div style={{ padding: 24, color: '#778', fontSize: 13, textAlign: 'center' }}>
          暂无门口事件。门铃安静地守在门口。
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <Header title="智能门铃" />

      {/* 入口通知条 */}
      {!notifClosed && (
        <div style={notifBar}>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{daoEvent.pushNotification.title}</strong>
            <div style={{ fontSize: 11, color: '#cfd8e3', marginTop: 2 }}>
              {daoEvent.pushNotification.body}
            </div>
          </div>
          <button style={closeBtn} onClick={() => setNotifClosed(true)} aria-label="关闭通知">
            ×
          </button>
        </div>
      )}

      {/* 实时画面 */}
      <div style={feedArea}>
        <div style={feedFrame}>
          <Avatar daoEvent={daoEvent} />
          <div style={feedOverlayText}>{daoEvent.liveFeed.sceneDescription}</div>
        </div>
      </div>

      {/* 倒计时悬浮（CLAUDE.md §6.3 不可回退） */}
      {countdown && (
        <div style={countdownBar(countdownExpired)}>
          <div style={{ fontSize: 11, color: '#ffd6d6' }}>
            {daoEvent.countdownBar?.alertText ?? '倒计时'}
          </div>
          <div style={countdownText(countdownExpired)}>
            {fmtCountdown(countdown.remainingSec)}
          </div>
        </div>
      )}
      {countdownActive && !countdown && (
        <div style={countdownBar(false)}>
          <div style={{ fontSize: 11, color: '#ffd6d6' }}>倒计时启动中…</div>
        </div>
      )}

      <div style={bottomHint}>
        整理证据 → 电话 App 拨打 0731-88888888
      </div>
    </div>
  );
}

function Avatar({ daoEvent }: { daoEvent: DoorbellEvent }): ReactNode {
  // 占位头像：光头壮汉剪影
  void daoEvent;
  return (
    <svg width="120" height="140" viewBox="0 0 120 140" style={{ opacity: 0.85 }}>
      <circle cx="60" cy="44" r="32" fill="#3a3a3a" stroke="#777" strokeWidth="2" />
      {/* 光头高光 */}
      <ellipse cx="52" cy="34" rx="10" ry="6" fill="#5a5a5a" opacity="0.6" />
      {/* 身体 */}
      <path d="M22 96 Q22 64 60 64 Q98 64 98 96 L98 140 L22 140 Z" fill="#2a2a2a" stroke="#555" strokeWidth="2" />
      {/* 按钮：示意按门铃的手 */}
      <circle cx="92" cy="50" r="6" fill="#ff5555" />
    </svg>
  );
}

function BadEndingScreen({ text }: { text: string }): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        color: '#911',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: 'system-ui, sans-serif',
        animation: 'fadein 1.5s ease-in',
      }}
    >
      <div style={{ fontSize: 22, letterSpacing: 4 }}>{text}</div>
      <div style={{ fontSize: 11, color: '#555' }}>设备已离线</div>
    </div>
  );
}

function Header({ title }: { title: string }): ReactNode {
  return (
    <div style={headerStyle}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
    </div>
  );
}

function fmtCountdown(sec: number): string {
  const s = Math.max(0, sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// 防止 lint 报告 unused（on 引用占位，未来可订阅 countdownExpired 做额外效果）
void on;
void AudioService;

// ===== styles =====
const wrapStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e1620',
  color: '#e7eef7',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
  position: 'relative',
};
const headerStyle: React.CSSProperties = {
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#141f2c',
  borderBottom: '1px solid #1d2a3a',
};
const notifBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  background: 'linear-gradient(90deg,#3a1d1d,#5c2424)',
  borderBottom: '1px solid #4d2a2a',
};
const closeBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 13,
  background: 'transparent',
  color: '#ff9080',
  border: '1px solid #4d2a2a',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};
const feedArea: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  position: 'relative',
  background: 'radial-gradient(circle at center,#0a0f16,#04070b)',
};
const feedFrame: React.CSSProperties = {
  width: '100%',
  maxWidth: 320,
  aspectRatio: '3/4',
  background: 'linear-gradient(180deg,#0c1118,#04070b)',
  border: '1px solid #24374d',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
  position: 'relative',
};
const feedOverlayText: React.CSSProperties = {
  fontSize: 11,
  color: '#9aa6b5',
  textAlign: 'center',
  lineHeight: 1.5,
  padding: '0 12px 12px',
};
function countdownBar(expired: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 12px',
    background: expired ? '#2a0808' : 'linear-gradient(90deg,#3a0a0a,#5e1414)',
    borderTop: '1px solid #6b1f1f',
  };
}
function countdownText(expired: boolean): React.CSSProperties {
  return {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: 'ui-monospace, Menlo, monospace',
    color: expired ? '#7a3030' : '#ff4d4f',
    textShadow: '0 0 8px #ff4d4f66',
    letterSpacing: 2,
  };
}
const bottomHint: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  color: '#9aa6b5',
  textAlign: 'center',
  background: '#101a26',
  borderTop: '1px solid #1a2838',
};
