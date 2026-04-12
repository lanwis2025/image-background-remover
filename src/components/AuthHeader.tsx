"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

const BUTTON_CONFIG = {
  type: "standard",
  shape: "pill",
  theme: "outline",
  text: "signin_with",
  size: "medium",
  logo_alignment: "left",
};

export default function AuthHeader() {
  const { user, loading, signIn, signOut } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize Google Identity Services once
  useEffect(() => {
    if (!CLIENT_ID) return;

    const renderButton = () => {
      if (!buttonRef.current || user) return;
      window.google?.accounts.id.renderButton(buttonRef.current, BUTTON_CONFIG);
    };

    const init = () => {
      if (initializedRef.current) {
        // Already initialized — just re-render button if needed
        renderButton();
        return;
      }
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            await signIn(response.credential);
          } catch {
            console.error("Login failed");
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      initializedRef.current = true;
      renderButton();
    };

    const existingScript = document.getElementById("gsi-script");
    if (existingScript) {
      // Script tag exists — may or may not be loaded yet
      if (window.google) {
        init();
      } else {
        // Not loaded yet: wait for it
        existingScript.addEventListener("load", init, { once: true });
      }
      return;
    }

    // Inject script for the first time
    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [signIn, user]);

  if (loading) {
    return <div className="w-28 h-9 rounded-full bg-white/10 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.picture}
          alt={user.name}
          width={32}
          height={32}
          className="rounded-full"
          referrerPolicy="no-referrer"
        />
        <span className="text-sm text-white/80 hidden sm:block">{user.name}</span>
        {/* Credits badge */}
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            user.plan === "pro"
              ? "bg-purple-500/30 text-purple-200 border border-purple-400/40"
              : "bg-white/10 text-white/60"
          }`}
          title={`剩余 ${user.credits} 次`}
        >
          {user.plan === "pro" ? "✨ " : "🪙 "}
          {user.credits}
        </span>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center min-h-[36px]">
      <div ref={buttonRef} />
    </div>
  );
}
