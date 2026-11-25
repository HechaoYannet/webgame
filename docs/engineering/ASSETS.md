# ASSETS.md — 静态资源契约与清单

> 配套：`CLAUDE.md`（工程总览）、`.claude/CLAUDE.md` §3（所有权）、`docs/engineering/SCHEMA.md`（类型契约）。
> 本文件是 `public/assets/**` 的唯一清单与约定。**新增/替换任何图片、音频、PDF、视频都必须在本文件登记。**

---

## 1. 解析规则（唯一入口 `src/utils/assetUrl.ts`）

`public/data/**` 里的资源一律用 **assetId**（不带扩展名），例如 `"assetIds": ["photo-campus-backwall"]`、`"assetId": "paper-source-crystal.pdf"`。

运行时生成候选 URL 列表：

| 类型 | 候选顺序 |
|---|---|
| 图片 | `'' , .png , .jpg , .jpeg , .webp , .gif , .svg` |
| 音频/视频 | `'' , .mp3 , .mp4 , .webm , .ogg , .wav` |

调用方（`src/sites/shared/placeholder.tsx`、`src/apps/WechatApp/{AssetImage,Avatar,ImageViewer}.tsx`、`src/apps/QqApp/components.tsx`、`src/game/audio.ts`、`src/apps/DoorbellApp` 的 `LiveFeed`）用 `onError` 依序推进候选，全部失败才回落到中性占位（灰块 / 剪影）。

**三条推论（施工时最容易踩）**

1. 文件名必须**严格等于** `<assetId>.<ext>`，放在 `public/assets/` 下。**数据侧永远不写扩展名**（唯一例外：PDF 惯例上把扩展名写进 assetId，如 `paper-source-crystal.pdf`）。
2. 同一 assetId 存在多个扩展名时，**按上表顺序取第一个成功加载的**。`.jpg` 优先于 `.svg`——这正是"真实图自动覆盖占位 SVG"的机制，也是为什么**清掉占位 SVG 后不会影响真实图**。
3. 候选表第一项是空扩展名，而 dev/preview 服务器的 SPA fallback 对无扩展名路径返回 `index.html`（200 · text/html）。浏览器 `<img>` 解码该 HTML 失败后触发 `onError`，进而前进到 `.png`/`.jpg`。**这是预期行为**，代价是每张图多 1~2 次探测请求；不要试图"修复"它（改动 `assetUrl` 的候选顺序会破坏 .svg 回退）。

---

## 2. 目录约定

| 路径 | 角色 | 是否进仓库 |
|---|---|---|
| `public/assets/` | **构建产物**：只放已压缩、可直接上线的文件。`vite build` 原样拷进 `dist/assets/` | ✅ |
| `src/assets/img/` | **AI 原图投放区**（高分辨率原图、未压缩）。构建不引用 | ❌ 已 `.gitignore` |
| `src/assets/*.jpg` | 少数被代码 `import` 的资源（如手机边框 `bezel-*.jpg`），走 Vite 哈希 | ✅ |

原图仓库外备份：`D:\otherProject\webgame\_asset-originals\public-assets\`（压缩前的整目录快照）。

---

## 3. 新增 / 替换一张图的步骤

1. 原图丢进 `src/assets/img/`（命名随意，我是按 assetId 命名的）。
2. 压成 `public/assets/<assetId>.jpg`：**长边 ≤2000，JPEG quality 90**。
   - 真实照片/截图用 JPEG 即可；`assetUrl` 只按扩展名匹配，不区分 PNG 是否无损。
   - 需要保留的透明通道目前没有（全部是不透明照片/扫描件）。
3. 数据侧只写 assetId。
4. 在本文件 §5 登记；一图两用记到 §6。

参考实现（PowerShell 7 + System.Drawing，Windows）：

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($src); $w=$img.Width; $h=$img.Height
$s = [Math]::Min(1.0, 2000/[Math]::Max($w,$h)); $nw=[int]($w*$s); $nh=[int]($h*$s)
$bmp = New-Object System.Drawing.Bitmap $nw,$nh
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img,0,0,$nw,$nh); $g.Dispose()
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? MimeType -eq 'image/jpeg'
$ep = [System.Drawing.Imaging.EncoderParameters]::new(1)
$ep.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality,[long]90)
$bmp.Save($dst,$enc,$ep)
```

