import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AuthHeader from "@/components/AuthHeader";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BG Remover - AI 一键去除图片背景",
  description:
    "免费在线图片去背景工具，上传图片自动去除背景，下载透明底 PNG。支持 JPG/PNG/WebP，3 秒极速处理。",
  keywords: ["background remover", "去背景", "抠图", "图片处理", "透明背景"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={geist.className}>
        <header className="border-b border-white/10 px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-950">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-lg">
                ✂️
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">BG Remover</h1>
                <p className="text-xs text-white/50">AI 一键去除图片背景</p>
              </div>
            </div>
            <AuthHeader />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
