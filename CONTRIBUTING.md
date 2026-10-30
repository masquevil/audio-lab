# 开发指南

## 本地开发

使用 Node.js 24（版本范围见 package.json）、pnpm、Vue 3 Composition API、TypeScript 和 SCSS。

```bash
pnpm install
pnpm dev
pnpm check
```

| 命令 | 用途 |
| --- | --- |
| `pnpm lint` / `pnpm lint:fix` | 静态检查 / 自动修复 |
| `pnpm format:check` / `pnpm format` | 格式检查 / 格式化 |
| `pnpm type-check` | 类型检查 |
| `pnpm build` | 类型检查与生产构建 |
| `pnpm check` | lint、格式、类型和构建门禁 |

## 目录结构与职责

| 位置 | 职责 |
| --- | --- |
| `src/main.ts`、`src/App.vue` | 启动、全局注册、应用布局与路由出口 |
| `src/pages/` | 自动路由入口，仅引用 view、配置元信息和映射参数 |
| `src/views/` | 页面实现；内部按需设置 components、hooks、models、types、constants |
| `src/components/`、`src/hooks/` | 跨页面 UI 与组合式逻辑 |
| `src/models/`、`src/utils/` | 按需提取的共享状态模型、无状态工具 |
| `src/types/`、`src/constants/` | 跨模块类型与运行时配置 |
| `src/assets/` | 静态资源、共享样式、主题与基础重置 |
| `src/router/` | 路由实例；typed-router.d.ts 自动生成，不手改 |
| `tests/` | 单元测试；现状和执行方式见 [说明](tests/README.md) |

私有实现就近放置，真正共享时再提取；组件专属 Props、Emits 留在组件内。共享层不依赖具体页面。不创建空架构目录。

## 代码规范基线

格式以 Prettier、静态检查以现有 ESLint 配置为准；以下约定用于设计和人工评审。

### 设计与职责边界

- **单一职责**：组件负责展示和交互，状态模型负责数据与转换，hook 负责响应式和生命周期，资源模块负责外部 API。
- **明确所有权**：每份状态和资源有明确所有者；初始化、操作、重置及销毁维持同一不变量。
- **隔离副作用**：计算优先纯函数；状态模型只修改自身状态，通过返回值表达变化。外部操作由组件或资源层执行，并负责失败处理和清理。
- **显式契约**：依赖通过参数或 import 表达；跨模块协议由统一类型定义，不依赖隐式字符串格式或调用顺序。
- **完整操作**：必须同步完成的状态变化和副作用封装为操作接口；受约束状态不允许外部任意修改。
- **适度抽象**：按独立职责、状态或资源边界提取，不为缩短文件或统一外形添加转发层。只实现当前需求，删除功能时同步清理相关接口与监听。
- **异步安全**：区分请求、成功和结束状态；旧请求不得影响新状态。处理取消、重复操作、失败和卸载。

模型返回状态变化，组件决定如何通知外部：

```ts
// models/selection.ts
export function createSelection() {
  const selectedIds = new Set<string>();

  function selectItem(id: string): boolean {
    if (selectedIds.has(id)) return false;
    selectedIds.add(id);
    return true;
  }

  return { selectItem };
}

// 组件内：外部操作不进入模型
function handleItemClick(id: string) {
  if (selection.selectItem(id)) emit('select', id);
}
```

### 命名与代码组织

- 组件与类型使用 PascalCase，变量和函数使用 camelCase，样式类使用 kebab-case。
- 名称说明职责，区分事件处理、状态操作与查询，避免含义不明的缩写和宽泛名称。
- 按职责聚合相关状态与操作；文件内依次组织类型、初始化、查询与动作、事件适配、生命周期。组间留空行，复杂分组加简短注释。
- 初始化与动作分开，紧密协作的代码相邻；不强制所有函数包装为对象。
- 注释说明原因、约束、单位和生命周期，不复述实现。

### Vue 与 TypeScript

- 沿用 Composition API 与单文件组件约定，保持组件结构一致。
- 模板只做展示和事件绑定；复杂推导放 computed 或函数，事件转换留在脚本中。props 向下、事件向上。
- 复杂结构和模块边界有明确类型契约，准确表达合法状态与字段关系；局部简单值允许推断。不以类型逃逸掩盖设计缺陷。
- 导入按依赖层次组织，路径体现共享与局部关系，保留具有副作用的执行顺序。

