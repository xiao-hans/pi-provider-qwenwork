# pi-provider-qwenwork

让 [Pi 编码代理](https://github.com/earendil-works/pi)（`@earendil-works/pi-coding-agent`）把**千问办公（QwenWorkCN）桌面 App** 当作一个模型 Provider——零配置、无需 API Key，直接复用你已经登录的 App 账号与积分。

本扩展是 DSH 插件 [`dsh-qwen-connect`](https://github.com/xiao-hans/dsh-qwen-connect)（Gitee 镜像 <https://gitee.com/han-xiaos-whisper/dsh-qwen-connect>）的姊妹项目：二者共用同一套**零外部依赖**的推理链（凭据解密 + 官方同源 WASM 签名 + 本地 OpenAI 兼容网关），只是宿主从 DSH 换成了 Pi。

> **来源说明**：`lib/` 与 `research/` 下的推理链代码 vendored 自
> [gaoqiaoliangjie666/dsh-qwen-connect](https://github.com/gaoqiaoliangjie666/dsh-qwen-connect)
> 的衍生版（含企业 VPC 支持），原始协议逆向 / WASM 签名成果归属上游作者，MIT 许可。
> 本仓库提供 Pi 扩展入口（`index.js`）及流收尾的宿主兼容适配；
> 凭据、WASM 签名与上游推理协议沿用共享实现。

## 工作原理

```
Pi ──(openai-completions)──▶ 本地环回 127.0.0.1:<随机端口>/v1/chat/completions   [lib/chat-shim.js]
                                    │  Bearer 共享密钥 + 环回校验
                                    ▼
                        官方同源 WASM 签名（research/wasm.bin，Cosy-* 头）   [lib/signer-session.js]
                                    │
                                    ▼
              千问办公上游 agent_chat_generation（公有云 或 企业 VPC 网关）
```

1. **读登录态**：`lib/credentials.js` 从 `%APPDATA%\QwenWorkCN` 用 Windows DPAPI + AES-256-GCM 解出桌面 App 的 `auth-v2.dat`（token / refreshToken / user / loginDeviceId）。token 过期时自动走 `deviceToken/refresh` 轮换并原子回写。
2. **签名**：`lib/signer-session.js` 用从官方 `@qoder-ai/qoder-agent-sdk` 提取的 `wasm.bin` 生成 `Authorization: Bearer COSY.*` 与全套 `Cosy-*` 头——与 App 自身走的算法字节级同源。
3. **网关**：`lib/chat-shim.js` 在 127.0.0.1 随机端口提供 OpenAI `/v1/chat/completions`，把请求翻译成上游 SSE 推理接口，再把响应翻译回 OpenAI 格式（含思维链 `reasoning_content`、工具调用、图片输入）。
4. **注册**：`index.js` 在扩展工厂内 `await startChatShim()` 起好本地端点，再 `pi.registerProvider('qwenwork', …)`，把共享密钥当作 API Key 喂回 Pi。

## 前置条件

- **Windows**（凭据解密依赖 DPAPI）。
- 已安装并**已登录**千问办公桌面客户端（QwenWorkCN）。扩展不弹窗登录，只读取 App 已有的登录态。
- Node `^22.19.0 || >=24.0.0`（Pi 自身要求）。

## 安装

### 从 npm 装（推荐）

```bash
pi install npm:@xiao-hans/pi-provider-qwenwork
```

`pi list` 确认已登记；`pi --list-models qwenwork` 应能看到三个档位。想先试一次而不写进 settings：

```bash
pi -e npm:@xiao-hans/pi-provider-qwenwork
```

### 手动放进扩展目录

把本目录放进 Pi 的扩展目录即可（Pi 会自动发现含 `index.js` 的子目录）：

```
# 用户级
%USERPROFILE%\.pi\agent\extensions\pi-provider-qwenwork\

# 或项目级
<你的项目>\.pi\extensions\pi-provider-qwenwork\
```

两种装法都无需 `npm install`——本扩展**零运行时 npm 依赖**，`lib/` 与 `research/` 已自带全部实现。

## 使用

```bash
# 确认注册成功（应看到 provider=qwenwork 的 qwen3.8-flash / pro / qwen3.8-max-preview）
pi --list-models qwenwork

# 一次性对话
pi -p "你好" --model qwenwork/qwen3.8-flash

# 交互模式里用 Ctrl+P 切到 qwenwork
pi --model qwenwork/pro
```

| 模型 id | 档位 | 倍率 | 说明 |
|---|---|---|---|
| `qwen3.8-flash` | 标准 | ×0.1 | Qwen3.8-Flash，日常首选（旧写法 `flash` 仍可用） |
| `pro` | 高级 | ×1 | 默认档 |
| `qwen3.8-max-preview` | Max | ×1.1 | 新 |

均为 1M 上下文、32K 输出、支持图片与思维链。

## 企业 VPC 租户

若你的账号属于企业 VPC 版（凭据 JWT 的 `iss` 形如 `https://<tenant>.vpc.qwenwork.cn/...`），`lib/endpoint.js` 会自动把签名端点派生到租户网关，无需任何配置。VPC 网关常用企业自签证书，因此此时会一次性设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`——这与千问办公 App 自身的运行方式一致（见其 `main.log`），仅在 VPC 租户下触发，公有云账号不受影响。

## 与 DSH 插件的差异

| 能力 | DSH 插件 `dsh-qwen-connect` | 本 Pi 扩展 |
|---|---|---|
| 模型 Provider（对话/工具/图片/思维链） | ✅ | ✅ |
| 输入框实时积分读数 | ✅（DSH 插槽） | ❌（Pi 无对应 UI 位） |
| 设置页账号卡片 | ✅ | ❌ |
| 宿主 | DeepSeek Harness | Pi 编码代理 |

积分请在千问办公 App 或 DSH 里查看；本扩展专注「让 Pi 能用千问办公的模型」。

## 安全边界

- 本地网关只绑 `127.0.0.1`，且要求环回来源 + 进程内生成的 `Bearer` 共享密钥（常量时间比较）；密钥不落盘、不进日志。
- 凭据只在内存中传递；`describeCredentials()` 输出掩码摘要。
- 扩展不向千问办公上游之外的任何地址发起请求。

## 流收尾语义（为什么回合不会「突然不动」）

长时间任务里最容易出现的症状是：模型忽然没了输出、界面一直转、又没有任何报错。
根因通常不在模型，而在代理把「异常结束」说成了「正常结束」。本插件的 shim 按下面五条收尾：

| 情况 | shim 行为 |
|---|---|
| 已开流后上游静默（首个数据块前 90s / 之后 300s） | 写带 `timeout` 标记的 `error` 帧 + `[DONE]`，并 abort 上游；由 Pi 按既有设置执行有界重试 |
| 上游没给 finish 帧就断流 | 有产出 → `finish_reason: "length"`（截断如实上报）；无产出 → `error` 帧 + `network_error` |
| 流里出现过 `tool_calls`，上游却标了 `stop` | 纠正为 `finish_reason: "tool_calls"`，否则下游的 agent 循环会停在工具调用之前 |
| 整回合只有思考、正文与工具调用都没有 | `error` 帧（`empty_answer`）+ `network_error`，让下游重试（实测过 340s 思考、9.5 万字符思考链、0 正文） |
| 客户端中途断开 | abort 上游请求，取消的回合立刻停止生成 |

`FIRST_CONTENT_TIMEOUT_MS`（90 秒）此前只有声明和注释、没有代码引用；现在它是真实的
首帧预算：上游「接了单没排上」的排队态会在 90 秒内明确失败，而不是拖满 300 秒。

空闲超时消息为 `upstream idle timeout: no data for <N>ms`。Pi 根据错误文本识别
可重试的传输故障；`timeout` 标记使该错误进入既有重试策略，重试开关、次数和退避
仍由 Pi 管理。shim 在响应开流后仅报告错误并结束该流，不自行重放请求。

回归测试：`npm test`（`node --test test/unit/stream-robustness.test.mjs`），使用本地
HTTP 假上游验证部分思考后的空闲超时、正常完成与用量、客户端取消，以及请求关联
和本地事件循环阻塞的诊断记录。

## 流停滞诊断

诊断事件追加到系统临时目录的 `pi-qwenwork-trace.log`（JSONL，2MB 上限）。
姊妹包 dsh-qwen-connect 固定写自己的 `dsh-qwen-connect-trace.log`：两边共用
一个文件时，DSH 的活跃流量会在几十分钟内把本侧的事故记录轮转出上限。
单测必须用 `QWEN_CONNECT_TRACE_PATH` 把写入重定向到项目内临时目录
（`test/unit/trace-sandbox.mjs` 已统一处理），否则故障注入的伪数据会混进
真实排障日志。
每条事件包含 `source: "pi-provider-qwenwork"`、进程 `pid` 和单次请求的 `requestId`；
Pi 会话中保存的响应 ID 为 `chatcmpl-<requestId>`，可直接关联日志。同一对话的
`upstreamSessionId` 与单次请求 ID 分开记录。

| 字段 | 含义 |
|---|---|
| `upstreamRequestIds` | 上游响应中的 request/trace 关联头；上游未提供时为空对象 |
| `lastChunkAt`、`idleMs` | 本地读取循环最后取到原始数据块的时间及距今毫秒数；还未收到数据时，时间为 `null` |
| `upstreamChunks`、`upstreamBytes` | 本轮读取到的数据块数与字节数 |
| `thinkingChars`、`outputChars`、`toolCallsEmitted`、`usageSeen` | 思考、正文、工具和用量的进度摘要，不含原文 |
| `eventLoopDelayMs` | 流读取期间以 20ms 分辨率采样的事件循环延迟 max/p99，已从纳秒换算为毫秒；没有样本时为 `null` |
| `watchdogDelayMs` | 看门狗回调相对预定时刻的迟到量，使用单调时钟计算 |
| `abortReason` | 本地终止上游的原因，用于区分空闲超时与客户端取消 |

`idle-watchdog-fired` 与 `stream-end` 会记录完整进度快照。日志只收集指定的关联头，
不保存提示词、模型输出原文、Authorization 或 Cookie。事件循环延迟与回调迟到量
用于识别本地阻塞线索；数据块时间是本地读取时间，不是远端生成时间。历史日志中
缺失的观测字段不能事后补回。

## 已知边界

- 复用 App 登录态意味着：App 退出登录后，扩展会随之报未登录，需重新打开 App。
- 上游对**超高重复输入**（如 `'测'.repeat(500)`）的 `pro` 档可能长时间不返首包，属上游行为，网关已加空闲超时兜底。
- 千问办公 App 大版本升级偶发改变请求契约（历史上 1.0.6→1.2.0 曾因缺 `business` 字段恒定 503）。本扩展的签名逻辑随 `dsh-qwen-connect` 维护，若失效请回溯其排查手册。

## 许可

MIT。`research/wasm.bin` 提取自官方 `@qoder-ai/qoder-agent-sdk`，版权归其原作者；本仓库仅为互操作目的复用。