> 注意：必须用 `::new(...)` 构造 `EncoderParameters`/`EncoderParameter`；用 `New-Object` 会得到"Parameter is not valid"。裁切同理（`DrawImage` 传源矩形），用于裁掉水印。

---

## 4. 体积预算

- 2026-09 整治：`public/assets` 由 **111.5 MB → 18.3 MB**（47 个文件），`dist` 19.6 MB。
- 当前最大文件：`video-doorbell-dao-loop.mp4` 3.8 MB（1920×1080 / 5.04 s / H.264 `avc1`，仅在终章门铃页按需加载）。
- 规则：单张位图 >1 MB 需说明理由；新增视频 >8 MB 需主控同意；总预算 **≤25 MB**。

---

## 5. 资源清单

### 5.1 站点图片

| assetId | 文件 | 用在哪 |
|---|---|---|
| `campus-hero-lvzhong` | .jpg 2000×1116 | 绿中官网首页 hero |
| `xw-home-banner` | .jpg 2000×1116 | 新希望成长中心官网 banner |
| `shanhe-campus` | .jpg 2000×1116 | 山河医科大学官网首图 |
| `shanhe-lab-building` | .jpg 2000×1342 | 实验室/新闻配图（铭牌"生物能源与疾病控制国家重点实验室"） |
| `photo-campus-backwall` | .jpg 2000×1342 | `page-lvzhong-gallery`「校园后墙」 |
| `photo-principal-office` | .jpg 2000×1116 | `page-lvzhong-gallery`「校长办公室一瞥」 |
| `photo-zhang-chen-handshake` | .jpg 2000×1333 | `page-lvzhong-news-visit`（张强带队参观实验室） |
| `photo-zhang-chen-signing` | .jpg 2000×1342 | `page-xinxwang-news-lab`（中心与实验室签署协议，关键证据页） |
| `photo-dao-bald` | .jpg 1500×1880 | `page-xinxwang-team`（教官"刀哥"，玩家据此认出上门的人） |
| `photo-case-li-back` | .jpg 1600×1435 | `page-xinxwang-cases`（学员小李案例配图，背影） |
| `photo-case-wang-back` | .jpg 1600×1880 | `page-xinxwang-cases`（学员小王案例配图，背影） |
| `group-siguo-window-photo` | .jpg 2000×1380 | `qq/group-files.json`（思过室窗户照） |
| `scan-agreement-xh2026-0312` | .jpg 1493×2000 | `page-lvzhong-agreement`（协议扫描件，推荐费 20 万/人 · 学费 4.8 万/学期） |
| `pdf-screening-list` | .pdf | `page-lvzhong-screening-pdf`（受试者名单） |
| `paper-source-crystal` | .pdf | `page-arxiv-paper` 下载物；同时是 AI 解读站 sha256 校验目标 |

### 5.2 微信朋友圈 / QQ空间

| assetId | 文件 | 用在哪 |
|---|---|---|
| `moments-li-0301-certificate` | .jpg 2000×1493 | 朋友圈 3/1 —— 张强的《聘书》（新希望成长中心 名誉顾问 + 红章） |
| `moments-li-0305-gacha` | .jpg 1633×701 | 朋友圈 3/5「十连双金，高兴了」 |
| `moments-li-0309-wall-key` | .jpg 1493×2000 | 朋友圈 3/9「这地方晚上真安静」——校园后墙夜景，左下角地上烟头 + 一串钥匙 |
| `moments-li-0311-endfield-screenshot` | .webp 1600×900 | 朋友圈 3/11「高兴」+ 终末地官方页链接 |
| `moments-li-0225-game` | .jpg 1596×783 | 朋友圈 2/25「今晚上分」 |
| `moments-yan-0308-campus-map` | .jpg 1493×2000 | 朋友圈 3/8 闫欣泽「踩点完成」——校园安全空间分析图 |
| `moments-yan-0220-shanhe-gate` | .jpg 2000×1116 | 朋友圈 2/20 闫欣泽「来这里查点东西」——山河医大校门（雨中） |
| `qzone-li-0309-backwall-img` | .jpg | QQ空间 3/9 同上 |
| `qzone-li-0311-endfield-img` | .webp | QQ空间 3/11 |
| `qzone-li-202512-screenshot-img` | .jpg 1596×783 | QQ空间 2025-12「重复了，不过泰还是很帅」 |
| `qzone-yan-0308-map-img` | .jpg | QQ空间 3/8 |
| `qzone-yan-0225-shanhe-img` | .jpg | QQ空间 2/25 |
| `qzone-yan-0309-key-img` | .jpg 2000×1493 | QQ空间 3/9 闫欣泽「捡回来了」——黄铜钥匙特写（与 3/9 后墙照里的钥匙形状一致） |

