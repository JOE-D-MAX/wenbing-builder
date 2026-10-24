import type { Metadata } from 'next';
import { ApiStudio } from '@/components/studio/api-studio';
import '../studio.css';

export const metadata: Metadata = {
  title: 'API 制作 · 文炳建站',
  description: '连接你自己的 API，用 UI/UX Pro Max 与 Taste Skill 将想法变成网站。',
};

export default function ApiStudioPage() {
  return <ApiStudio/>;
}
