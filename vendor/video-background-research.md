# 视频背景：开源选型与平台能力核查

核查时间：2026-10-22 21:39（Asia/Hong_Kong，UTC+08:00）。先在 GitHub 搜索相关高星项目，再读取官方 REST API、默认分支 README 和许可证正文。星数是当时的快照；搜索引擎抓取日期不作为维护证据。

## 本次需求

在现有“背景”素材分类加入可视化的视频背景，拖到现有区块或点击“应用”，在区块内容后方静音循环播放。保留区块原有文字、图片和跳转；编辑器预览和独立 HTML 导出表现一致。无需视频站点嵌入、流媒体清晰度切换或完整播放器控制栏。

## GitHub 候选核实

| 项目 | 星数与维护证据 | 已核实能力与许可证 | 与本项目的匹配、集成成本 |
| --- | --- | --- | --- |
| [ReactPlayer](https://github.com/cookpete/react-player) | 10,291 星，未归档；`master` 最近提交为 [258fce9](https://github.com/cookpete/react-player/commit/258fce939638a295f6a429ad683935254d1bfda2)，提交者日期为 2025-11-13 19:27:44 UTC。仓库 `pushed_at` 为 2026-10-03，但不能将其当作默认分支新功能提交。 | README 明确支持文件 URL、HLS、DASH、YouTube、Vimeo 等，根据来源加载播放器或 SDK；提供 muted、loop、playsInline、preload、light 等属性。当前 README 介绍 v3 且说明不兼容 v2。[MIT 许可证](https://github.com/cookpete/react-player/blob/master/LICENSE.md)。 | 多来源播放器封装适合媒体内容应用；本次只需浏览器可直接播放的背景视频。引入 React 包后仍须另写无 React 的 HTML 导出播放逻辑、资源和状态管理。增加依赖却不能减少本次关键工作，不引入。 |
| [Video.js](https://github.com/videojs/video.js) | 39,999 星，未归档；`main` 最近提交为 [1042afd](https://github.com/videojs/video.js/commit/1042afd430d4d661606a71abf98a3ca87c2fb6be)，提交者日期为 2026-10-22 01:17:08 UTC。仓库 `pushed_at` 为同日 01:23:56 UTC。 | 直接读取的 `main` README 已是稳定的 v10，描述 Web/React 模块化媒体播放器框架，入口为 `@videojs/core`。[LICENSE 正文](https://github.com/videojs/video.js/blob/main/LICENSE) 明确为 Apache-2.0，并含商标声明；GitHub 元数据返回 NOASSERTION，未以该摘要代替许可证核实。 | 可用于复杂媒体交互，但需要额外播放器生命周期、模块/样式和独立导出资源。背景装饰不使用其控制栏及播放器组合能力，因此不引入。检索缓存仍出现 v8 页面，本次没有混用旧版示例或许可证。 |

元数据来自 `https://api.github.com/repos/{owner}/{repo}`；默认分支提交来自 `/commits?per_page=1`；README 和许可证分别用 `/readme`、`/license` 读取原文。未对未引入的库宣称实测体积或性能。

## 采用方式

复用浏览器原生 `HTMLVideoElement` 完成解码、循环、静音和内联播放，使用小型项目内适配层管理可见性和回退。保留现有 dnd-kit（core 6.3.1、sortable 10.0.0、utilities 3.2.2）负责拖入和排序，并保留“应用”按钮作为非拖动操作。dnd-kit 来源和许可继续保存在 [dnd-kit/NOTICE.md](dnd-kit/NOTICE.md)。

这属于复用成熟的平台能力；没有重新实现视频解码器，也不添加播放器依赖。编辑器和独立 HTML 都可以使用相同的原生标签及交互约定，不要求第三方 CDN 或 React 运行时。没有复制候选库的源代码。

独立 HTML 中，内嵌视频可离线播放，但需遵守项目已有草稿体积上限；外部视频 URL 仍需要网络且受源站可用性约束。不要把浏览器临时 blob URL 保存为可移植草稿数据。用户的原站文字、个人信息和媒体不作为视频背景素材来源。

## 已查阅的平台行为与实施要点

- [MDN video 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video)：`muted`、`loop`、`playsinline` 用于静音、循环和内联播放；`preload` 只是提示。`poster` 在视频未就绪时提供静态画面。装饰层使用 cover 填满，文字和按钮保持在前景。
- [Chrome 自动播放政策](https://developer.chrome.com/blog/autoplay/)与 [WebKit iOS 视频政策](https://webkit.org/blog/6784/new-video-policies-for-ios/)：静音/无音轨是自动播放的重要条件；iPhone 需要内联播放属性。仍须处理 `play()` Promise 失败，不把按钮状态或前景内容依赖于视频成功播放。
- [MDN 自动播放指南](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)：自动播放失败要保留可用的静态界面。原生 `<video>` 不保证任意浏览器设置下都能自动播放；前景功能必须正常。
- [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)：检测用户减少非必要动态的偏好。此项目将背景视频视为装饰，可降为海报/静态配色。
- [MDN NetworkInformation.saveData](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData)：该值表示省流量偏好，但支持有限，必须特性检测。支持且为 true 时不自动下载/播放装饰视频；不能假设所有手机均提供此属性。

实现选择：离屏、页面隐藏或用户暂停时停止播放；减少动态或省流量模式优先显示海报/背景色。避免逐帧 JavaScript 和同时播放列表里所有预览。仅隐藏视频或设置 `preload="metadata"` 不能作为“绝不会下载”的保证；需要真正节省流量时应推迟设置媒体源。海报缺失或视频错误时保留原配色，内容仍可阅读与操作。

这些是本次实现要求与选择依据，具体代码和浏览器验证结果另记于项目验证记录；本文件不代替测试结果。
