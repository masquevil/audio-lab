# AI 工作入口

先了解 [开发指南](CONTRIBUTING.md)、[需求流转](features/README.md) 和 [当前状态](features/current-status.md)，再读取相关需求与代码。已在有效上下文且未变的内容直接复用，缺失时按章节补读，不因阶段切换重复全文读取。用户最新指令优先；发现文档冲突时明确指出。

## 按需加载 skills

开发按本次改动补读 CONTRIBUTING 的 Vue/TypeScript、样式或文档章节，review 只补读缺失、变更或新领域内容。规范未来拆分为 CONTRIBUTING/ 多文件时仍按主题加载，保留根文件为开发指南入口；不把 AI 阅读策略写入面向开发人员的规范。

生成代码前遵循 [代码规范](CONTRIBUTING.md#代码规范基线)。SCSS、CSS 变量、import 分组及文档紧凑表格以此为唯一约定来源。

按需求流转中的确认点推进：关键方案先评审、明确确认后开发，普通细节自主处理；宣布方案不等于 PM 确认。

- 开发、修复、评审需求时读取 [.cline/skills/feature-flow/SKILL.md](.cline/skills/feature-flow/SKILL.md)。
- 开发过程中读取 [.cline/skills/dev-cs-vue/SKILL.md](.cline/skills/dev-cs-vue/SKILL.md)；开发完成、交付 PM 验收前统一读取 [.cline/skills/code-review/SKILL.md](.cline/skills/code-review/SKILL.md)。
- 涉及声音或 Web Audio 生命周期时额外读取 [.cline/skills/web-audio/SKILL.md](.cline/skills/web-audio/SKILL.md)。

这些是项目内文件，若客户端没有自动发现 skills，直接读取对应文件；不要声称已调用不存在的工具。保持 skills 小而专一，只将重复出现的项目经验提炼进去。

## 文件边界

原始需求在 features/pools；实施记录在 features/work；当前状态只保留活动项。长期架构决策有实际需要时再建 docs，代码局部说明就近写。临时计划、调试日志、截图放 `.ai/`（已忽略），有验收价值的结论摘要写回需求记录。不要将整段对话或复制的代码当成长期文档。

以最小可验证实现推进，不提前实现未来产品方向。交付时报告变更、真实验证结果、风险和 PM 验收步骤；未执行的检查明确标记，不能把自检称为独立 QA 或人工验收。
