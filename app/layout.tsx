import type { Metadata } from "next";
import "./globals.css";
import "./languages.css";
import { StudioLocaleProvider } from '@/components/studio/studio-i18n';

export const metadata: Metadata = {
  title: "文炳建站 · 让你的故事成为网站",
  description: "连接自己的 API，用设计技能辅助生成网站；也可无需 API，填写个人、小店或品牌介绍与图片，免费制作和预览模板网站。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><StudioLocaleProvider>{children}</StudioLocaleProvider></body>
    </html>
  );
}
