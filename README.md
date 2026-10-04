# 学生背单词监督微信小程序

微信原生 TypeScript + 微信云开发实现的 V1 闭环：建组、邀请码加入、发布单词任务、记忆、正式默写、服务端评分、错词重练、Owner 监督和排行榜。

## 已实现范围

2026-09-20 增补：默认学生账号，教师开通码、独立教学工作台、只读学生体验预览。首次使用需新建开通码集合并重新部署云函数，详见 [教师与学生身份说明](docs/教师与学生身份说明.md)。原有成绩和小组归属不变。

- P0：原生 TypeScript 工程、统一类型/常量/校验、云函数调用与错误处理、CloudBase 构建脚本。
- P1：用户自动初始化、资料更新、小组创建、邀请码、重复加入保护、成员列表、Owner 服务端鉴权。
- P2：任务草稿、手动单词、粘贴批量解析、发布快照、撤回、任务列表。
- P3：Member 学习进度初始化/恢复、位置保存、浏览完全部单词后解锁默写。
- P4：首次进入固化随机题序、本地答案缓存、一次性提交、服务端评分、正式成绩唯一锁定、逾期标记。
- P5：正式结果和逐题明细、错词重练；练习记录与正式成绩完全分离。
- P6：Owner 完成率、已完成/未完成、成绩、错词数、排行榜；Owner 从所有学习统计中排除。
- P7：loading/empty/error、按钮防重复、关键纯函数测试、数据库与索引说明、部署和验收步骤。

V1 明确不支持 `.xlsx` 文件上传或解析。批量录入方式是从 Excel/WPS 复制两列后粘贴文本。

## 目录

```text
miniprogram/              微信原生小程序
  pages/                  16 个业务页面（含教学工作台、学生预览）
  components/             loading、empty、progress、score 组件
  services/               云函数调用与领域 API
  utils/                  日期、错误、导航工具
cloudfunctions/
  auth/ group/ task/      五个领域云函数
  study/ attempt/
  _shared/                服务端访问层、鉴权、业务逻辑
shared/
  types/ constants/       公共类型、错误码、限制
  validators/ core/       校验和可测试纯函数
docs/
  database.md             集合、字段和索引
  security-rules.json     数据库禁止客户端直读写的规则模板
tests/                    关键规则单元测试
scripts/                  云函数与测试构建脚本
```

## 本地检查

