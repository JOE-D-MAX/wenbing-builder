# 编辑式视觉模板：开源复用核查

核查日期：2026-10-21。先以 GitHub 搜索筛选，再用 GitHub 官方仓库、许可证及 REST API 核实。星数仅作筛选快照；选型依据是与现有编辑器的数据、预览、导出是否匹配。

| 候选 | 当日星数 / 近期维护 | 真实能力及许可证 | 本次集成成本与结论 |
| --- | --- | --- | --- |
| [dnd-kit](https://github.com/clauderic/dnd-kit) | 17,734；默认分支最新提交 2026-10-15；未归档 | 拖动、放置、排序和多种输入传感器；[MIT](https://github.com/clauderic/dnd-kit/blob/main/LICENSE)。不是网站生成器。 | 项目已用 core 6.3.1、sortable 10.0.0、utilities 3.2.2，已有可拖动素材、画布和排序。直接增加模板数据和缩略预览，新增依赖为零。采用。 |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | 26,319；默认分支最新提交 2026-10-15；未归档 | HTML 模板可视化编辑框架，含组件/区块体系；核心许可证为 [BSD-3-Clause](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE)。GitHub API 对根目录许可证符号链接返回 NOASSERTION，已另查核心正文。 | 需接入第二套编辑器状态、存储与导出，并迁移现有区块。当前只新增可复用设计模板，功能重叠且成本高，不引入。商业 Studio SDK 不与开源核心混为一谈。 |
| [Motion](https://github.com/motiondivision/motion) | 34,394；默认分支最新提交 2026-10-20；未归档 | React/JavaScript 动画库，可处理手势、弹簧、布局与滚动动画；[MIT](https://github.com/motiondivision/motion/blob/main/LICENSE.md)。 | 增加客户端运行库，且需另行处理独立 HTML 导出的动画一致性。现有 CSS 和 IntersectionObserver 已能处理本次进场、悬停和缩略图演示，不引入。 |

## 采用方式

保留现有 dnd-kit 版本与交互结构，将设计抽成可拖入的模板预设，再复用当前区块模型、编辑属性、实时缩略图和 HTML 渲染器。配色、排版、分栏、留白及装饰图形使用本项目 CSS；进场及悬停复用已有动画机制。无需改换框架或安装依赖。

当前 dnd-kit 仓库主线已改为 `@dnd-kit/react` 等新架构；上表近期提交不代表项目锁定的旧包近期发布。本任务没有迁移必要，不能把新 API 示例直接混入现有 `DndContext` 接口。原依赖版权和许可文件继续由 [dnd-kit/NOTICE.md](dnd-kit/NOTICE.md) 保留。

模板只提取视觉组织方式，展示内容使用新写的通用文案和无身份信息的示意素材。原站姓名、简介、联系方式、社交账号、履历、学校/机构、作品说明和身份图像不进入模板数据、预览或导出。

## 指定参考与视觉拆分

用户指定的[设计参考页](https://hxk-fashion-design-portfolio-sites-project.pages.dev/)已在真实浏览器查看。提取的是黑色与黄绿色的对比、大字开场、圆角悬浮导航、雾光底色、分栏介绍、数字卡片、阶段列表、项目图文、流程与收尾版式。未复制其代码或下载其媒体。保留这些用户指定的视觉特征，因此没有套用 taste-skill 的随机风格或删除参考中的雾光、圆角导航；该 Skill 用于文字层级、间距和实际截图检查。UI/UX Pro Max 的拖动替代操作指南用于保留添加按钮和键盘操作。

素材栏提供独立区块；整套示例为单独草稿。占位图形由本项目 CSS 绘制，不代表任何人的真实作品；数字留空供用户填写。演示数据与导出无原站文字、名称、邮箱、电话、公司、地点、作品照片、标志或外链。来源地址仅保留在此开发记录中。

## 维护证据

- dnd-kit：[2026-10-15 提交](https://github.com/clauderic/dnd-kit/commit/01bc678e93477e56a78aa2244c69b08a96cb0da6)。
- GrapesJS：[2026-10-15 提交](https://github.com/GrapesJS/grapesjs/commit/3b2c671c0ab50f052a219b987dea8738ea75886e)。
- Motion：[2026-10-20 提交](https://github.com/motiondivision/motion/commit/17141d348bbd9524f63ed5a248821d65a5e5e881)。
- 元数据来自 `https://api.github.com/repos/{owner}/{repo}`；默认分支提交来自对应 `/commits?per_page=1`。本记录不声称已测量未引入库的体积或性能。

## 2026-10-22：按用户澄清调整集成方式

用户所说的模板是背景、配色和动效素材，而非整套版式。撤下主素材栏中的模板分类和整套示例链接；保留 v17 的底层解析与渲染以兼容已有草稿。正式操作入口为 `/studio/blocks`。

沿用上述开源选型与已有 dnd-kit，将可视背景/配色卡片本身作为拖动手柄，保留按钮替代操作。新增的雾光流动只改变背景装饰层，使用区块现有颜色，既不插入内容，也不要求特殊 design 版式。无需新依赖。参考网站的正文、身份、媒体和外链均未进入这些风格素材。
