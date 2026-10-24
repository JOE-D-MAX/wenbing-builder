# dnd-kit 第三方说明

模块制作页使用 [dnd-kit](https://github.com/clauderic/dnd-kit) 提供拖动、放置、排序和键盘交互。原作者为 Claudéric Demers，所用包均为 MIT 许可。

本目录许可证逐字复制自本项目实际安装的 npm 包，不由摘要替代：

| 包与锁定版本 | 许可证文件 |
| --- | --- |
| `@dnd-kit/core` 6.3.1 | [core-LICENSE.txt](core-LICENSE.txt) |
| `@dnd-kit/sortable` 10.0.0 | [sortable-LICENSE.txt](sortable-LICENSE.txt) |
| `@dnd-kit/utilities` 3.2.2 | [utilities-LICENSE.txt](utilities-LICENSE.txt) |
| `@dnd-kit/accessibility` 3.1.1（core 的依赖） | [accessibility-LICENSE.txt](accessibility-LICENSE.txt) |

来源为对应 `node_modules/@dnd-kit/<包名>/LICENSE`。发布本项目源码及含这些库的构建产物时，保留这些版权与许可说明。模块制作页生成的独立 HTML 不包含 dnd-kit 编辑器代码。

依赖风险核查：本轮 `npm audit --json` 返回原项目依赖树共 30 项告警；新增的上述四个 dnd-kit 包及其直接运行时依赖 `tslib` 均未出现在告警列表中。这仅表示该次 npm 公告匹配未报告它们的已知漏洞，不等于对整站安全作保证。本次没有自动升级或修改其他已有依赖。

选型依据、React peer 兼容范围与新旧 API 区别见 [调研记录](../block-studio-research.md)。
