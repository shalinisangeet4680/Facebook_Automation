import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandPanel } from "@/features/auth/brand-panel";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-caption text-subtle px-6 pb-8 text-center">
          By continuing you agree to the Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
