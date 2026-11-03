# PageHeader

## 用途

统一页面页头：eyebrow、标题、强调片段和可选简介。所有页面使用同一结构，入口页可通过 `size="large"` 使用更大标题。

## 结构

`header.page-heading`：左侧标题组（`p.page-eyebrow`、`h1.page-title`、`span.title-accent`），右侧可选 `p.heading-description`。

## 变体

| 属性 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `default` / `large` | `default` | `large` 标题 32px；≤700px 回到 28px |

## 状态

无交互状态。≤700px 改为纵向排列，简介位于标题下方，间距收窄。

## 行为

纯展示组件，不发起请求或播放；标题与强调片段按传入字符串直接拼接。

## 内容

- `eyebrow`：模块编号或英文短语，如 `PLAYGROUND / 01`。
- `title` + `accent`：标题拆成两段，`accent` 使用强调色；需要空格时由调用方在字符串中保留。
- `description`：一句话说明页面能力；省略时不渲染右侧内容。
- 每页只使用一次，标题层级由页面内容决定。

## 元素与状态

原生 `header`、`h1`、`p`；不包含按钮或链接。

## API

实现：`src/components/PageHeader.vue`。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `eyebrow` | `string` | 是 | 编号或短标签 |
| `title` | `string` | 是 | 标题主体 |
| `accent` | `string` | 是 | 跟随强调色的标题片段 |
| `description` | `string` | 否 | 页头简介 |
| `size` | `'default' \| 'large'` | 否 | 标题档位 |

## 相关模式

与 `LabPageBody` 一起使用；`large` 只用于入口页，并与 `LabPageBody` 的 `size="large"` 顶部留白同时设置。
