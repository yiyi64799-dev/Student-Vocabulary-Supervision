# 云数据库集合与索引

所有集合的客户端权限应设置为“所有用户不可读写”，数据只经云函数访问。所有关键时间字段使用服务端 `Date`，前端仅负责本地化展示。

## 集合

- `teacher_activation_codes`：教师开通码摘要记录。字段 `_id/status/expiresAt/usedBy/usedAt`；`_id` 为明文码的 SHA-256 摘要；`expiresAt` 为 Date。只允许云函数和受信管理员访问，不存明文码。通过文档 ID 读取，不需额外索引。
- `users` 新增 `accountRole`（student/teacher）、可选 `teacherActivatedAt/activationAttempts/activationWindowAt`；原有用户缺失角色时按 student 展示。账号角色与组内 owner/member 分开。

- `users`：微信身份映射和公开档案。字段 `_id/openid/nickname/avatarUrl/createdAt/updatedAt`；`_id` 由服务端对 OPENID 生成不可逆确定性摘要，客户端永远不接收 openid。
- `groups`：小组主表。字段 `name/description/ownerId/inviteCode/inviteVersion/memberCount/createdAt/updatedAt`。
- `group_members`：成员关系。字段 `groupId/userId/role/status/joinedAt/updatedAt`。Owner 关系存在，但所有学习统计显式限定 `role=member`。
- `tasks`：任务主表及草稿词表。发布事务会把 `draftWords` 写入快照集合后删除草稿字段。
- `task_words`：发布后的不可变词表快照，含 `snapshotVersion/normalizedWord`，客户端不能直接写。发布时先以确定性 ID 写入版本化快照，再用小事务原子切换任务的可见版本，从而支持 200 词且不超过 CloudBase 单事务 100 操作限制。
- `member_task_progress`：Member 的学习位置、阶段及首次正式成绩摘要。
- `submissions`：正式默写唯一记录。文档 ID 由 `formal + taskId + userId` 确定，状态从 `in_progress` 变为 `submitted` 后不可回退；原子保存成绩及逐题 `items`，确保 200 词提交仍只需少量事务操作。
- `submission_items`：正式提交逐题结果的可查询镜像，由服务端从权威 `submissions.items` 以确定性 ID 幂等写入；结果展示和错词练习不依赖镜像写入时机。
- `wrong_word_practices`：每轮错词练习记录，与正式 submission 完全分离。
- `wrong_word_stats`：个人错词聚合，供后续个人错词本使用。

产品文档中的 attempt 领域由 `submissions + submission_items + wrong_word_practices` 落地；云函数仍命名为 `attempt`，避免把正式成绩与练习成绩混在同一记录中。

## 必建索引

| 集合 | 索引字段 | 类型 |
| --- | --- | --- |
| users | `openid` | 唯一 |
| groups | `inviteCode` | 唯一 |
| group_members | `groupId, role, status` | 普通组合 |
| group_members | `userId, status` | 普通组合 |
| tasks | `groupId, status, deadline` | 普通组合 |
| task_words | `taskId, snapshotVersion, index` | 唯一组合 |
| member_task_progress | `taskId, submittedAt` | 普通组合 |
| submissions | `taskId, userId, status` | 普通组合 |
| submission_items | `submissionId, wordId` | 唯一组合 |
| submission_items | `submissionId, isCorrect` | 普通组合 |
| wrong_word_practices | `userId, taskId, startedAt` | 普通组合 |
| wrong_word_stats | `userId, lastWrongAt` | 普通组合 |

关系唯一性还由确定性文档 ID 保证：`group_members`、`member_task_progress`、正式 `submissions` 和 `submission_items` 均不依赖客户端随机 ID。
