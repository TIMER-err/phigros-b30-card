<h1 align="center">Phigros B30 Card</h1>

<p align="center">
  把 Phigros 成绩图挂在 GitHub 主页上，每天自动更新。<br>
  出图与 <a href="https://github.com/Catrong/phi-plugin">phi-plugin</a> 的 <code>/b30</code>、<code>/update</code> 逐像素相同。
</p>

<p align="center">
  <a href="../../actions/workflows/render.yml"><img src="../../actions/workflows/render.yml/badge.svg" alt="Render"></a>
</p>

<p align="center">
  <img width="820" src="https://raw.githubusercontent.com/TIMER-err/phigros-b30-card/output/wide.jpg" alt="Wide">
</p>

<table align="center">
  <tr>
    <td align="center"><b>b30.jpg</b> 成绩总览</td>
    <td align="center"><b>update.jpg</b> 成绩变动</td>
  </tr>
  <tr>
    <td><img width="400" src="https://raw.githubusercontent.com/TIMER-err/phigros-b30-card/output/b30.jpg" alt="B30"></td>
    <td><img width="400" src="https://raw.githubusercontent.com/TIMER-err/phigros-b30-card/output/update.jpg" alt="Update"></td>
  </tr>
</table>

## 工作方式

GitHub Profile README 是静态的：不能调接口，不能跑代码，图片必须是一个固定 URL。
因此这里由 GitHub Actions 定时渲染，把图推到固定分支，README 引用该链接。

图不是重画的。渲染直接复用 phi-plugin 的 `resources/html/b19/b19.art` 模板、CSS、
字体和曲绘，用 art-template 填数据后由 puppeteer 截图，输出与 phi-plugin 逐像素相同。

存档从 TapTap 云存档（LeanCloud）拉取，本地做 AES 解密和二进制解析，
不经过任何第三方查分 API。

```
TapTap 扫码 ──> sessionToken ──> LeanCloud 取档 ──> AES 解密 ──┬─> 算 B30 ──────┐
                                                              │                │
                                     history.json <── 逐日 diff 累加 ──> 成绩变动 ┤
                                                                               │
              output 分支 <── 截图 <── puppeteer <── art-template <── phi-plugin 模板
```

一次运行产出三张图：

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `b30.jpg` | 1200×1894 | 成绩总览，等同 `/b30`。信息最全，高度也最大 |
| `update.jpg` | 800×1536 | 近期成绩变动 + RKS 曲线，等同 `/update` |
| `wide.jpg` | 1522×450 | 横版，适合宽度受限的 Profile README |

## 部署

