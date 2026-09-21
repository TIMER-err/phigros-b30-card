# Phigros B30 Card

用 GitHub Actions 定时渲染 Phigros B30 成绩图，图片和 QQ 机器人里的
[phi-plugin](https://github.com/Catrong/phi-plugin) `/b30` **完全一致** —— 复用它的
`resources/html/b19/b19.art` 模板、CSS、字体和曲绘，用 puppeteer 截图。

存档部分直接从 TapTap 云存档（LeanCloud）拉取并 AES 解密，不依赖任何第三方查分 API。

```markdown
![Phigros B30](https://raw.githubusercontent.com/<user>/<repo>/output/b30.jpg)
```

## 部署

1. Fork / push 本仓库。
2. 本地 `npm run login` 扫码拿到 sessionToken（见下）。
3. Settings → Secrets and variables → Actions：
   - Secret `PHIGROS_SESSION_TOKEN`：你的 Phigros sessionToken（25 位）
4. Actions 页面手动跑一次 **Render Phigros B30**。
5. 成功后图片在 `output` 分支的 `b30.jpg`，用上面的 raw 链接引用。

可选 Variables：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PHIGROS_REGION` | `cn` | `cn` 国服 / `intl` 国际服 |
| `B30_NUM` | `33` | 列出的成绩条数，27 之后显示 OVER FLOW |
| `IMG_TYPE` | `jpeg` | `jpeg` / `png` |
| `PHI_THEME` | `star` | `star` / `snow` / `topText` / 留空 |

> `sessionToken` 等同于账号凭据，只放 Secret。本服务只读存档，不会写回。

## 获取 sessionToken

### TapTap 扫码登录（推荐）

```bash
npm install
npm run login          # 国服
npm run login -- intl  # 国际服
```

终端会直接画出二维码，用 **TapTap App** 扫描并确认授权，随后打印 `sessionToken`。
扫不了码就访问 https://accounts.taptap.cn/device 手动输入终端给出的 5 位 code。

走的是 Phigros 自己的 TapTap OAuth device code 流程（`accounts.tapapis.cn` →
`open.tapapis.cn/account/profile` → LeanCloud `/users` 换 sessionToken），
和 phi-plugin 的 `lib/TapTap/` 一致。**只在本地跑**，不要放进 workflow——
日志是公开的，token 会泄露。

### 手动从设备取

- Android：`/Android/data/com.PigeonGames.Phigros/files/.userdata`
- iOS：导出 app 沙盒后查看 `Documents` 下的存档

> sessionToken 长期有效，除非在别处重新登录把它顶掉。

## 缓存

工作流每天北京时间 04:00 跑一次（改 `.github/workflows/render.yml` 里的 cron 可调），四层缓存让整次运行约 45 秒：

| 缓存 | 内容 | 作用 |
| --- | --- | --- |
| `output` | 上次的图和 `meta.json` | 存档 `updatedAt` 没变则直接跳过渲染 |
| `vendor/phi-plugin` | ~126 MB 的模板/CSS/字体 | 只做增量 `fetch --depth=1` |
| `.cache/ill` | 用到的那几十张曲绘 | 避免每次重下（曲绘仓库有 2.7 GB，这里只取需要的） |
| `~/.cache/puppeteer` | Chromium | 免去每次下载浏览器 |

发布用 orphan 分支 `output` 强制推送，图片不会堆积 git 历史。

手动触发时勾选 *即使存档未更新也重新渲染* 可以强制重渲。

## 本地运行

```bash
npm install
git clone --depth=1 https://github.com/Catrong/phi-plugin.git vendor/phi-plugin
PHIGROS_SESSION_TOKEN=xxx npm run render   # 输出 output/b30.jpg
```

## 实现说明

| 文件 | 作用 |
| --- | --- |
| `src/taptap.ts` | TapTap device-code 扫码登录 → sessionToken |
| `src/save.ts` | LeanCloud 取档、AES-256-CBC 解密、解析 `gameRecord`/`user`/`gameProgress`/`summary` |
| `src/info.ts` | 从 phi-plugin 的 `info.csv` 读定数表，解析曲绘/头像/背景资源 |
| `src/b19.ts` | 复刻 `Save.getB19`：单曲 rks、φ1-3、B27、推分建议 |
| `src/ill.ts` | 按需下载曲绘到本地缓存 |
| `src/render.ts` | art-template 编译 `.art` + puppeteer 截图 |

未实现 phi-plugin 中依赖其查分 API 的部分：同 rks 玩家平均 ACC（`Avg:` 标签）和 B30 数据分析面板。

RKS 计算：单谱 `acc < 70` 记 0，否则 `((acc-55)/45)² × 定数`；玩家 rks `(φ1..φ3 + B1..B27) / 30`。

## 致谢

- 模板、定数表、曲绘：[Catrong/phi-plugin](https://github.com/Catrong/phi-plugin)、[Catrong/phi-plugin-ill](https://github.com/Catrong/phi-plugin-ill)
- 云存档格式：[7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary)

Phi-Plugin 与本项目均非 Phigros 官方项目。
