import type { Metadata } from 'next';
import { StudioHub } from '@/components/studio/studio-hub';
import './studio.css';
import './hub.css';

export const metadata: Metadata = {
  title: '选择制作方式 · 文炳建站',
  description: '选择模块搭建或 API 制作，进入各自的独立工作区，把你的想法变成网站。',
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ example?: string | string[] }> }) {
  const { example } = await searchParams;
  const selected = typeof example === 'string' && ['restaurant', 'personal', 'business'].includes(example) ? example : '';
  return <StudioHub apiHref={'/studio/api' + (selected ? '?example=' + selected : '')}/>;
}
