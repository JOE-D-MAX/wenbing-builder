# 随机配置：复用与选型

核查日期：2026-10-29。目标是在已有模块工作台随机搭配背景、配色、动效，保留内容并可撤销。

| 项目 | GitHub 星数快照 | 维护与许可 | 实际功能和集成成本 |
| --- | ---: | --- | --- |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | 26,354 | [最新提交 2026-10-21](https://github.com/GrapesJS/grapesjs/commit/f47fbde61496463b30a675e1df6da6d3bb1ab325)，[v0.23.8 于 2026-10-15 发布](https://github.com/GrapesJS/grapesjs/releases/tag/v0.23.8)，[核心 BSD-3-Clause](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE) | 提供区块、样式管理、资产与存储等完整编辑能力。引入需要适配现有项目数据、预览和历史记录，超出增加随机风格操作的需要。 |
| [randomColor](https://github.com/davidmerfield/randomColor) | 6,120 | [最新提交 2025-12-03](https://github.com/davidmerfield/randomColor/commit/2ba1029545ff481092b380e650b017b548ceae90)，[0.6.2 于 2025-12-03 发布](https://github.com/davidmerfield/randomColor/releases/tag/0.6.2)，[CC0-1.0](https://github.com/davidmerfield/randomColor/blob/master/LICENSE.md) | 支持色相、明暗、数量和种子参数，生成随机颜色。没有提供本项目需要的背景/正文/强调色成套组合和区块动效约束；引入后仍需实现这些规则。 |

星数、提交和发布信息来自 GitHub API；许可证另外核对实际文件。GrapesJS 根目录许可文件为符号链接，应以核心包的许可文本为准。

本次选择复用项目已有 `PALETTE_LIBRARY`、`BACKGROUND_LIBRARY`、`EFFECT_LIBRARY`、画布渲染、撤销和自动保存。自行补充随机组合和兼容约束；没有增加依赖或复制第三方代码，因此无需新增第三方许可文件。保留现有依赖及其许可说明。

## 7–8 页整站配置

继续核查 [GrapesJS Pages 官方文档](https://grapesjs.com/docs/modules/Pages.html)：提供多页面数据管理、添加、选择和删除 API，但核心包不附带页面管理界面，也没有满足本项目内容保护规则的整站随机配置。现有制作器已具备最多 8 页的数据模型、页面菜单、导航渲染、撤销和草稿保存。因此复用这些能力，新增整站编排函数，补齐页面和导航、随机搭配已有样式库；无需引入另一套编辑器或随机颜色依赖。

后续按用户要求扩展为输入 1–10 页，沿用相同实现并将项目上限调整为 10；此项范围调整无需新增依赖。

用户随后明确要求在原有纵向画布中直接生成和编辑所有网页。因此将现有 `SortableBlock`、`CanvasDrop` 和区块渲染按项目页面纵向展开，复用已安装的 dnd-kit；拖拽与编辑操作明确使用目标页面标识。删除额外缩略图网格和静态缩略模式，保留原有动效可见性控制、视频暂停及互动预览。不增加外部依赖。
