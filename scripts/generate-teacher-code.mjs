import { randomBytes, createHash } from 'node:crypto';

// Run locally by the environment administrator. Never ship the code to the client bundle.
const code = randomBytes(16).toString('hex').toUpperCase();
const id = createHash('sha256').update(code).digest('hex');
console.log('教师开通码（仅私下交给一位老师，不要提交到仓库）：\n' + code);
console.log('\n在 teacher_activation_codes 集合中创建以下记录；expiresAt 在控制台选择 Date 类型（下方为毫秒时间戳）：');
console.log(JSON.stringify({ _id: id, status: 'active', expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }, null, 2));
