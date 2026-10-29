import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectStall, looksLikeAbandonedStep } from '../../lib/stall-guard.js';

const ABANDONED = [
  '我的上一次编辑把 `ScriptedRegistrar` 的类体删坏了（L85 是真错，其余是 androidTest 源集的 LSP 陈旧噪声）。整份重写干净：',
  '以 Gradle 为准。先把故障脚本改成共享计数器（这样显式 retry 能在同一 script 上放行），再编译上机：',
  '开始。先登记任务，再从低影响项跑起：显式 shutdown → 进程退出后已存配置恢复 → 键盘热插拔（物理拔插需要你配合）。',
  '接缝通了，真机层解锁。我先把跨进程与 Parcel 的自动化测试写进 instrumented 源集（只新增文件，不碰你的接缝改动）。',
];

const FINISHED = [
  '状态标为 **待修复、待验证**。文档引用与差异检查通过。',
  '未覆盖：HOTPLUG/IDENTITY 物理热插拔、RECOVER 枚举异常注入、LIFE-01 显式 shutdown、§6.1 宿主恢复。',
  '再补 JVM 注入用例——需要我来做的话说一声。',
  '其中 ② 是纯本机可完成的，要我现在做就说一声。',
  '需要我直接按这个顺序在设备上开始跑第一类吗？',
  '请在设备端重新开启 adb（网络调试或重插 USB），恢复后我立刻重编并跑 `UsbStartupFailureTest` 四项，再同步 06/08/09/待收口。',
  'Flex3 目前 adb 离线，设备重新上线后把新地址给我即可续跑设备侧。',
  '以后你提到「待办清单」或「待收口事项」，我会优先查看： `docs/reports/2026-10-26_待收口事项.md` 以这份文档的最新状态为准。',
  '可以，主人。以后遇到大任务，我会先查技能列表（skills_list）看有无匹配的技能或插件，命中则加载后再动手；无匹配才直接执行。查询本身开销极小，只在任务开始时做一次。',
  '记住了。以后每次遇到大任务，我先查技能列表再动手。',
  '好的。下次如果构建失败，我先跑一遍 clean 再重试。',
  '以后遇到跨模块重构时，我会按以下顺序执行：',
  '',
];

test('宣告了下一步却停下的收尾 → 判定为半途停止', () => {
  for (const text of ABANDONED) {
    assert.equal(looksLikeAbandonedStep(text), true, text);
    assert.equal(detectStall(text).stall, true, text);
  }
});

test('总结、提问、确认长期规则或交还用户操作的收尾 → 不续跑', () => {
  for (const text of FINISHED) {
    assert.equal(looksLikeAbandonedStep(text), false, text);
    assert.equal(detectStall(text).stall, false, text);
  }
});