推荐 Node.js 18 或 20、pnpm 10+。

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build:cloud
```

若 pnpm 的供应链策略提示 `Ignored build scripts`，执行一次 `pnpm approve-builds`，批准仓库已声明的 `esbuild` 与 `protobufjs` 后重新安装。它们分别用于本地 bundle 和 CloudBase SDK；不要批准清单外的未知脚本。

当前代码已在 Node.js 环境完成 `tsc --noEmit`、8 项纯函数/边界测试及五个云函数 bundle 构建。云端集成测试需要真实微信 AppID、CloudBase 环境和多账号，必须按下方流程人工执行。

## 微信开发者工具初始化

1. 用微信开发者工具导入仓库根目录。
2. 在 `project.config.json` 或开发者工具项目设置中替换 `touristappid` 为真实小程序 AppID。
3. 开通云开发，创建一个环境。
4. 把环境 ID 写入 `miniprogram/env.ts` 的 `CLOUD_ENV_ID`。不要提交生产环境密钥；小程序环境 ID 本身不是服务端密钥。
5. 在云开发控制台创建 [docs/database.md](docs/database.md) 中列出的全部集合。
6. 将所有集合的客户端权限设为不可读、不可写。V1 的数据访问全部经过云函数。
7. 按 [docs/database.md](docs/database.md) 创建索引；唯一索引必须先建，之后再进行多人测试。
8. 在仓库根目录执行 `pnpm run build:cloud`，确保每个领域目录生成最新 `index.js`。
9. 在开发者工具中依次右键 `cloudfunctions/auth`、`group`、`task`、`study`、`attempt`，选择“上传并部署：云端安装依赖”。
10. 在云函数配置中将 `task` 和 `attempt` 的执行超时设为至少 20 秒，以覆盖 200 词边界下的分批写入；其他函数可保留默认值。
11. 编译小程序。首次进入会调用 `auth.ensureUser` 建立用户档案。

## 云函数接口

每个调用使用统一结构：

```ts
{ action: string, payload: Record<string, unknown> }
```

响应统一为：

```ts
{ success: true, data: T }
// 或
{ success: false, error: { code: string, message: string, details?: object } }
```

领域函数及 action：

- `auth`：`ensureUser`、`updateProfile`
- `group`：`create`、`joinByCode`、`listMine`、`getDetail`、`listMembers`、`regenerateInvite`
- `task`：`getOwnerView`、`createDraft`、`updateDraft`、`importPreview`、`publish`、`withdraw`、`listByGroup`、`getMemberView`、`getOwnerStats`、`getRanking`
- `study`：`startOrResume`、`saveStudyIndex`、`completeMemory`
- `attempt`：`startFormal`、`submitFormal`、`getResult`、`startWrongPractice`、`submitWrongPractice`

## 关键一致性和安全设计

- 服务端只使用 `cloud.getWXContext().OPENID` 确认当前用户；不接受客户端提供的当前 `userId` 或 `ownerId`。
- Owner 写操作会重新读取 `groups.ownerId`；Member 学习操作会重新检查 `group_members.role=member/status=active`。
- `group_members`、`member_task_progress`、正式 `submissions` 与 `submission_items` 使用关系字段生成的确定性文档 ID，防止重复点击生成重复数据。
- 发布与正式提交在云数据库事务中锁定状态。发布后 `draftWords` 被移除，`task_words` 成为不可变快照。
- CloudBase 单事务最多 100 个操作，因此 200 词发布使用版本化、确定性 ID 的分批可重试快照写入，最后只用小事务切换可见版本；正式提交在单个权威 submission 中原子保存逐题结果，再分批幂等生成 `submission_items` 查询镜像。
- 正式提交以 `formal + taskId + userId` 唯一；只有 `in_progress -> submitted` 一次状态转换。第二次提交返回 `FORMAL_ALREADY_SUBMITTED`，不会覆盖成绩。
- 成绩、逐题正误、`timing` 全部由服务端用任务快照和服务器时间重算。
- normalize 规则仅为 `trim().toLowerCase()`；内部空格、连字符和撇号不会被改写。
- 截止后仍可提交并正常评分，`submittedAt > deadline` 时保存 `timing=overdue`。
- 撤回后不能开始新的正式默写；已开始的正式答卷仍可提交，已提交历史结果始终可查。
- 错词重练只写 `wrong_word_practices`，不会更新 `submissions` 或正式成绩摘要。
- 统计查询只选择 active 且 `role=member` 的记录；Owner 不在分母、完成数、未完成名单或排行榜中。

## 人工回归

准备 1 个 Owner 微信账号和至少 2 个 Member 账号：

1. Owner 创建小组，复制邀请码；确认成员列表仅有 Owner，学习成员数为 0。
2. 两个 Member 分别加入；重复输入邀请码，确认不新增成员记录。
3. Owner 创建任务，手工录入 1 个词并保存草稿；再粘贴至少 30 行 TAB/竖线/逗号数据，核对错误行和重复行。
4. 设置未来截止时间并发布；确认发布后不能普通编辑词表。
5. Member A 学习部分词后退出，重新进入应恢复位置；未浏览最后一词时不能完成记忆。
6. Member A 完成记忆进入默写，退出再进后题序不变、已输入答案恢复。
7. 留一题空白并正式提交；核对分数、正确数、逐题明细和错词。
8. 再次提交同一正式答卷，确认返回 `FORMAL_ALREADY_SUBMITTED` 且原成绩不变。
9. 完成错词重练，确认练习分数变化但正式成绩不变。
10. 把另一个任务截止时间设为短期，截止后让 Member B 提交；确认正常出分且 Member/Owner/排行榜均显示逾期。
11. 核对排行榜按分数降序、同分按提交时间升序；完全相同的分数和提交时间显示并列；未提交 Member 单独列出。
12. 核对完成率分母只有 2 个 Member，Owner 从完成率、未完成名单和榜单中消失。
13. Owner 撤回一个任务；确认未开始 Member 不能新开正式默写，既有成绩仍可查看。
14. 用 Member 直接调用 Owner action、传入其他用户 ID 或构造客户端分数，确认服务端拒绝或忽略。

## 当前需人工完成的事项

- 替换真实 AppID 和云环境 ID。
- 在 CloudBase 控制台创建集合、索引和数据库权限。
- 上传部署五个云函数。
- 在真实微信账号和服务器时间下完成多账号集成回归。

这些事项依赖用户的微信主体和云环境，代码仓库内没有写死环境值或测试账号。