配置有明确契约，组件私有接口就近定义：

```ts
type Density = 'compact' | 'comfortable';
interface DensityConfig {
  /** 相邻内容之间的距离，单位 px。 */
  gap: number;
}

const densityConfigs: Record<Density, DensityConfig> = {
  compact: { gap: 8 },
  comfortable: { gap: 16 },
};

// SFC 内
interface Props {
  density: Density;
}
const props = defineProps<Props>();
```

### 样式

- 使用 SCSS 和组件局部样式；优先原生 CSS 能力，控制作用域及选择器复杂度。
- **先划分作用域**：全局只保留通用 token、reset 和基础排版；共享组件 token 按需加载并限制作用域，页面专有样式留在页面。
- **再按职责分组**：变量按排版、表面、内容、交互等语义组织；规则按功能区域聚合，组间空行并加简短注释。JS/TS 和样式同样遵循职责聚合，不连续堆砌无关声明。
- 页面/组件使用语义明确的 class，子项与状态按功能聚合；主题和基础重置可用全局选择器。
- 声明由外到内组织，同类属性相邻，布局、外观与内容分组清晰。
- 原始色值集中在对应作用域的 token 中，消费端使用语义变量；变量定义与用途边界保持一致。
- 自然继承的属性不重复声明；覆盖使用明确值或变量，避免显式 inherit。控件默认差异由统一 reset 处理。
- 保持响应式与基础规则的优先级一致；清理无效、重复及已无用途的声明。

样式按功能聚合，声明从布局到内容分组：

```scss
// 面板内容与状态
.panel-body {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 12px;
  border: 1px solid var(--color-border);

  color: var(--color-text);

  .panel-title {
    margin: 0;
    font-size: 16px;
  }

  &.is-disabled {
    opacity: 0.5;
  }
}
```

### 文档

- 本文件维护面向贡献者的原则；[评审清单](.cline/skills/code-review/checklist.md)维护具体核查项，不重复抄写原则。业务需求与验收记录放在 features。
- 使用项目已有 Prettier 配置；Markdown 表格每格两侧一个空格，不做视觉对齐。正文不自动折行，代码示例保持可读。
- 链接大小写与文件名一致，不批量格式化原始需求。

## 验证与提交

- 提交前运行 `pnpm check`，针对行为变化补回归验证；测试代码统一放在 tests，框架未定时不擅自引入依赖。
- 有状态逻辑覆盖操作后重用、重置后重用、重复清理及实例隔离；异步逻辑覆盖失败、取消、旧结果和卸载。
- 评审检查职责、所有权、依赖、类型、命名和抽象必要性。静态检查通过不代替设计与行为验证。
- 新依赖须有实际需求，更新锁文件。保留无关工作区改动，不提交密钥、构建产物或临时日志；`VITE_*` 均为公开配置。
- 说明变更、实际验证、限制及兼容性风险；流程见 [需求工作区](features/README.md)。

## 构建与部署

- 自动路由插件先于 Vue 插件注册，扫描 pages 并支持路由 HMR。
- `VITE_TARGET_ENV=pages` 或 `hash` 使用 hash 路由，其余使用 history。history 需服务器回退到 index.html；环境变量修改后重启或重新构建。
- 资源基路径当前为 `/`，子路径部署需调整 Vite 配置。`pnpm build` 输出 dist，`pnpm preview` 仅供本地预览。
- `pnpm deploy` 要求干净工作区，将已提交 HEAD 推至 origin/deploy；不自动提交或强推。Actions 构建并发布至 gh-pages，需启用仓库写权限及 Pages 分支。
- 推送、部署和历史重写须明确授权。

## 参考资料

- 组件设计：[Vue 官方风格指南](https://vuejs.org/style-guide/)。结合当前 Vue 3 Composition API 使用，项目明确约定优先。
- 设计与类型：[Vue Composables](https://vuejs.org/guide/reusability/composables.html)、[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)。
- 工具规则：[typescript-eslint](https://typescript-eslint.io/users/configs/)、[Prettier](https://prettier.io/docs/options)。

参考其适用原则；项目目录、命令与具体规则以上文为准。
