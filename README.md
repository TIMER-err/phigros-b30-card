<h1 align="center">Phigros B30 Card</h1>

<p align="center">
  把 Phigros 成绩图挂到 GitHub Profile 上，每天自动更新。<br>
  图片和 QQ 机器人里 <a href="https://github.com/Catrong/phi-plugin">phi-plugin</a> 的 <code>/b30</code> <b>完全一致</b>。
</p>

<p align="center">
  <a href="../../actions/workflows/render.yml"><img src="../../actions/workflows/render.yml/badge.svg" alt="Render"></a>
</p>

<p align="center">
  <img width="560" src="https://raw.githubusercontent.com/TIMER-err/phigros-b30-card/output/b30.jpg" alt="示例">
</p>

不是重新画一套 UI，而是直接复用 phi-plugin 的 `resources/html/b19/b19.art` 模板、CSS、
字体和曲绘，用 puppeteer 截图。存档从 TapTap 云存档（LeanCloud）拉取并 AES 解密，
不依赖任何第三方查分 API。

```
TapTap 扫码 ──> sessionToken ──> LeanCloud 取档 ──> AES 解密 ──> 算 B30
                                                                  │
    output 分支 <── 截图 <── puppeteer <── art-template <── phi-plugin 模板
```

## 部署

1. Fork 本仓库。
2. 本地 clone 下来，`npm install` 后 `npm run login` 扫码拿 sessionToken（详见[下文](#获取-sessiontoken)）。
3. Settings → Secrets and variables → Actions → New repository secret：
   - 名称 `PHIGROS_SESSION_TOKEN`，值为上一步拿到的 token
4. Actions 页面手动跑一次 **Render Phigros B30**（第一次要下 Chromium 和曲绘，约 3 分钟）。
5. 在任意 README 里引用：

```markdown
![Phigros B30](https://raw.githubusercontent.com/<你的用户名>/phigros-b30-card/output/b30.jpg)
```

图太大的话用 HTML 限宽：

```html
<img width="620" src="https://raw.githubusercontent.com/<你的用户名>/phigros-b30-card/output/b30.jpg">
```

> [!NOTE]
> URL 固定不变，每天覆盖同一路径。`raw.githubusercontent.com` 是 GitHub 自家域名，
> 不走 camo 代理，缓存只有 Fastly CDN 和浏览器两层，都是 `max-age=300`。
> 渲染完最多 5 分钟就能看到新图，性急就 `Ctrl+Shift+R` 强刷。

### 可选 Variables

Settings → Secrets and variables → Actions → Variables：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PHIGROS_REGION` | `cn` | `cn` 国服 / `intl` 国际服 |
| `B30_NUM` | `33` | 列出的成绩条数，超过 27 的部分显示在 OVER FLOW 之后 |
| `IMG_TYPE` | `jpeg` | `jpeg` / `png` |
| `PHI_THEME` | `star` | `star` / `snow` / `topText` / 留空 |

### 改更新时间

默认每天北京时间 04:00。改 `.github/workflows/render.yml` 里的 cron（**UTC 时间**）：

```yaml
schedule:
  - cron: '0 20 * * *'   # UTC 20:00 = UTC+8 次日 04:00
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

终端直接画出二维码，用 **TapTap App** 扫描并确认授权，随后打印 sessionToken 并写入
`.env`（权限 `0600`，已在 `.gitignore` 里）。扫不了码就访问
<https://accounts.taptap.cn/device> 手动输入终端给出的 5 位 code。

上传为 Secret：

```bash
gh secret set PHIGROS_SESSION_TOKEN < <(sed -n 's/^PHIGROS_SESSION_TOKEN=//p' .env)
```

走的是 Phigros 自己的 TapTap OAuth device code 流程（`accounts.tapapis.cn` →
`open.tapapis.cn/account/profile` → LeanCloud `/users` 换 sessionToken），和 phi-plugin
的 `lib/TapTap/` 一致。

> [!WARNING]
> `npm run login` **只在本地跑**，不要放进 workflow —— Actions 日志是公开的，token 会泄露。
> sessionToken 等同于账号凭据，拿到它就能读你的云存档。

### 手动从设备取

- Android：`/Android/data/com.PigeonGames.Phigros/files/.userdata`
- iOS：导出 app 沙盒后查看 `Documents` 下的存档

sessionToken 长期有效，除非在别处重新登录把它顶掉。

## 缓存

四层缓存让常态运行约 45 秒：

| 缓存 | 内容 | 作用 |
| --- | --- | --- |
| `output` | 上次的图和 `meta.json` | 存档 `updatedAt` 没变则直接跳过渲染，连浏览器都不启动 |
| `vendor/phi-plugin` | ~126 MB 模板/CSS/字体 | 只做增量 `fetch --depth=1` |
| `.cache/ill` | 用到的那几十张曲绘 | 曲绘仓库有 2.7 GB，这里只取需要的 |
| `~/.cache/puppeteer` | Chromium | 免去每次下载浏览器 |

产物推到 orphan 分支 `output` 并强制覆盖，图片不会堆积 git 历史。

## 本地运行

```bash
npm install
git clone --depth=1 https://github.com/Catrong/phi-plugin.git vendor/phi-plugin
npm run render          # 读 .env，输出 output/b30.jpg
FORCE=1 npm run render  # 存档没变也重渲
```

## 实现说明

| 文件 | 作用 |
| --- | --- |
| `src/taptap.ts` | TapTap device-code 扫码登录 → sessionToken |
| `src/save.ts` | LeanCloud 取档、AES-256-CBC 解密、解析 `gameRecord`/`user`/`gameProgress`/`summary` |
| `src/reader.ts` | 存档二进制格式的 LEB128 varint 读取器 |
| `src/info.ts` | 从 phi-plugin 的 `info.csv` 读定数表，解析曲绘/头像/背景资源 |
| `src/b19.ts` | 复刻 `Save.getB19`：单曲 rks、φ1-3、B27、推分建议 |
| `src/ill.ts` | 按需下载曲绘到本地缓存 |
| `src/render.ts` | art-template 编译 `.art` + puppeteer 截图 |

定数表在每次运行时从 phi-plugin 仓库读取，游戏更新出新曲后无需改代码。

RKS 计算：单谱 `acc < 70` 记 0，否则 `((acc - 55) / 45)² × 定数`；
玩家 rks `(φ1..φ3 + B1..B27) / 30`。

未实现 phi-plugin 中依赖其查分 API 的两处：同 rks 玩家平均 ACC（卡片上的 `Avg:` 标签）
和 B30 数据分析面板（雷达图 + 直方图）。

## 常见问题

**图片 404** —— workflow 还没成功跑过，或 `output` 分支没创建。看 Actions 日志。

**图片还是旧的** —— 先确认源头已更新：

```bash
curl -s https://raw.githubusercontent.com/<你>/phigros-b30-card/output/meta.json
```

`renderedAt` 是新的就是本地缓存，强刷即可。

**渲染出来不是自己的成绩** —— `_GameSave` 这个 class 跨账号可读，必须按 `user` 指针过滤
再按 `modifiedAt` 取最新。本仓库已处理，如果你自己改过 `src/save.ts` 注意这点。

**`LeanCloud /users/me -> 400`** —— sessionToken 失效了（在别的设备重新登录会顶掉），
重新 `npm run login`。

**曲绘缺失** —— 新曲的曲绘还没同步到 [phi-plugin-ill](https://github.com/Catrong/phi-plugin-ill)，
等上游更新即可，不影响其他部分。

**定数对不上 / 卡片上出现 `Real RKS`** —— 存档版本和当前定数表不一致，
说明游戏更新改了定数，等 phi-plugin 的 `info.csv` 同步。

## 致谢

- 模板、定数表、曲绘：[Catrong/phi-plugin](https://github.com/Catrong/phi-plugin)、[Catrong/phi-plugin-ill](https://github.com/Catrong/phi-plugin-ill)
- 云存档格式：[7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary)

Phi-Plugin 与本项目均非 Phigros 官方项目，与南京鸽游网络有限公司不存在授权、合作或运营关系。
