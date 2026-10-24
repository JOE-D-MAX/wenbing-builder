import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '发布与付款 · 文炳建站',
  description: '确认网站设计、查看发布费用，以及找回已有订单。',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
