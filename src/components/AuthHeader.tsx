"use client";

import { useEffect, useRef } from "react";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import Image from "next/image";

export default function AuthHeader() {
  const { user, ready, signOut } = useGoogleAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  // Render the Google Sign-In button once SDK is ready and user is not logged in
  useEffect(() => {
    if (!ready || user || !buttonRef.current) return;
    window.google?.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      shape: "pill",
      theme: "outline",
      text: "signin_with",
      size: "medium",
      logo_alignment: "left",
    });
  }, [ready, user]);

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <Image
          src={user.picture}
          alt={user.name}
          width={32}
          height={32}
          className="rounded-full"
          referrerPolicy="no-referrer"
        />
        <span className="text-sm text-white/80 hidden sm:block">{user.name}</span>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          退出
        </button>
      </div>
    );
  }

  // Placeholder while SDK loads; replaced by Google button once ready
  return (
    <div className="flex items-center min-h-[36px]">
      <div ref={buttonRef} />
      {!ready && (
        <div className="w-28 h-9 rounded-full bg-white/10 animate-pulse" />
      )}
    </div>
  );
}
