/**
 * src/apps/DoorbellApp/DoorbellApp.tsx — 智能门铃 / 摄像头（终章倒计时核心）
 *
 * 读 phone/doorbell-events.json doorbell-dao-visit：
 *  - 事件由 @/utils/shellState.deliverDoorbell 触发（AlbumApp 高潮动作：勾选经费报告后
 *    启动举报倒计时 + deliverSms(sms-zhangqiang-threat) + deliverDoorbell(doorbell-dao-visit)）
 *  - deliverDoorbell 内部已启循环敲门音频 + 震屏 + 红边 + 推送通知
 *  - App 读 useDoorbellState()：deliveredIds 含本事件时展示实时画面（光头壮汉刀哥按门铃）
 *  - 实时画面播放 assets/video-doorbell-dao-loop.mp4（缺失时回落 liveFeed.characterAssetId
 *    头像、再回落剪影）；角标时间戳以 triggeredAt 为基准随倒计时逐秒走字
 *  - 倒计时 useCountdown('countdown-finale')（@/utils/shellState，与 PhoneShell 状态栏同源）
 *  - 倒计时归零 → @/utils/shellState.watchCountdownExpiry 自动 pushEnding('bad')
 *    （本组件不再手动 pushEnding；仅订阅 countdownExpired 做黑屏 UI）
 *
 * 迁移说明：动力源已从 @/engine 切到 @/game + @/utils/shellState + @/data/loader。
 * 门铃事件数据用 @/data/loader 的同步 getter getDoorbellEventById（main.tsx 已 await 过）。
 * 仅保留 notifClosed（UI 局部态）。
 */

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { DoorbellEvent } from '@/types';
import { getDoorbellEventById } from '@/data/loader';
import { useGameStore } from '@/game/gameStore';
import { useCountdown, useDoorbellState } from '@/utils/shellState';
import { imageUrlCandidates, mediaUrlCandidates } from '@/utils/assetUrl';
import { formatGameFullStamp } from '@/utils/time';

const COUNTDOWN_ID = 'countdown-finale';
const DOORBELL_EVENT_ID = 'doorbell-dao-visit';

export default function DoorbellApp(): ReactNode {
  const [notifClosed, setNotifClosed] = useState(false);

  // 终章坏结局已达成 → 黑屏（@/game store 真值）
  const endingId = useGameStore((s) => s.endingId);
  const finished = useGameStore((s) => s.finished);

  // 门铃推送状态（@/utils/shellState 内存态，由 deliverDoorbell 写入）
  const doorbellState = useDoorbellState();

  // 门铃事件数据：同步 getter（main.tsx 已 await loadGameData，安全）
  const daoEvent: DoorbellEvent | undefined = getDoorbellEventById(DOORBELL_EVENT_ID);

  // 是否已被推送（deliverDoorbell 触发）—— shellState.deliverDoorbell 已自动启敲门音频 + 震屏 + 全屏告警
  const pushed = doorbellState.deliveredIds.includes(DOORBELL_EVENT_ID);

  // 倒计时状态（@/utils/shellState useCountdown：归零由 watchCountdownExpiry 自动 pushEnding('bad')）
  const countdown = useCountdown(COUNTDOWN_ID);
  const countdownExpired = countdown.expired;
  const countdownActive = countdown.active;

  // 画面时间戳：以事件数据 triggeredAt 为基准，随倒计时推进逐秒走字。
  // （游戏内时钟起点 15:00 与事件记录的 18:30 不同源，故不用 gameNowMs。）
  const baseStampMs = daoEvent ? Date.parse(daoEvent.triggeredAt) : Number.NaN;
  const elapsedSec =
    daoEvent && (countdownActive || countdownExpired)
      ? Math.max(0, countdown.totalSec - countdown.remainingSec)
      : 0;
  const cameraStamp = Number.isNaN(baseStampMs)
    ? ''
    : formatGameFullStamp(baseStampMs + elapsedSec * 1000);

  // 本组件额外补一条周期震屏（门铃 deviceFeedback），音频由 deliverDoorbell 已启
  useEffect(() => {
    if (!pushed) return;
    const hapticInt = setInterval(() => {
      // @/game 无独立 HapticsService；就地降级震屏（可选，受浏览器支持限制）
      navigator.vibrate?.(30);
    }, 2400);
    return () => {
      clearInterval(hapticInt);
    };
  }, [pushed]);

  // 坏结局已达成 → 黑屏（countdownExpired 后 watchCountdownExpiry 推 bad，不可回退，CLAUDE.md §6.6）
  if (endingId === 'bad' || (finished && countdownExpired)) {
    return <BadEndingScreen text={daoEvent?.onTimeoutText ?? '林哲也消失了。'} />;
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

      {/* 实时画面：优先循环播放门铃录像（clipAssetId），素材缺失时回落刀哥头像/剪影 */}
      <div style={feedArea}>
        <div style={feedFrame}>
          <div style={feedScreen}>
            <LiveFeed
              clipAssetId={daoEvent.liveFeed.clipAssetId}
              characterAssetId={daoEvent.liveFeed.characterAssetId}
            />
            {/* 监控画面角标：摄像头该有的红点 + REC，而不是把素材缺失直接写成「不可用」 */}
            <div style={liveBadge}>
              <span style={liveDot} />
              REC
            </div>
            <div style={feedTimestamp}>{cameraStamp}</div>
          </div>
          <div style={feedOverlayText}>{daoEvent.liveFeed.sceneDescription}</div>
        </div>
      </div>

      {/* 倒计时悬浮（CLAUDE.md §6.3 不可回退） */}
      {(countdownActive || countdownExpired) && (
        <div style={countdownBar(countdownExpired)}>
          <div style={{ fontSize: 11, color: '#ffd6d6' }}>
            {daoEvent.countdownBar?.alertText ?? '倒计时'}
          </div>
          <div style={countdownText(countdownExpired)}>
            {fmtCountdown(countdown.remainingSec)}
          </div>
        </div>
      )}

      <div style={bottomHint}>
        门口摄像头 · 家中网络
      </div>
    </div>
  );
}

