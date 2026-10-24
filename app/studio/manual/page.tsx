import type { Metadata } from 'next';
import ManualStudio from '@/components/studio/manual-studio';

export const metadata:Metadata={title:'模板工作区 · 文炳建站',description:'填写资料，选择版式和配色，免费预览你的网站。'};

export default function ManualStudioPage(){return <ManualStudio/>;}
