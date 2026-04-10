"use client";

import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

/**
 * Overlay a repeating diagonal watermark on the image using Canvas.
 * Used for free-plan users to discourage direct screenshot downloads.
 */
async function applyWatermark(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Repeating diagonal watermark
      const fontSize = Math.max(14, Math.floor(img.width * 0.028));
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.textAlign = "center";

      const step = fontSize * 7;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);
      for (let y = -canvas.height * 1.5; y < canvas.height * 1.5; y += step) {
        for (let x = -canvas.width * 1.5; x < canvas.width * 1.5; x += step) {
          ctx.fillText("imagebackgroundremover.solutions", x, y);
        }
      }
      ctx.restore();

      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = objectUrl;
  });
}

export default function Home() {
  const { user, loading, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!user) {
        setErrorMsg("请先登录后再使用去背景功能");
        setStatus("error");
        return;
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setErrorMsg("请上传 JPG/PNG/WebP 格式图片");
        setStatus("error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("图片大小不能超过 10MB");
        setStatus("error");
        return;
      }

      setFileName(file.name);
      setOriginalUrl(URL.createObjectURL(file));
      setResultUrl(null);
      setErrorMsg("");
      setStatus("uploading");

      const formData = new FormData();
      formData.append("image", file);

      try {
        setStatus("processing");
        const res = await fetch("/api/remove-bg", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (res.status === 401) {
          setErrorMsg("请先登录后再使用去背景功能");
          setStatus("error");
          return;
        }

        if (res.status === 402) {
          setErrorMsg("Credits 已用完，请购买更多额度后继续使用");
          setStatus("error");
          await refreshUser();
          return;
        }

        if (!res.ok) {
          let errMsg = "处理失败，请稍后重试";
          try {
            const data = await res.json();
            if (data?.error) errMsg = data.error;
          } catch {
            // ignore parse error
          }
          setErrorMsg(errMsg);
          setStatus("error");
          return;
        }

        // Read plan info from response headers
        const plan = (res.headers.get("X-User-Plan") ?? "free") as "free" | "pro";
        const remaining = parseInt(res.headers.get("X-Credits-Remaining") ?? "-1", 10);
        setUserPlan(plan);
        if (remaining >= 0) setCreditsRemaining(remaining);

        const blob = await res.blob();

        // Apply watermark for free users
        let displayUrl: string;
        if (plan === "free") {
          displayUrl = await applyWatermark(blob);
        } else {
          displayUrl = URL.createObjectURL(blob);
        }

        setResultUrl(displayUrl);
        setStatus("done");

        // Refresh user info to sync credits in header
        await refreshUser();
      } catch {
        setErrorMsg("请求超时，请检查网络后重试");
        setStatus("error");
      }
    },
    [user, refreshUser]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "removed-bg.png";
    a.click();
  };

  const handleReset = () => {
    setStatus("idle");
    setOriginalUrl(null);
    setResultUrl(null);
    setErrorMsg("");
    setFileName("");
    setCreditsRemaining(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            一键去除图片背景
          </h2>
          <p className="text-white/60 text-lg">
            上传图片，3 秒自动抠图，免费下载透明底 PNG
          </p>
        </div>

        {/* Login required banner */}
        {!loading && !isLoggedIn && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-purple-500/10 border border-purple-400/30 text-center text-purple-200 text-sm">
            🔐 请点击右上角 <strong>Google 登录</strong> 后使用去背景功能
          </div>
        )}

        {/* Upload Area */}
        {status === "idle" || status === "error" ? (
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isLoggedIn
                ? `cursor-pointer ${
                    isDragging
                      ? "border-purple-400 bg-purple-500/10"
                      : "border-white/20 hover:border-purple-400 hover:bg-white/5"
                  }`
                : "border-white/10 opacity-50 cursor-not-allowed"
            }`}
            onDrop={isLoggedIn ? handleDrop : undefined}
            onDragOver={isLoggedIn ? handleDragOver : undefined}
            onDragLeave={isLoggedIn ? handleDragLeave : undefined}
            onClick={() => isLoggedIn && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={!isLoggedIn}
            />
            <div className="text-5xl mb-4">🖼️</div>
            <p className="text-xl font-medium mb-2">
              {isLoggedIn ? "拖拽图片到这里，或点击上传" : "请先登录后使用"}
            </p>
            <p className="text-white/40 text-sm">支持 JPG、PNG、WebP，最大 10MB</p>
            {status === "error" && (
              <div className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
                ❌ {errorMsg}
              </div>
            )}
          </div>
        ) : null}

        {/* Processing */}
        {(status === "uploading" || status === "processing") && (
          <div className="border-2 border-purple-400/50 rounded-2xl p-12 text-center bg-purple-500/5">
            <div className="text-5xl mb-4 animate-bounce">⚡</div>
            <p className="text-xl font-medium mb-2">
              {status === "uploading" ? "上传中..." : "AI 处理中..."}
            </p>
            <p className="text-white/40 text-sm">{fileName}</p>
            <div className="mt-6 flex justify-center">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {status === "done" && originalUrl && resultUrl && (
          <div className="space-y-6">
            {/* Plan badge */}
            {userPlan === "free" && (
              <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-200 text-sm text-center">
                💡 免费版结果含水印，
                <span className="font-medium">升级 Pro</span> 可获取无水印高清图
                {creditsRemaining !== null && (
                  <span className="ml-2 text-white/50">· 剩余 {creditsRemaining} 次</span>
                )}
              </div>
            )}
            {userPlan === "pro" && creditsRemaining !== null && (
              <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-400/20 text-purple-200 text-sm text-center">
                ✨ Pro 版 · 剩余 {creditsRemaining} 次
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-white/50 text-center">原图</p>
                <div className="rounded-xl overflow-hidden border border-white/10 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={originalUrl} alt="原图" className="w-full object-contain max-h-72" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-white/50 text-center">去背景结果</p>
                <div
                  className="rounded-xl overflow-hidden border border-purple-400/30 max-h-72 flex items-center justify-center"
                  style={{
                    backgroundImage:
                      "repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 0 0 / 20px 20px",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultUrl} alt="去背景结果" className="w-full object-contain max-h-72" />
                </div>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleDownload}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                ⬇️ 下载 PNG{userPlan === "free" ? "（含水印）" : ""}
              </button>
              <button
                onClick={handleReset}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors"
              >
                🔄 再处理一张
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 px-6 py-6 mt-12">
        <div className="max-w-4xl mx-auto text-center text-white/30 text-sm">
          <p>
            Powered by{" "}
            <a
              href="https://www.remove.bg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300"
            >
              Remove.bg
            </a>{" "}
            · 图片仅在内存中处理，不会被存储
          </p>
        </div>
      </footer>
    </div>
  );
}
