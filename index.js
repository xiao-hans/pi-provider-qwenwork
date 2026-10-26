/**
 * pi-provider-qwenwork — 让 Pi 编码代理把「千问办公（QwenWorkCN）」当作模型 Provider。
 *
 * 原理（与 DSH 插件 dsh-qwen-connect 同源，复用其零依赖推理链）：
 *   1. lib/credentials.js 从 %APPDATA%\QwenWorkCN 用 DPAPI+AES-256-GCM 解出
 *      桌面 App 的登录态（auth-v2.dat），无需任何 API Key；
 *   2. lib/signer-session.js 用官方 App 同源的 WASM（research/wasm.bin）对
 *      上游推理请求签名（Cosy-* 头）；
 *   3. lib/chat-shim.js 在 127.0.0.1 随机端口起一个 OpenAI 兼容环回端点，
 *      把 /v1/chat/completions 翻译成上游 agent_chat_generation SSE；
 *   4. 本扩展把该环回端点注册进 Pi（registerProvider），Pi 的
 *      openai-completions 通道直接消费它。
 *
 * 企业 VPC 租户：端点由凭据 JWT 的 iss 自动派生（lib/endpoint.js），
 * 与 DSH 插件行为一致，无需配置。
 *
 * 前置条件：Windows + 已登录的千问办公桌面 App（QwenWorkCN）。
 */
import { startChatShim } from './lib/chat-shim.js';
import { getValidCredential } from './lib/credentials-seam.js';
import { QWENWORK_PROVIDER, FALLBACK_QWENWORK_MODELS, toPiModel } from './lib/models.js';

// 同一进程内重载（/reload 或重复加载）时，先关掉上一代 shim，
// 避免随机端口上的旧 HTTP 服务器堆积。
const RUNTIME_KEY = '__piProviderQwenworkShim__';

export default async function (pi) {
  const previous = globalThis[RUNTIME_KEY];
  if (previous) {
    try {
      await previous.close();
    } catch {
      /* 旧实例关闭失败不阻塞新实例 */
    }
    delete globalThis[RUNTIME_KEY];
  }

  let shim;
  try {
    shim = await startChatShim({
      // 与 DSH 相同：走凭据接缝，token 过期自动刷新并回写轮换结果。
      getCredential: async () => getValidCredential(),
    });
  } catch (error) {
    console.error(
      '[pi-provider-qwenwork] 本地推理端点启动失败：',
      error?.message ?? error,
    );
    return;
  }
  globalThis[RUNTIME_KEY] = shim;

  pi.registerProvider(QWENWORK_PROVIDER, {
    name: 'QwenWork 千问办公',
    // ⚠️ shim.baseUrl 已含 /v1/chat/completions 路径；shim 的路由用
    // startsWith 放行（openai SDK 会在其后追加 /chat/completions），
    // 这是 DSH 侧实测可工作的形状，勿"顺手修正"成 origin。
    baseUrl: shim.baseUrl,
    // 环回共享密钥作为 API Key 回传（Authorization: Bearer <secret>），
    // shim 用常量时间比较校验；密钥只在进程内存在，不落盘。
    apiKey: shim.sharedSecret,
    api: 'openai-completions',
    models: FALLBACK_QWENWORK_MODELS.map((m) => toPiModel(m, shim.baseUrl)),
  });

  pi.on('session_shutdown', async () => {
    if (globalThis[RUNTIME_KEY] === shim) {
      delete globalThis[RUNTIME_KEY];
      await shim.close().catch(() => {});
    }
  });
}
