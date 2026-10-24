# 拖拽模块制作页：选型与复用记录

核查日期：2026-10-15。目标是在现有文炳建站中增加独立 `/studio/blocks`，把用户个人站的黑色内容区块、交互效果、导航跳转拆为可拖入、排序、修改、预览和导出的模块。星数是本次 GitHub API 查询快照，不能单独代表质量。

| 项目 | 星数 / 许可证 | 本次核实的功能 | 集成判断 |
| --- | --- | --- | --- |
| [Puck](https://github.com/puckeditor/puck)（原 measuredco/puck） | 13,480 / MIT | 将自有 React 组件注册为可视编辑模块，字段面板、分类、嵌套布局、视口预览、数据保存；官方有 Next.js 示例 | `@puckeditor/core` 0.23.0 明确支持 React 18/19。适合完整 React 页面编辑器；当前只需精选模块堆叠，会同时引入富文本、iframe 及较多相关依赖。 |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | 26,310 / 核心 BSD-3-Clause | HTML 组件、区块库、图层、页面、样式面板、存储、HTML/CSS 导出 | `grapesjs` 0.23.8 不限制 React 版本，但其命令式编辑器、组件模型和现有 React 状态需要桥接。更适合自由 HTML/CSS 编辑；核心开源库与商业 Studio SDK 需区分。 |
| [dnd-kit](https://github.com/clauderic/dnd-kit) | 17,713 / MIT | 拖动、放置、排序、输入传感器；作为交互基础接入自有组件库 | 最符合本次增加独立小型制作页的范围；区块数据、效果开关、预览/导出继续由本项目控制。它不自带网站编辑器或网页导出器。 |

## 本次选择

使用成熟的 `@dnd-kit/core` **6.3.1**、`@dnd-kit/sortable` **10.0.0**、`@dnd-kit/utilities` **3.2.2**，不迁移全站框架。npm 包元数据确认 core 的 React / ReactDOM peer 为 `>=16.8.0`；sortable 的 React peer 为 `>=16.8.0`、core peer 为 `^6.3.0`；utilities 的 React peer 为 `>=16.8.0`，均覆盖本项目 React 19.2.6。许可证均为 MIT。

这些旧 API 包最后发布于 2024 年 12 月，需与当前仓库维护活动区分。当前新架构 `@dnd-kit/react` 已到 0.5.1（2026-10-15），不是上述包的直接替换；官方 [#2116](https://github.com/clauderic/dnd-kit/issues/2116) 仍记录新 `DragDropProvider` 的 React 19 StrictMode 问题。本次采用旧 `DndContext` API，并以实际 Vinext 类型检查、构建和浏览器拖放验证作为兼容结论。

编辑器只在独立制作路由加载。需要鼠标、触摸、键盘操作，并提供点击添加、上下移动按钮，避免手机用户必须精细拖动。组件从明确的注册表生成，避免执行用户任意脚本。单文件 hash 页面切换与自包含 HTML 导出由本项目实现；拖拽依赖不进入导出网站。

## 近期维护核查

- Puck：默认分支提交 `dc29b7d9af7f5957f2ec03a8675633f48a60fa29`，2026-10-15，修复富文本对齐配置；最新 npm 核心版 0.23.0，2026-08-07。
- GrapesJS：提交 `3b2c671c0ab50f052a219b987dea8738ea75886e`，2026-10-15，发布核心 0.23.8。
- dnd-kit：提交 `01bc678e93477e56a78aa2244c69b08a96cb0da6`，2026-10-15，合并版本发布；最新新架构 React 包 0.5.1 当日发布。上述仓库均未归档。

以上来自各仓库 GitHub API 的 `repos` 与 `commits?per_page=1`，版本与 peer 来自 npm registry。本记录不把包的解压体积当作最终浏览器下载量。

## 已有本地软件的可复用部分

只读检查了同一工作区 `work/wenbing-node-studio`，没有修改该独立软件。它使用 React 19、React Flow、Dagre 和 JSZip，已有：

- `src/model.ts` / `src/registry.ts`：声明式模块、可编辑字段、默认值。
- `src/engine.ts`：HTML 文本转义、链接协议校验、工作流导入校验、统一预览/导出编译思路。
- `src/exporters.ts`：打包 HTML、工作流 JSON、使用说明。

可复用以上结构和校验思路。现有节点软件是连线决定内容顺序的独立产品，目前不具备个人站效果库或多页面路由；不应把它整体迁入这次模块堆叠编辑器，也不应自动加入其旧价格模块。

## 官方资料与许可证

- [Puck 功能与接入](https://puckeditor.com/docs) · [Puck MIT](https://github.com/puckeditor/puck/blob/main/LICENSE)
- [GrapesJS 开源文档](https://grapesjs.com/docs/) · [核心 BSD-3-Clause](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE)
- [dnd-kit 仓库](https://github.com/clauderic/dnd-kit) · [MIT](https://github.com/clauderic/dnd-kit/blob/main/LICENSE)
- [core 6.3.1 元数据](https://registry.npmjs.org/@dnd-kit/core/6.3.1) · [sortable 10.0.0 元数据](https://registry.npmjs.org/@dnd-kit/sortable/10.0.0) · [utilities 3.2.2 元数据](https://registry.npmjs.org/@dnd-kit/utilities/3.2.2)

集成时应保留锁文件和所用包的 MIT 许可证；本记录仅为选型，实际安装版本以项目锁文件为准。用户个人站的具体外观与效果由主任务通过真实浏览器检查后实现，不凭项目名称推断。


## 2026-10-16 范围修正：复用风格素材

用户明确要求抽取背景、配色和动态效果，不复制个人站的内容组合。本轮重新查看 GitHub dnd-kit 仓库及已有维护、许可、成本记录，继续复用已锁定的拖拽依赖；不再引入完整页面编辑器。新增的是本项目缺少的背景/配色数据、独立应用操作与安全导出，不堆叠新的运行时依赖。个人站只在编辑器右上角以「参考网站」外链出现，不自动导入画布。新项目为空白首页，结构库使用通用占位内容。

## 2026-10-17 v11：先预览，再拖入动效

复核 [dnd-kit](https://github.com/clauderic/dnd-kit)：17,719 星，MIT，未归档，最新提交仍为上文的 `01bc678`（2026-10-15）。继续使用已锁定的 core 6.3.1，不因仓库的新架构版本而迁移，也不增加运行时依赖。

预览图整体作为拖动触发区，卡片右下保留「应用」，已应用卡片提供「移除」。依据官方 [Pointer sensor](https://dndkit.com/legacy/api-documentation/sensors/pointer/) 与 [Keyboard sensor](https://dndkit.com/legacy/api-documentation/sensors/keyboard/) 文档，素材使用基础键盘坐标移动，现有区块排序保留排序坐标；触摸限制仅作用于预览拖动区，避免整张卡片阻断列表滚动。

动态演示使用本项目的 CSS 与现有示意图片，仅可见卡片播放，支持暂停、后台停止及减少动态效果的静态展示。示意照片不导入用户项目；应用动效只改变目标区块的动效，空画布才建立区块。本文记录实现与选型，浏览器交互及移动端表现仍需按本轮实际验证结果确认。
