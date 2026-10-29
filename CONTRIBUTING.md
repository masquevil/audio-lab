# 开发指南

## 代码与检查

沿用 Vue 3 Composition API、`script setup`、TypeScript 和 SCSS。包管理器统一 pnpm，依赖变更同时提交锁文件。新增库需有当前需求支撑。

### 目录结构与职责

| 目录/文件 | 职责与边界 |
| --- | --- |
| `src/main.ts` | 应用启动、全局注册、样式导入与挂载，不放业务逻辑 |
| `src/App.vue` | 应用壳与全局布局，渲染路由出口，不实现具体实验 |
| `src/pages/` | 自动路由约定目录，只做 view 引用、路由元信息及必要参数映射，不放业务、页面样式或局部组件；多个路由可引用同一 view |
| `src/views/` | 实际页面展示、交互、私有状态与生命周期；复杂页面在自身目录就近组织局部组件和逻辑 |
| `src/router/` | 路由实例、历史模式、应用级导航配置；typed-router.d.ts 为自动生成类型，不手工编辑 |
| `src/components/` | 跨页面共享 UI，不收纳页面专用组件 |
| `src/hooks/` | 项目共享的 Vue 组合式能力，不写死特定页面参数、策略或展示文案 |
| `src/assets/` | 参与构建的静态资源、主题变量及全局基础样式 |
| `src/utils/`（按需） | 不依赖 Vue 生命周期的工具，优先纯函数，不作为杂物目录 |
| `src/types/`（按需） | 多模块共享类型；局部类型留在使用处 |
| `src/constants/`（按需） | 多模块共享运行时常量；页面常量就近定义，类型不放这里 |
| `src/models/`（按需） | 有实际需要的领域数据与行为模型，不为普通接口类型预建模型层 |

先判断私有还是共享，再按 UI、Vue 有状态逻辑、普通工具、类型或领域模型决定位置。默认就近放置，不为缩短文件盲目上提；提取共享模块需有实际复用或明确独立职责，共享层不能依赖具体 view/page。可复用 hook 的调用方策略通过 options 等接口传入；整个逻辑若属于单个页面，则留在 view 或其局部模块。

原有旧业务内容目录不自动恢复；标注按需的目录明确用途后再创建，不批量添加空架构。当前首页链路为 App → pages/index.vue → views/home/HomeView.vue，首页音频实验属于 view 私有实现。

组件 PascalCase，函数/变量 camelCase；类型就近定义，真正共享时再抽取。具体约定见下方，自动格式使用 Prettier，额外空行约束使用 ESLint。

## 代码规范基线

