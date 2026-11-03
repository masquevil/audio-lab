# LabPageBody

## 用途

页面内容容器，统一最大宽度、水平留白和上下留白，并与导航共用同一栅格。每个页面只使用一次。

## 结构

`main.lab-page-body` + 默认插槽。导航在 `App.vue` 中独立渲染，页面容器只负责内容区域。

## 变体

| 属性 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `default` / `large` | `default` | `large` 只把顶部留白改为 32px，用于入口页 |

## 状态

无交互状态。≤700px 时水平留白随全局 `--page-gutter-horizontal` 收窄到 16px。

## 行为

纯布局组件，不处理滚动、加载或路由。

## 内容

放入页头、页面区块和页面级说明；区块之间的间距由区块自身 margin 控制。

## 元素与状态

原生 `main`；页面只有一个主内容区。

## API

实现：`src/components/LabPageBody.vue`。

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `size` | `'default' \| 'large'` | `'default'` | 顶部留白档位 |

## 相关模式

- 与 `PageHeader` 组合，保证标题左边缘与导航对齐。
- 路由加载态 `LabRouteView` 也使用它承载提示文案。
