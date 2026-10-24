import { BlockStudio } from '@/components/studio/block-studio';
import './blocks.css';
import './effect-previews.css';
import './canvas-effects.css';
import './design-templates.css';
import './design-library.css';
import './video-background.css';
import './video-controls.css';

export const metadata = { title: '模块制作 · 文炳建站', description: '自由组合背景、配色、动态效果和页面跳转，从空白画布开始制作网站。' };

export default function BlocksPage() { return <BlockStudio />; }
