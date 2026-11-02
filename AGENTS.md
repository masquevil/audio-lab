# AI 工作入口

先了解 [开发指南](CONTRIBUTING.md)、[需求流转](features/README.md) 和 [当前状态](features/current-status.md)，再读取相关需求与代码。已在有效上下文且未变的内容直接复用，缺失时按章节补读，不因阶段切换重复全文读取。用户最新指令优先；发现文档冲突时明确指出。

## 按需加载 skills

开发按本次改动补读 CONTRIBUTING 的 Vue/TypeScript、样式或文档章节，review 只补读缺失、变更或新领域内容。规范未来拆分为 CONTRIBUTING/ 多文件时仍按主题加载，保留根文件为开发指南入口；不把 AI 阅读策略写入面向开发人员的规范。

开发默认读取 [开发指南](CONTRIBUTING.md)、需求及相关代码，不加载 code-review checklist；遇到具体技术疑问可按需查阅单个条目，不扩展为全文必读。进入技术审查阶段再加载 [评审清单](.cline/skills/code-review/checklist.md)，检查最终代码；两处分别维护，不复制规则。

按需求流转中的确认点推进：关键方案先评审、明确确认后开发，普通细节自主处理；宣布方案不等于 PM 确认。

- 开发、修复、评审需求时读取 [.cline/skills/feature-flow/SKILL.md](.cline/skills/feature-flow/SKILL.md)。
- 开发按 [.cline/skills/dev-cs-vue/SKILL.md](.cline/skills/dev-cs-vue/SKILL.md) 执行；交付前进入 code-review 阶段，读取审查流程与详细清单。code-review 只负责最终代码的规范、设计和技术审查，不以了解产品功能为前提。研发验证、QA 和 PM 验收另按需求流程执行；不把场景测试、故障注入或功能验收纳入 reviewer 职责。
- 涉及声音或 Web Audio 生命周期时额外读取 [.cline/skills/web-audio/SKILL.md](.cline/skills/web-audio/SKILL.md)。
- 合成或改进以噪声/纹理为主的环境声（雷、雨、风、火等），需要判断"像不像真实录音"时，读取 [.cline/skills/sound-imitation/SKILL.md](.cline/skills/sound-imitation/SKILL.md)，方法细节与实测基准在 [docs/sound-synthesis](docs/sound-synthesis/method.md)。
- 修改文档、规范或 skill，整理反馈与经验时读取 [.cline/skills/doc-maintenance/SKILL.md](.cline/skills/doc-maintenance/SKILL.md)，按其文件职责和更新流程选择落点。

这些是项目内文件，若客户端没有自动发现 skills，直接读取对应文件；不要声称已调用不存在的工具。保持 skills 小而专一，只将重复出现的项目经验提炼进去。

## 本项目执行偏好

- 普通 npm 依赖使用不主动增加页面版权/第三方 LICENSE 展示、声明文件或全依赖许可专项，不反复将其列为本个人项目的开发、review 或验收阻塞项。只有用户明确要求相关审查时再开展；保留项目自身和依赖包原有文件，不修改 node_modules。
- 交互优先处理鼠标点击及 `:hover`、`:focus` 状态。不主动添加面向 Tab 导航的 `:focus-visible` 专项样式、测试或整改要求，也不将缺少该样式作为 review 阻塞项；用户明确要求键盘交互时再处理。

## 文档边界

文件职责、反馈落点、规则迁移与文档验证统一见 [文档维护](.cline/skills/doc-maintenance/SKILL.md)。AGENTS 只保留入口与执行边界，不承载面向开发者的详细规范。

以最小可验证实现推进，不提前实现未来产品方向。交付时报告变更、真实验证结果、风险和 PM 验收步骤；未执行的检查明确标记，不能把自检称为独立 QA 或人工验收。