采用 [Vue 官方风格指南](https://vuejs.org/style-guide/) 的组件设计原则、[typescript-eslint recommended](https://typescript-eslint.io/users/configs/) 的类型安全规则和 [Prettier](https://prettier.io/docs/options) 格式化。以现有 Vue/TypeScript 官方 ESLint 配置为基础，不整套引入其他框架规范；项目具体约定优先。

### Vue 与 TypeScript

- 使用 `<script setup lang="ts">`、Composition API；顶层顺序为 script、template、style，各块之间留一个空行。不要把 template 整块压成一行。
- 模板保留展示与事件绑定；复杂条件或重复推导放 computed/函数。props 向下、事件向上，组件专有状态就近维护。
- 优先类型推断、明确接口和类型收窄；类型导入使用 `import type`；避免用 `any` 或断言掩盖不匹配。
- import 结束与正文之间留一个空行；分组顺序为通用库（含 Node 内置）→ 上级/共享模块 → 当前模块，各组之间空一行。副作用样式导入保留执行顺序，通常与所属模块一起置于末尾。
- 跨模块共享代码优先 `@/hooks/...` 等别名，避免多层 `../../../`；同目录或关系紧密的局部模块用 `./`，少量上级相对导入可保留。按职责而非路径字母排序，不强行重排具有副作用的导入。

```ts
import { computed } from 'vue';

import { formatDuration } from '@/utils/formatDuration';

import LocalPanel from './LocalPanel.vue';

const title = computed(() => 'Audio Lab');
```

上例仅演示分组，按需目录中的模块不是当前项目已有实现。

### 样式

- 样式文件统一 `.scss`，入口 `src/assets/main.scss`；组件样式使用 `<style scoped lang="scss">`。用 `@use` 组织 Sass 模块，按需嵌套，保持选择器浅层。
- “CSS 优先”指 SCSS 内优先使用原生 CSS 声明、custom properties、布局与计算能力，不是优先使用 `.css` 文件；有明确收益时再用 Sass 变量、mixin 等能力。
- 专用 class 使用至少两个单词的 kebab-case（如 `.page-header`、`.tone-actions`）；单词类仅留给真正通用的样式或结构（如共享 `.button`、根层 `.header`）。scoped 不免除命名要求，不为满足命名而添加无意义单词。
- 颜色优先语义化 CSS custom properties（如 `--color-text`、`--color-bg`、`--color-accent`）；原始色值集中定义于主题/token 边界，消费样式使用 `var(...)`。SVG 图标等独立静态资源可保留色值。
- 共享主题/重置放 assets，页面和组件专有样式放对应 SFC，使用 class 避免全局标签选择器污染其他页面。只在确有需求时扩展主题体系。

### 文档

- 入口统一 `README.md`、`CONTRIBUTING.md`、`AGENTS.md`，链接大小写必须与磁盘一致，以兼容 Linux CI。
- Markdown 表格每格两侧各一个空格，不补空格做视觉对齐；分隔行沿用 Prettier 的 `| --- | --- |`，语义对齐标记按需保留。不使用逐表忽略注释或格式插件。
- Markdown 专用配置使用 `printWidth: 1`、`proseWrap: "never"` 触发表格紧凑输出，正文不自动折行；关闭 Markdown 内嵌语言格式化，避免代码示例被极小行宽拆散。代码文件仍使用行宽 100，示例代码应按其语言规范编写。
- 不对 PM 原文批量格式化；规范只维护在本文件，skills 和 AI 入口引用即可。

### 检查与验证

ESLint 自动检查 Vue 块间空行和 import 后空行；SCSS 编译及格式由构建/Prettier 检查。import 语义分组、样式职责与 token 使用由代码评审确认，不用字母排序冒充架构判断。

```bash
pnpm lint          # 只检查
pnpm lint:fix      # 修复 lint
pnpm format        # 格式化
pnpm check         # 交付门禁
```

`pnpm check` 执行 lint、格式检查、类型检查和生产构建。当前未引入单元测试框架或格式配置专项测试；升级 Prettier 时需检查紧凑表格行为。音频示例通过浏览器交互、生命周期验证与构建检查；复杂逻辑出现时再引入合适的自动化测试，修复缺陷时补回归验证。真实听感、移动端限制不能仅由 mock 证明。

## 构建与部署

自动路由由 Vite 的 Vue Router 插件扫描 pages 生成，插件在 Vue 插件之前注册，并接入文件路由 HMR。

路由模式沿用环境约定：`VITE_TARGET_ENV=pages` 或 `hash` 使用 hash，未设置或其他值使用 history。history 部署需要服务端将应用内路由回退到 index.html；不支持回退的静态托管使用 hash。该变量由 Vite 在启动/构建时读取，修改后需重启开发服务或重新构建。

Vite 的 getBase() 沿用原配置，pages 和默认环境均返回 `/`。GitHub Pages CI 设置 `VITE_TARGET_ENV=pages`，本地 `pnpm dev` 默认 history。

- `pnpm build` 生成静态产物 `dist/`；`pnpm preview` 仅用于本地预览已生成的产物，不是启动开发页面的必需步骤，也不用于生产托管。
- 当前资源基路径为 `/`；若将来部署到子路径，需要另行确认并修改 getBase()，当前不额外引入环境变量。
- `pnpm deploy` 将当前已提交 HEAD 推送到 origin 的 deploy 分支，要求工作区干净，不自动提交、不强推。分支分叉时会失败，需先检查历史再处理。
- GitHub Actions 在 deploy 分支触发检查和构建，发布到 gh-pages 分支。首次使用需允许 Actions 写入仓库（Settings → Actions），在 Pages 选择 gh-pages 分支。

无明确授权不运行推送或部署；CI 配置存在不代表已验证远程部署成功。

## 协作与交付

需求流转见 [features/README.md](features/README.md)。改动前阅读现有实现和用户未提交修改，保留无关改动。评审关注需求覆盖、错误路径、资源释放、可访问性和依赖范围。提交前运行检查，并在需求记录中写明实际测试、未验证内容和风险；AI 自检不等同独立人工 review，最终由 PM 验收。

不要提交密钥、构建产物或临时 AI 日志；浏览器中的 `VITE_*` 都是公开配置。无明确授权不推送、不部署、不重写 Git 历史。