/** 实时画面：优先循环播放门铃录像；录像不可用时回落门口人物头像，再回落剪影。 */
function LiveFeed({
  clipAssetId,
  characterAssetId,
}: {
  clipAssetId?: string;
  characterAssetId?: string;
}): ReactNode {
  const [idx, setIdx] = useState(0);
  const clips = clipAssetId ? mediaUrlCandidates(clipAssetId) : [];
  useEffect(() => {
    setIdx(0);
  }, [clipAssetId]);
  if (idx < clips.length) {
    return (
      <video
        src={clips[idx]}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setIdx((i) => i + 1)}
        style={feedMedia}
      />
    );
  }
  return <Avatar assetId={characterAssetId} />;
}

/** 门口人物头像（liveFeed.characterAssetId）：候选扩展名逐个试，全失败才画剪影。 */
function Avatar({ assetId }: { assetId?: string }): ReactNode {
  const [idx, setIdx] = useState(0);
  const candidates = assetId ? imageUrlCandidates(assetId) : [];
  useEffect(() => {
    setIdx(0);
  }, [assetId]);
  if (idx >= candidates.length) return <DaoSilhouette />;
  return (
    <img src={candidates[idx]} alt="门口画面" onError={() => setIdx((i) => i + 1)} style={feedMedia} />
  );
}

/** 最后一道兜底：光头壮汉剪影（连头像素材都缺失时）。 */
function DaoSilhouette(): ReactNode {
  return (
    <svg width="120" height="140" viewBox="0 0 120 140" style={{ opacity: 0.85, margin: '12px auto' }}>
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

// ===== styles =====
const wrapStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e1620',
  color: '#e7eef7',
  fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
  position: 'relative',
  paddingBottom: 'var(--home-inset)',
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
  background: 'linear-gradient(180deg,#0c1118,#04070b)',
  border: '1px solid #24374d',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '0 0 12px',
  overflow: 'hidden',
  position: 'relative',
};
const feedScreen: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  lineHeight: 0,
  background: '#04070b',
  borderBottom: '1px solid #1a2838',
};
const feedMedia: CSSProperties = {
  width: '100%',
  display: 'block',
  background: '#04070b',
};
const feedOverlayText: React.CSSProperties = {
  fontSize: 11,
  color: '#9aa6b5',
  textAlign: 'center',
  lineHeight: 1.5,
  padding: '0 12px 12px',
};
const liveBadge: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  letterSpacing: 1,
  color: '#ff9a9a',
  background: 'rgba(30,6,6,0.72)',
  padding: '2px 7px',
  borderRadius: 4,
  border: '1px solid #4d2a2a',
};
const liveDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#ff3b3b',
  display: 'inline-block',
  animation: 'ui-pulse 1.4s ease-in-out infinite',
};
const feedTimestamp: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 8,
  fontSize: 10,
  color: '#8fa1b5',
  fontVariantNumeric: 'tabular-nums',
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
