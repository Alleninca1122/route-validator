import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 合成路线验证器',
  description: '用五关评审框架验证 AI 设计的药物合成路线是否可行',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
