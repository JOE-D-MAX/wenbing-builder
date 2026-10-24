# 制作方式选择页选型（2026-10-20）

需求：把开始制作后的页面拆成独立选择页，分别进入模块搭建和 API 制作。

## GitHub 核验

- [shadcn-ui/ui](https://github.com/shadcn-ui/ui)：官方组织页查询约 12.6 万 stars，最近更新显示 2026-10-19；[发行页](https://github.com/shadcn-ui/ui/releases)显示 `shadcn@4.21.4`。项目提供可定制的 React 组件；[Card 文档](https://ui.shadcn.com/docs/components/base/card)支持标题、内容和底部区域，适合承载两种制作方式。许可证为 [MIT](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)。
- 本项目已包含 `components/ui/card.tsx`。复用该组件，只调整当前页样式并在外层使用原生链接，保留键盘操作、浏览器返回与独立网址；无需安装 CLI 或升级现有依赖。
- 继续复用已有 `LiftoffEffects` 星点组件、字体、品牌标记和 Lucide 图标。相比引入新导航框架，集成范围只涉及一个选择页、新 API 页面路径和相关入口链接。

## 设计取舍

UI/UX Pro Max 的通用建议包含可见键盘焦点、触摸目标、响应式布局和减少动态效果支持。由于用户只要求拆分工作区入口，保留现有中性色与统一字体，不采用通用建议中的紫粉配色或新增营销段落。

## 来源与许可

此次未复制新的第三方组件源码。已使用的 shadcn Card 保留其现有实现；许可全文补充保存在 `vendor/shadcn-ui/LICENSE.txt`，来源说明见该目录 `NOTICE.md`。星数是查询时的筛选信息，不作为新增依赖的理由。
