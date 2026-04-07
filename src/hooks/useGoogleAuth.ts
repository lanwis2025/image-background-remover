"use client";

import { useEffect, useState, useCallback } from "react";

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  sub: string; // Google user ID
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, config: object) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
          revoke: (email: string, cb: () => void) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

function parseJwt(token: string): GoogleUser | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json) as GoogleUser;
  } catch {
    return null;
  }
}

export function useGoogleAuth() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [ready, setReady] = useState(false);

  // Load persisted user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("google_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("google_user");
      }
    }
  }, []);

  // Load Google Identity Services script and initialize
  useEffect(() => {
    if (!CLIENT_ID) return;

    const scriptId = "google-identity-services";
    if (document.getElementById(scriptId)) {
      setReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response: { credential: string }) => {
          const parsed = parseJwt(response.credential);
          if (parsed) {
            setUser(parsed);
            localStorage.setItem("google_user", JSON.stringify(parsed));
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      setReady(true);
    };
    document.head.appendChild(script);
  }, []);

  const signOut = useCallback(() => {
    if (user) {
      window.google?.accounts.id.revoke(user.email, () => {});
      window.google?.accounts.id.disableAutoSelect();
    }
    localStorage.removeItem("google_user");
    setUser(null);
  }, [user]);

  return { user, ready, signOut };
}
