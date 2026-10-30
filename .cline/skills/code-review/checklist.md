# 代码评审核查清单

原则与目录边界见 [开发指南](../../../CONTRIBUTING.md#代码规范基线)。本文件是 reviewer 的详细核查依据，进入审查阶段加载；不是开发阶段的默认输入。开发有具体疑问时可查对应条目。不适用项跳过，不为满足清单引入额外功能或抽象。

## 设计与状态

- [ ] 状态、资源及修改入口的所有者明确；调用方不需要“赋值后再同步”才能保持正确。
- [ ] 模型不捕获组件 emit、DOM 或其他无关外层对象；外部操作有明确执行及清理边界。
- [ ] 相关状态与动作聚合，初始化与动作分开；没有无用途的转发对象、工厂或预留 API。
- [ ] 多处使用的协议有唯一契约，无散落的字符串拼接/解析约定、重复配置或掩盖异常的默认值。
- [ ] 释放/重置后可重新使用，重复清理安全，实例隔离；异步失败、取消、旧结果、卸载均有对应路径。
- [ ] 删除功能同时删除专属类型、方法、监听和文档说明。

### 静态判定依据

| 检查对象 | 不通过的信号 | 通过依据 |
| --- | --- | --- |
| 状态封装 | 调用方先改 ref，再调用同步方法才正确 | 一个操作完成约定的变化；外部无法绕过必要步骤 |
| 模型边界 | 模型函数引用外层 emit、document 或展示文案 | 仅依赖声明的输入与自身状态，返回可断言的结果 |
| 初始化与重置 | reset 删除了 action 假定始终存在的容器 | 追踪初始化、修改、重置代码，不变量在各路径成立 |
| 异步归属 | catch/finally 无条件改写当前实例状态 | 代码明确校验请求或会话归属，旧结果不能写入新状态 |
| 清理 | 移除监听时重新创建匿名函数 | 注册和移除使用相同引用；代码覆盖重复清理与卸载后的回调保护 |

```ts
// 不通过：依赖外部对象，并要求调用方拼接步骤
function selectItem(id: string) {
  selectedId.value = id;
  emit('select', id);
}

// 核查模型：以返回结果驱动调用层，而非向模型塞 emit 回调
const changed = selection.selectItem(id);
if (changed) emit('select', id);
```

以上反例指模型边界；组件事件适配层调用 emit 本身是正常职责。

## Vue 与 TypeScript

- [ ] SFC 为 script → template → style；使用 script setup 与 TypeScript，块间空行。
- [ ] 模板事件入口统一 handleXxx；输入转换在脚本中，业务动作不误命名为事件集合。
- [ ] Props、Emits 及组件专有辅助类型留在组件；共享类型才提取，模型可按独立职责拆分。
- [ ] 复杂对象、配置和模块接口有显式类型；配置映射的键、值均受约束，不能只由当前对象内容推断合法结构。
- [ ] 有限取值不放宽为 string；相关字段用判别联合等方式约束；类型注释交代非直观字段的单位、范围及用途。
- [ ] 类型导入使用 import type；没有以 any、双重断言或未经证明的非空断言绕过检查。
- [ ] 导入分组为通用库 → 共享/上级模块 → 当前模块，组间及正文前空行；共享路径优先 @/，局部路径就近，副作用顺序不变。
- [ ] 监听注册/移除使用同一函数引用；组件不通过监听无关业务参数反向协调其他模块。

### 类型与文件检查示例

```ts
// 不通过：取值范围与配置形状都只能从当前值猜测
const mode = ref('compact');
const configs = { compact: { gap: 8 } };

// 通过：增加或遗漏模式、拼错字段都应被编译器拒绝
type Mode = 'compact' | 'comfortable';
interface ModeConfig {
  /** 内容间距，单位 px。 */
  gap: number;
}
const mode = ref<Mode>('compact');
const configs: Record<Mode, ModeConfig> = {
  compact: { gap: 8 },
  comfortable: { gap: 16 },
};
```

- 从声明与调用方检查非法取值是否受类型约束；“当前数据恰好正确”不算类型契约成立。
- `interface Props` / `interface Emits` 出现在独立 types 文件且仅被一个组件使用时，检查能否留在组件内；不据此搬回真正共享的领域类型。
- SFC 顶层检查形态为 `<script setup lang="ts">`、`<template>`、`<style scoped lang="scss">`，块之间空一行；全局样式文件不适用 scoped 要求。

```ts
import { ref } from 'vue';

import type { SharedConfig } from '@/types/config';

import LocalPanel from './LocalPanel.vue';

const isOpen = ref(false);
```

此处路径仅示意分组，不要求创建示例模块。检查副作用导入时追踪执行依赖，不按字母机械重排。

## 命名与组织

- [ ] 组件/类型 PascalCase，函数/变量 camelCase，class kebab-case。
- [ ] 动作名称明确动作和对象，查询名称表达条件；没有脱离上下文的 begin/end 等名称。
- [ ] 按类型、初始化、动作、事件适配、生命周期组织；逻辑组间空行，相关函数相邻。
- [ ] 注释说明职责、原因和约束，不复述代码或记录修补对话。

具体核对：事件入口 `handleItemClick(event)` 负责转换输入，动作 `selection.selectItem(id)` 负责状态，查询 `selection.isSelected(id)` 返回判断。若集合叫 inputEvents，却混有普通状态动作，或函数叫 begin 却无法从名字确定对象，应报告命名问题。分组注释描述当前职责，不使用“修复之前的问题”等历史说明。

## SCSS

- [ ] 组件使用 scoped SCSS，Sass 模块使用 @use；未为原生 CSS 可完成的事新增 mixin 或框架。
- [ ] 全局 token 与专属 token 边界清楚，按排版、表面、内容、交互等语义分组；token 和规则均有适量空行及职责注释。
- [ ] 页面/组件选择器全部为 class；专用 class 至少两个有意义的单词，标签选择器仅用于主题和基础重置。
- [ ] 子项与状态浅层嵌套；没有平铺无关规则、重复基础块或过深选择器。
- [ ] 声明按定位/层叠 → 布局 → 盒模型 → 外观 → 内容 → 交互排列；flex/grid 属性集中，组间空行。
- [ ] 原始颜色在对应 token 边界，消费端使用语义 CSS 变量；自然继承不重复声明，必要覆盖有明确值或变量来源。
- [ ] 控件排版等默认差异集中 reset；清理冗余声明，不用局部 inherit 掩盖基础样式缺失。
- [ ] 响应式规则的选择器和优先级能覆盖基础规则；状态类、尺寸约束与声明一致。视觉表现由研发验证。

### 声明顺序与聚合示例

```scss
// 浮层及其标题
.floating-panel {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;

  display: flex;
  flex-direction: column;
  gap: 8px;

  width: 240px;
  padding: 12px;

  border: 1px solid var(--color-border);
  background: var(--color-surface);

  font-size: 14px;
  color: var(--color-text);

  .panel-title {
    margin: 0;
    font-size: 16px;
  }

  &.is-hidden {
    display: none;
  }
}
```

| 细节 | 不通过 | 应检查的写法 |
| --- | --- | --- |
| 元素耦合 | `.panel h2 span` | 命名明确的 `.panel-title`、`.title-accent` |
| 状态选择器 | 父元素内写 `.is-hidden`，实际类却在父元素自身 | 自身状态用 `&.is-hidden`，子项用后代 class |
| 全局污染 | 专属配色全部挂在 `:root` | 专属 token 放在对应组件/共享视觉模块作用域 |
| 分组 | flex 属性被字体、padding 等打散 | 布局属性相邻；盒模型、外观、内容分别成组 |
| 冗余 | flex 子项无必要地重复 display，组件逐个补字体继承 | 检查布局上下文、继承与 reset 声明；运行时疑点交研发验证 |
| 响应式 | 基础 `.panel .panel-title`，窄屏仅 `.panel-title` 导致无法覆盖 | 核对选择器层次、声明顺序和优先级 |

检查 token 时同时查看定义与消费端：定义按语义分组、有职责注释；消费端不重复原始颜色。检查状态与响应式规则的技术一致性，不承担视觉验收。

## 文档与审查结论

- [ ] 链接大小写与磁盘一致；表格每格两侧单空格、不做视觉对齐，使用现有 Prettier 配置。
- [ ] 规范无业务实现案例、历史辩解或重复规则；需求结果记录在 features/work。
- [ ] findings 有代码位置、规范或技术依据、影响及建议，不以偏好替代项目约定。
- [ ] 审查结论不混称测试通过；不能静态确定的疑点单独交研发验证。
- [ ] 音频改动另按 [web-audio](../web-audio/SKILL.md) 核查，不在这里重复音频专项规则。

结论记录为“位置 → 技术问题/违反约定 → 影响 → 建议”。可以审查测试代码的质量，但执行测试、构造运行场景及核对产品交付由研发验证或 QA 负责。
