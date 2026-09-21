# Phigros Profile Card

在 GitHub Profile README 里展示自己的 Phigros 成绩（RKS / B30）的 SVG 图片服务。

直接用 `sessionToken` 从 TapTap 云存档（LeanCloud）拉取存档、AES 解密、解析二进制成绩记录并计算 RKS，
不依赖任何第三方查分 API。

```markdown
![Phigros](https://<your-app>.vercel.app/api/phigros)
```

## 部署

1. Fork / push 本仓库，在 [Vercel](https://vercel.com/new) 导入（Hobby 免费额度足够）。
2. 在 Project Settings → Environment Variables 添加：

   | 变量 | 必填 | 说明 |
   | --- | --- | --- |
   | `PHIGROS_SESSION_TOKEN` | ✅ | 你的 Phigros sessionToken（25 位字符串） |
   | `CACHE_TTL` | | CDN 缓存秒数，默认 `1800` |

3. Deploy，访问 `https://<your-app>.vercel.app/api/phigros` 验证。

> `sessionToken` 等同于账号凭据，只放在环境变量里，**不要**写进代码或通过 URL 传参。
> 本服务只读取存档，不会写回。

## 获取 sessionToken

用 Phigros 官方 App 登录后，token 保存在本地：

- Android：`/Android/data/com.PigeonGames.Phigros/files/.userdata`（需 root 或 adb backup）
- iOS：iTunes/爱思助手 导出 app 沙盒，查看 `Documents` 下的存档
- 也可用 phi-plugin 的扫码登录流程拿到 token

## URL 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `theme` | `dark` | `dark` / `light` |
| `count` | `10` | 展示条数（含 φ 行），1–40 |
| `width` | `520` | 卡片宽度，380–900 |
| `title` | 玩家昵称 | 自定义标题 |
| `region` | `cn` | `cn` 国服 / `intl` 国际服 |

例：

```markdown
![Phigros](https://<your-app>.vercel.app/api/phigros?count=20&theme=light&width=640)
```

## RKS 计算

- 单谱 rks：`acc < 70` 记 0，否则 `((acc - 55) / 45)^2 * 定数`
- 玩家 rks：`(Best27 之和 + 3 × φ谱 rks) / 30`，φ 谱为所有 100% acc 谱面中定数最高者

## 更新曲目定数

新版本出歌后重新生成定数表：

```bash
npm run build:songs                # 从 phi-plugin 仓库拉取最新 info.csv
npm run build:songs -- ./info.csv  # 或使用本地文件
```

## 本地预览

```bash
npm install
PHIGROS_SESSION_TOKEN=xxx npx tsx scripts/preview.ts 20 dark   # 输出 preview.svg
npx vercel dev                                                 # 起本地服务
```

## 致谢

- 存档格式与定数表来自 [Catrong/phi-plugin](https://github.com/Catrong/phi-plugin)
- 云存档读取思路来自 [7aGiven/PhigrosLibrary](https://github.com/7aGiven/PhigrosLibrary)
