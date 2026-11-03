# 设计系统

本目录记录界面的长期设计规则：用语义 token 管理系统外观，用有限的比例尺建立层级，用清晰的组件边界区分“可复用行为”和“仅视觉相似”。

文档描述当前应遵守的规则，不记录某次实现的选择过程。设计取舍和需求背景写入 `features/work/`，代码和 token 定义是最终事实来源。

## 文档类型

| 类型 | 回答的问题 | 位置 |
| --- | --- | --- |
| Foundations | 颜色、排版、间距、形状、动效、标签与组件结构的基本规则 | `foundations/` |
| Tokens | token 如何分层、命名和演进 | `tokens/` |
| Components | 什么时候提取组件、组件文档怎么写 | `components/` |
| Patterns | 多个组件如何组合完成任务 | `patterns/`，有真实模式时建立 |
| Contributing | 如何新增或修改设计系统内容 | `contributing.md` |

## 原则

- 先复用语义 token，再考虑新增；原始色值和尺寸不散落在组件里。
- 比例尺保持有限：字号、间距、圆角、动效都使用固定档。
- 行为、状态和交互契约一起复用时才提取共享组件；纯视觉相似用 token 解决。
- 组件状态和交互反馈保持一致。
- 新增规则前先确认现有规则是否已覆盖，避免同义条款。

## 索引

- [颜色](foundations/color.md)
- [排版](foundations/typography.md)
- [间距与布局](foundations/spacing-layout.md)
- [形状与动效](foundations/shape-motion.md)
- [标签与组件边界](foundations/semantics.md)
- [Token 命名](tokens/naming.md)
- [组件文档](components/README.md)
- [参与设计系统](contributing.md)

## 写作约定

- 使用现在时和规范性表述，不写个人偏好、实现历史或“为什么没有采用某方案”。
- 抽象规范不列具体组件、页面或项目的组件清单；项目参考放在对应参考文档中。
- 文档保留规则和判断依据，并给读者可直接使用的档位与取值；同一份值在代码中只定义一处、在文档中只列出一次，不跨文件重复。
