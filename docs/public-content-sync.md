# AI 资讯与 Skill：只同步网页和公开数据

本地采集程序位于 `AINav_art/ainews` 和 `AINav_art/skill`，继续被根目录 `.gitignore` 排除。公开网页分别放在 `ainews/` 和 `skill/`，与主站一起进入 GitHub。

## 日常更新

采集程序更新完成后，在 AINav 根目录运行：

```powershell
npm run sync:content
npm run build
npm run test:content
npm run check
```

`sync:content` 需要 Python 3.10+ 与 Node.js 20+，没有额外 Python 或 npm 依赖。它先匿名检查旧记录的 GitHub 公开可见性，再读取已有数据，不运行资讯采集、付费分析或消息推送。生成和检查完成后，提交公开文件和必要的维护脚本，再推送 GitHub。

也可以指定独立采集目录：

```powershell
python scripts/sync-public-content.py --news-source E:/private/ainews --skill-source E:/private/skill --days 7
npm run build
```

在没有私有程序的机器上，`npm run build` 直接使用已提交的公开 JSON 重建网页，不需要访问 `AINav_art`。

独立目录中的历史 Skill 记录若没有 `private` 标记，需先运行 `python scripts/verify-public-repos.py --records E:/private/skill/data/records.json`。核验不使用登录凭据，仅接受精确仓库地址的匿名 200 响应；名单 `skill-public-repos.json` 有效期 24 小时。未核验的历史记录不导出，明确私有的记录始终拒绝，失败原因也不会发布仓库名称。导出器不把“缺少 private 字段”等同于公开。

## 导出边界

| 输入 | 公开输出 | 不导出的内容 |
|---|---|---|
| ainews SQLite | 最近可用日期起算的 7 天资讯，字段限于来源、标题、摘要、分类、公开 URL、时间 | 原数据库、内容 hash、通知渠道、推送状态、配置 |
| 日报、周报 JSON | 报告日期、生成方法、核心摘要、文字要点与展望 | 原始报告 HTML、内部路径、产品管线与通知配置 |
| Skill records.json | 项目名、描述、公开地址、语言、标签、Stars/Forks、创建/更新时间 | 采集查询、owner 对象、匹配规则、额外未知字段；明确标为私有的仓库会阻止导出 |
| 公开榜单缓存 | 白名单字段与 http(s) 链接 | 凭据、未列明的字段与脚本 URL |

导出器会先验证两块输入再写公开文件。每个 JSON 通过临时文件替换，避免读到半份文件；整个目录不是文件系统级事务，请勿在同步中途部署。缺失数据库不会被自动创建为空库，坏输入不会清空现有快照。已有日期文件保留为归档，当前窗口以 `latest_date.json` 的 `dates` 为准。

`api/manifest.json` 分开记录 `sourceUpdatedAt` 和 `exportedAt`。超过 7 天的数据在页面显示为历史快照。修改导出日期不会把旧数据变成新采集的数据。

## 页面功能

- Skill 支持全量搜索、分类、资源类型、时间/Stars/创建时间排序，再分页；旧分页和标签 URL 保留。
- 资源类型区分结构通过的 Skill、候选、MCP 相关和生态项目；支持多个任务标签与原文搜索。结构检查不代表实际安装或安全检查。
- 资讯支持搜索、分类、已有日期选择和排序；日报与周报显示历史摘要。
- 展示数据采用 DOM 文本节点，来源 URL 仅允许 http(s)。嵌入的数据文件使公开页面可通过本地文件方式打开。
- 首页和专题导航统一连接到同站公开快照，不再依赖两个子域名是否在线。

## 当前数据与验证范围（2026-10-21）

- 资讯库最新记录为 2026-04-20，当前导出 2026-04-14 至 2026-04-20，共 198 条去重资讯。
- Skill 已进行真实采集：6 个查询完成，385 个公开项目拆为 514 条记录；结构通过 132 条，待检查 370 条，其余为候选或未找到技能的项目。按任务规则分类；未执行下载的技能或脚本，结构通过不等于安全或实际试用通过。
- 翻译已接入 ainews 共享配置，但当前配置模型返回“已下线”；本次 10 条翻译失败，494 条待翻译，10 条原文中文。失败不会被缓存为成功，页面保留原文。需在本地配置可用模型后重试。
- Skill 采集禁用所有通知、自动提交和旧数据清理；资讯本轮未重新采集，仍按历史日期展示。
- 旧私有脚本中的地区接口、来源解析器和通知凭据未逐项在线验证。
- 两个本地项目原有 Actions 工作流都假设程序已放入独立私有仓库并配置 Secrets；它们不会因为出现在忽略目录里而自动在 GitHub 运行。本轮提供手动同步流程，没有新建定时任务。

## 私有程序本地修复

本轮还原地修复了以下文件，它们继续被忽略，**不随公开仓库提交**：

- `AINav_art/ainews/build_static.py`：最近日期改为数据库最后可用日期起算；导出删除通知渠道；补上日报页面实际请求的 `daily_analysis/list.json`；支持传入分析目录。
- `AINav_art/skill/huggingface.go`：模型详情地址改为 `huggingface.co/owner/model`，保留 datasets 与 spaces 的路径前缀。
- `AINav_art/skill/web.go`：仅首页激活 All，避免榜单标签与 All 同时激活。
- `AINav_art/skill/search.go` 与 `store.go`：强制 `is:public` 查询、保留可见性字段并在更新已有记录时同步该字段。

公开同步流程使用新的白名单导出器和页面生成器，避免继续依赖旧的整目录复制。若以后把程序迁入私有仓库，请自行将这些本地修复纳入该私有仓库。

## Skill 采集、检查和翻译

在已经安装本地私有程序的机器运行 `npm run update:skill`：采集 → 仓库去重 → 预算内逐批检查 SKILL.md → 分类 → 缓存中文翻译 → 公开字段导出 → 页面生成。无私有程序的 GitHub 构建仍只读公开 JSON。

可通过 `python scripts/update-skill-content.py --skip-collect --inspect-limit 16 --translation-requests 8` 继续检查和翻译，不重复采集。每次检查有 GitHub 请求预算，超限的条目保留待检查；翻译预算单位为批次，每批最多 5 条。未配置定时执行，需要手动运行。

私有程序需要 Go、Python 和 PyYAML；本机 PyYAML 安装于忽略的 `.cache/python-deps`。私有 `pipeline.config.json` 的 `aiConfigPath` 指向本地共享 AI 配置，配置、凭据、请求日志和缓存均不导出。仅发送已确认公开的技能名称与描述进行中文翻译和分类；不读取或发送仓库的私有内容。翻译缓存随内容、服务模型和提示词版本变化失效。

本次接口返回的官方迁移说明要求在 TokenHub 新建 API key，并使用模型详情页给出的模型与地址。完成本地共享配置迁移后可重试，不应把旧密钥硬编码进公开脚本。
