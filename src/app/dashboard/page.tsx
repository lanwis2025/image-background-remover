"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

const PRICING_URL = "/#pricing"; // 指向首页 Pricing 区块

function PlanBadge({ plan }: { plan: "free" | "pro" }) {
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
        PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      FREE
    </span>
  );
}

function CreditsBar({ credits, plan }: { credits: number; plan: "free" | "pro" }) {
  if (plan === "pro") {
    return (
      <div className="mt-1 text-sm text-gray-500">
        <span className="font-medium text-gray-800">{credits}</span> credits remaining this month
      </div>
    );
  }

  // free 用户：满额3次
  const total = 3;
  const used = Math.max(0, total - credits);
  const pct = Math.round((used / total) * 100);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{used} of {total} free credits used</span>
        <span>{credits} remaining</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const joinDate = new Date(user.created_at * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            ← Back to Home
          </a>
          <span className="text-sm font-semibold text-gray-900">My Account</span>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <Image
              src={user.picture}
              alt={user.name}
              width={64}
              height={64}
              className="rounded-full ring-2 ring-gray-100"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{user.name}</h1>
                <PlanBadge plan={user.plan} />
              </div>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Member since {joinDate}</p>
            </div>
          </div>
        </div>

        {/* Credits Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Credits</h2>
              <CreditsBar credits={user.credits} plan={user.plan} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{user.total_used}</div>
              <div className="text-xs text-gray-400">total processed</div>
            </div>
          </div>

          {/* CTA：free 用户引导升级 */}
          {user.plan === "free" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {user.credits === 0 ? (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-gray-600">
                    You&apos;ve used all your free credits.
                  </p>
                  <a
                    href={PRICING_URL}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-opacity"
                  >
                    Get More Credits →
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-gray-500">
                    Want unlimited removals without watermarks?
                  </p>
                  <a
                    href={PRICING_URL}
                    className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 transition-colors"
                  >
                    Upgrade to Pro
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Pro 用户：显示订阅状态 */}
          {user.plan === "pro" && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Active Pro subscription</p>
              <a
                href="https://app.lemonsqueezy.com/my-orders"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-600 hover:underline"
              >
                Manage billing →
              </a>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
            >
              <span className="text-2xl">🖼️</span>
              <div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-violet-700">Remove Background</div>
                <div className="text-xs text-gray-400">Process a new image</div>
              </div>
            </a>
            <a
              href={PRICING_URL}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
            >
              <span className="text-2xl">💳</span>
              <div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-violet-700">Buy Credits</div>
                <div className="text-xs text-gray-400">Top up or upgrade plan</div>
              </div>
            </a>
          </div>
        </div>

      </main>
    </div>
  );
}
