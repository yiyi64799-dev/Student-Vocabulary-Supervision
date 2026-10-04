import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve('miniprogram');
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}

test('WXML 表达式不包含误转义运算符；页面注册文件完整', async () => {
  for (const file of (await filesIn(root)).filter((name) => name.endsWith('.wxml'))) {
    const template = await readFile(file, 'utf8');
    for (const [, expression] of template.matchAll(/{{([\s\S]*?)}}/g)) {
      assert.doesNotMatch(expression, /&(?:amp|lt|gt|quot);/, file);
      assert.doesNotThrow(() => new vm.Script('(' + expression + ')'), file);
    }
  }
  const manifest = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8'));
  for (const page of manifest.pages) for (const extension of ['ts', 'wxml', 'wxss', 'json']) await access(path.join(root, page + '.' + extension));
});

test('小程序运行时导入不越过 miniprogramRoot，避免类型检查通过但微信运行失败', async () => {
  for (const file of (await filesIn(root)).filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))) {
    const { outputText } = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
    for (const [, modulePath] of outputText.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (!modulePath.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), modulePath);
      assert.ok(resolved.startsWith(root + path.sep), file + ' imports ' + modulePath);
      await access(resolved + '.ts');
    }
  }
});
