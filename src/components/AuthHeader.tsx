"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";

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

export default function AuthHeader() {
  const { user, loading, signIn, signOut } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const sdkReady = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const init = () => {
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
      sdkReady.current = true;
      renderButton();
    };

    const renderButton = () => {
      if (!buttonRef.current || user) return;
      window.google?.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        shape: "pill",
        theme: "outline",
        text: "signin_with",
        size: "medium",
        logo_alignment: "left",
      });
    };

    if (document.getElementById("gsi-script")) {
      if (window.google) init();
      return;
    }

    const script = document.createElement("script");
    script.id = "gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [signIn, user]);

  // Re-render button after logout
  useEffect(() => {
    if (!user && sdkReady.current && buttonRef.current && window.google) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        shape: "pill",
        theme: "outline",
        text: "signin_with",
        size: "medium",
        logo_alignment: "left",
      });
    }
  }, [user]);

  if (loading) {
    return <div className="w-28 h-9 rounded-full bg-white/10 animate-pulse" />;
  }

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

  return (
    <div className="flex items-center min-h-[36px]">
      <div ref={buttonRef} />
    </div>
  );
}
