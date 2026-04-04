import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

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
      <body className={geist.className}>{children}</body>
    </html>
  );
}