### 5.3 头像 / 音频 / 视频

| assetId | 文件 | 说明 |
|---|---|---|
| `avatar-*` ×15 | .svg | **程序化矢量剪影，决定长期保留**（不做 AI 头像） |
| `audio-call-ringback` | .mp3 | 拨号回铃 |
| `audio-doorbell-knock` | .mp3 | 门铃敲门（循环，音量 0.8） |
| `audio-heartbeat` | .mp3 | 风险红边心跳 |
| `video-doorbell-dao-loop` | .mp4 | 门铃"实时画面"循环视频；缺失时回落 `avatar-dao`，再回落剪影 |

---

## 6. 一图两用（同一张照片跨平台复用）

同一张照片同时挂在微信朋友圈与 QQ空间两个 assetId 上——这是**有意为之**（同一条内容跨平台发），也是节省素材的做法：

| 内容 | 朋友圈 assetId | QQ空间 assetId |
|---|---|---|
| 3/9 校园后墙夜景 | `moments-li-0309-wall-key` | `qzone-li-0309-backwall-img` |
| 3/11 终末地 | `moments-li-0311-endfield-screenshot` | `qzone-li-0311-endfield-img` |
| 3/8 校内地图 | `moments-yan-0308-campus-map` | `qzone-yan-0308-map-img` |
| 2/20·2/25 山河医大 | `moments-yan-0220-shanhe-gate` | `qzone-yan-0225-shanhe-img` |
| 游戏截图 | `moments-li-0225-game` | `qzone-li-202512-screenshot-img` |

> 替换其中任一槽位时，**必须同步替换它的一图两用伙伴**，否则两个平台的"同一张照片"会不一致。

---

## 7. 已清理的 AI 生成痕迹（2026-09）

| 素材 | 问题 | 处理 |
|---|---|---|
| `photo-case-li-back` | 顶部压着一整条 AI 乱码文案「温暖真的教育机构的案例…」 | 裁掉顶部 445 px |
| `photo-case-li-back` `photo-case-wang-back` `photo-dao-bald` `group-siguo-window-photo` | 右下角「豆包AI生成」水印 | 各裁掉底部 120 px |
| `moments-li-0305-gacha` | 左上角 bilibili 视频水印「comiccad bilibili」 | 裁掉顶部 68 px |
| `scan-agreement-xh2026-0312` | 原图为【实例】模板，斜印满屏"实例文件 仅供参考"，且甲/乙方名称与金额均与设定冲突 | **整张替换**为真实扫描件（编号 LZ-XHW-2026-0312、绿草中学 × 新希望成长中心、双章 + 骑缝章） |

> 生成新素材时请直接规避：**任何平台水印（豆包/即梦/bilibili…）、"实例/模板/仅供参考"字样、真实学校或机构名**。

---

## 8. 仍为占位 / 待补

- **占位**：15 个 `avatar-*.svg`（已确认保留）。
- **待补（设计文档要求但素材未实现）**：`photo-principal-office` 缺少"角落文件袋上隐约可见**新希望**字样"这一细节（`信息架构.md` §4.2、`剧情大纲.md` 第二章）。现有图无此元素，需要重画或在画面角落加一个可辨认的文件夹。
