/**
 * 测试专用：把 shim 的 trace 诊断写入隔离到项目内临时目录。
 *
 * 为什么需要它：lib/trace.js 写系统临时目录下的共享文件，而故障注入用例
 * （例如 500ms 看门狗）会往里写伪数据，混进用户真正用来排障的日志就会被
 * 误读成线上事故（2026-10-29 在姊妹包 dsh-qwen-connect 上实际踩过）。
 * trace.js 现在在每次写入时才解析路径，所以静态 import 的顺序不再影响隔离。
 *
 * 用法：在测试文件顶部 `import './trace-sandbox.mjs';`（副作用导入）。
 */
import { after } from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpRoot = fileURLToPath(new URL('../../tmp/', import.meta.url));
await mkdir(tmpRoot, { recursive: true });
const traceDir = await mkdtemp(path.join(tmpRoot, 'trace-sandbox-'));

const previous = process.env.QWEN_CONNECT_TRACE_PATH;
process.env.QWEN_CONNECT_TRACE_PATH = path.join(traceDir, 'trace.log');

after(async () => {
  if (previous === undefined) delete process.env.QWEN_CONNECT_TRACE_PATH;
  else process.env.QWEN_CONNECT_TRACE_PATH = previous;
  await rm(traceDir, { recursive: true, force: true });
});