1. Fork 本仓库。
2. clone 到本地，`npm install`，然后 `npm run login` 扫码获取 token（见[下文](#获取-sessiontoken)）。
3. Settings → Secrets and variables → Actions → New repository secret，
   名称 `PHIGROS_SESSION_TOKEN`，值为上一步得到的 token。
4. Actions 页面手动运行一次 **Render Phigros B30**。首次需要下载 Chromium 和曲绘，
   约三分钟，之后的运行会快很多。
5. 在任意 README 中引用：

```markdown
![Phigros](https://raw.githubusercontent.com/<你的用户名>/phigros-b30-card/output/wide.jpg)
```

需要限制尺寸时用 HTML（横版建议不设 `width`，让它自适应容器宽度）：

```html
<img width="620" src="https://raw.githubusercontent.com/<你的用户名>/phigros-b30-card/output/b30.jpg">
```

> [!NOTE]
> 链接固定不变，每天覆盖同一路径。
> `raw.githubusercontent.com` 是 GitHub 自有域名，不走 camo 图片代理，
> 中间只有 Fastly CDN 和浏览器两层缓存，均为 `max-age=300`。
> 渲染完成后最多 5 分钟可见新图，或用 `Ctrl+Shift+R` 强制刷新。

### 可选变量

Settings → Secrets and variables → Actions → Variables：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PHIGROS_REGION` | `cn` | `cn` 国服 / `intl` 国际服 |
| `B30_NUM` | `33` | 列出的成绩条数，超过 27 的部分排在 OVER FLOW 之后 |
| `IMG_TYPE` | `jpeg` | `jpeg` / `png` |
| `UPDATE_CARD` | `1` | 设为 `0` 关闭成绩变动图 |
| `WIDE_CARD` | `1` | 设为 `0` 关闭横版图 |
| `WIDE_NUM` | `12` | 横版展示的成绩数。网格为 3 列，取 3 的倍数可填满 |
| `PHI_THEME` | `star` | `star` / `snow` / `topText` / 留空 |

### 更新时间

默认每天北京时间 04:00。修改 `.github/workflows/render.yml` 中的 cron，注意其为 UTC：

```yaml
schedule:
  - cron: '0 20 * * *'   # UTC 20:00 = 北京时间次日 04:00
```

手动触发：

```bash
gh workflow run "Render Phigros B30" -f force=true
```

## 获取 sessionToken

### TapTap 扫码登录（推荐）

```bash
npm install
npm run login          # 国服
npm run login -- intl  # 国际服
```

终端会输出二维码，用 **TapTap App** 扫描并确认授权，token 随即打印并写入 `.env`
（权限 `0600`，已在 `.gitignore` 中）。若终端无法显示二维码，
访问 <https://accounts.taptap.cn/device> 手动输入终端给出的 5 位 code。

上传为 Secret：

```bash
gh secret set PHIGROS_SESSION_TOKEN < <(sed -n 's/^PHIGROS_SESSION_TOKEN=//p' .env)
```

流程与 Phigros 自身的登录一致（`accounts.tapapis.cn` →
`open.tapapis.cn/account/profile` → LeanCloud `/users` 换 sessionToken），
实现参考 phi-plugin 的 `lib/TapTap/`。

> [!WARNING]
> `npm run login` 只在本地运行，不要放进 workflow。Actions 日志是公开的，
> token 会随之泄露。sessionToken 等同于账号凭据，持有者可读取你的云存档。

### 从设备提取

- Android：`/Android/data/com.PigeonGames.Phigros/files/.userdata`
- iOS：导出 app 沙盒后查看 `Documents` 下的存档

token 长期有效，除非在其他设备重新登录将其顶掉。

## 缓存

常态运行约 45 秒，依赖四层缓存：

| 缓存内容 | 位置 | 作用 |
| --- | --- | --- |
| 上次的图、`meta.json`、`history.json` | `output` 分支 | 存档 `updatedAt` 未变则跳过渲染 |
| phi-plugin 的模板/CSS/字体，约 126 MB | `vendor/phi-plugin` | 只做增量 `fetch --depth=1` |
| 用到的数十张曲绘 | `.cache/ill` | 曲绘仓库有 2.7 GB，此处只取所需 |
| Chromium | `~/.cache/puppeteer` | 免去每次下载浏览器 |

历史记录存在 `output` 分支而非 Actions 缓存：后者七天未使用即被驱逐，
而这份数据无法重新生成（原因见下文）。

产物推送到 orphan 分支 `output` 并强制覆盖，图片不会累积在 git 历史中。

## 本地运行

```bash
npm install
git clone --depth=1 https://github.com/Catrong/phi-plugin.git vendor/phi-plugin

npm run render          # 读取 .env，输出到 output/
FORCE=1 npm run render  # 存档未变也强制重新渲染
```

## 实现说明

| 文件 | 作用 |
| --- | --- |
| `src/taptap.ts` | TapTap device-code 扫码登录，换取 sessionToken |
| `src/save.ts` | 从 LeanCloud 取档、AES-256-CBC 解密、解析各 section |
| `src/reader.ts` | 存档为自定义二进制格式，此为其 LEB128 varint 读取器 |
| `src/info.ts` | 从 phi-plugin 的 `info.csv` 读定数表，定位曲绘/头像/背景资源 |
| `src/b19.ts` | 复刻 `Save.getB19`：单曲 rks、φ1-3、B27、推分建议 |
| `src/history.ts` | 历史记录的读写与逐日 diff |
| `src/update.ts` | 复刻 `session.js` 的 `box_line` 分行布局与 RKS 折线 |
| `src/ill.ts` | 按需下载曲绘到本地缓存 |
| `src/render.ts` | art-template 编译 `.art` + puppeteer 截图 |
| `templates/wide/` | 横版布局，自写，但卡片部分直接复用 b19 的标记与 CSS |

定数表在每次运行时从 phi-plugin 仓库读取，游戏更新出新曲后无需改动代码。

RKS 计算：单谱面 `acc < 70` 记 0，否则 `((acc - 55) / 45)² × 定数`；
玩家 rks 为 `(φ1..φ3 + B1..B27) / 30`。

有两处 phi-plugin 的功能未实现：同 rks 玩家的平均 ACC（卡片上的 `Avg:` 标签）
和 B30 数据分析面板（雷达图 + 直方图）。两者都依赖 phi-plugin 自身的查分 API，
与不依赖第三方的前提冲突。

### 成绩历史

Phigros 的存档只记录每个谱面的最终成绩，不含游玩时间戳。单看一份存档无法判断
哪些成绩是当天打出的。因此"最近成绩变动"只能逐次累加得到：每天拉取新存档，
与上次存下的 `history.json` 逐条比对，有变化的谱面按存档的 `modifiedAt` 记录一笔。

这份历史无法重新生成，丢失后只能从当天重新累加，所以它存放在 git 分支而非
Actions 缓存中。

首次运行时，存档中已有的成绩无法确定游玩时间，会被标记为基线
（条目第 5 位为 `true`）。基线参与后续 diff，但不出现在变动图中，
否则首张图会列出账号历史上的全部成绩。

日常渲染为纯本地累加，不访问任何外部 API。

#### 导入已有历史（可选）

若此前用过 phi-plugin 或 phib19.top，可将已积累的历史一次性导入：

```bash
npm run seed-history   # 写入 data/history-seed.json
```

这是本项目中唯一访问 phi-plugin API 的脚本，运行一次即可。

生成的 `data/history-seed.json` 不纳入版本控制，否则 fork 本仓库的人会拿到
他人的历史作为基线。让 CI 使用它有两种方式：

- 本地先运行 `npm run render`，再把产出的 `output/history.json` 推到 `output` 分支
- 或临时 `git add -f data/history-seed.json` 提交一次，首次 workflow 完成后删除

`history.json` 一旦位于 `output` 分支，种子文件不再被读取。

## 常见问题

**图片 404** —— workflow 未成功运行过，`output` 分支尚未创建。查看 Actions 日志。

**图片仍是旧的** —— 先确认源头是否已更新：

```bash
curl -s https://raw.githubusercontent.com/<你>/phigros-b30-card/output/meta.json
```

`renderedAt` 已更新则为本地或 CDN 缓存，强制刷新即可。
`raw` 的 CDN 缓存无法通过附加 `?v=xxx` 绕过，Fastly 会归一化查询参数。

**改了模板但 workflow 未触发** —— push 触发带路径过滤，
仅 `src/`、`scripts/`、`templates/` 及 workflow 文件自身的改动会触发运行。

**渲染出的不是自己的成绩** —— LeanCloud 上 `_GameSave` 这个 class 跨账号可读，
必须先按 `user` 指针过滤，再按 `modifiedAt` 取最新一条。
本仓库已处理，自行修改 `src/save.ts` 时需注意。

**`LeanCloud /users/me -> 400`** —— token 失效，通常是在其他设备重新登录导致，
重新运行 `npm run login`。

**部分曲目缺少曲绘** —— 新曲的曲绘尚未同步到
[phi-plugin-ill](https://github.com/Catrong/phi-plugin-ill)，等待上游更新，不影响其他部分。

**定数对不上，或卡片上出现 `Real RKS`** —— 游戏更新改动了定数，
当前定数表未同步，等待 phi-plugin 的 `info.csv` 更新。

## 致谢

- 模板、定数表、曲绘来自 [Catrong/phi-plugin](https://github.com/Catrong/phi-plugin)
  与 [Catrong/phi-plugin-ill](https://github.com/Catrong/phi-plugin-ill)。
- 云存档格式的分析来自 [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary)。

phi-plugin 与本项目均非 Phigros 官方项目，与南京鸽游网络有限公司不存在授权、
合作或运营关系。
