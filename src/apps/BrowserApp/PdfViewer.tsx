/**
 * PDF 查看器 — 用 pdf.js（pdfjs-dist）内嵌渲染，加密 PDF 走 requiresPuzzleId。
 *
 * 纯前端解密（CLAUDE.md §6.x + agent 定义）：加载 PDF arraybuffer → pdf.js
 * getDocument → 若需要密码，先用玩家输入解密；解密用的密码同时交 engine 校验：
 *   usePuzzle().submit(password) → 引擎 PuzzleService 读 puzzles.json 校验
 *   （答案在 puzzles.json，前端不持码）；校验成功后引擎执行 onSuccess effects。
 *   密码本身既给 pdf.js 解密 PDF，也给引擎校验谜题（谜题答案 == PDF 密码）。
 *
 * pdfjs-dist（npm i pdfjs-dist html2canvas 已装，CLAUDE.md §2）静态 import：
 *   主库走包自带类型，worker 用 vite ?url 导入（vite/client 提供 *.mjs?url 类型）。
 */
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// vite ?url 静态资源导入：构建时生成 hashed worker url，类型由 vite/client 提供
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageBlock, PuzzleId } from "@/types";
import { usePuzzle } from "@/engine/hooks/usePuzzle";

type PdfViewerBlock = Extract<PageBlock, { type: "pdfViewer" }>;

interface PdfViewerProps {
  block: PdfViewerBlock;
}

// 配置 worker（模块加载时一次性）——真实静态解析，无 @vite-ignore 降级
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 用 pdf.js 渲染 PDF。assetId 可能是 public/assets 下的 pdf 文件（如 paper-source-crystal.pdf）
 * 或 data 里登记的资源 id（含 pdf- 前缀）。这里用 import.meta.env.BASE_URL + 'assets/' 拼。
 */
export function PdfViewer({ block }: PdfViewerProps) {
  const requiresPuzzleId = block.requiresPuzzleId as PuzzleId | undefined;
  const puzzle = usePuzzle(requiresPuzzleId ?? "puzzle-none");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const assetUrl = import.meta.env.BASE_URL + "assets/" + block.assetId;

  // 加密 PDF：解密成功后 puzzle.solved 为 true → 解锁渲染。
  // 非加密 PDF（无 requiresPuzzleId）直接渲染。
  const needsUnlock = !!requiresPuzzleId;
  const isUnlocked = !needsUnlock || puzzle.solved || unlocked;

  // 渲染 PDF（已解锁）
  useEffect(() => {
    if (!isUnlocked || !canvasRef.current) return;
    let rendering = true;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: assetUrl,
          ...(needsUnlock && password ? { password } : {}),
        });
        const doc = await loadingTask.promise;
        if (!rendering) return;
        const page = await doc.getPage(1);
        if (!rendering) return;
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // pdfjs v6：RenderParameters 要求 canvas（canvasContext 可选，提供 canvas 即可）
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
      } catch (e) {
        if (!rendering) return;
        // 渲染取消时 pdfjs 抛 RenderingCancelledException，忽略
        const msg = e instanceof Error ? e.message : String(e);
        if (!/cancelled/i.test(msg)) {
          setError("PDF 加载失败：" + msg);
        }
      }
    })();
    return () => {
      rendering = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [isUnlocked, assetUrl, needsUnlock, password]);

  // 加密 PDF 提交：交 engine 校验（答案在 puzzles.json）；密码同时用于 pdf.js 解密
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiresPuzzleId) return;
    setError(null);
    // submit → 引擎 PuzzleService 校验 + executeEffects(onSuccess)；返回同步结果
    const result = puzzle.submit(password);
    if (result.success) {
      // 密码校验通过 == PDF 密码正确，标记解锁交给渲染 effect 用 password 解密
      setUnlocked(true);
    } else {
      setError(result.error ?? "密码错误。");
    }
  };

  if (needsUnlock && !isUnlocked) {
    return (
      <div className="pdf-viewer pdf-viewer--locked">
        <div className="pdf-viewer__lock-icon" aria-hidden>
          🔒
        </div>
        <p className="pdf-viewer__hint">本 PDF 已加密，请输入密码查看。</p>
        <form className="pdf-viewer__form" onSubmit={handleSubmit}>
          <input
            className="pdf-viewer__input"
            type="text"
            placeholder="输入 PDF 密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="pdf-viewer__submit" type="submit" disabled={puzzle.locked}>
            {puzzle.locked ? "已锁定" : "解密"}
          </button>
        </form>
        {error && <p className="pdf-viewer__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <canvas ref={canvasRef} className="pdf-viewer__canvas" />
      {error && <p className="pdf-viewer__error">{error}</p>}
    </div>
  );
}
