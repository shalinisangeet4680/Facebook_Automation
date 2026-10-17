import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/login-form";
import { LoginShell } from "@/features/auth/login-shell";
import { landingSerif } from "@/features/landing/font";

import "@/features/landing/landing.css";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className={`tv-page ${landingSerif.variable}`}>
      <Suspense>
        <LoginShell>
          <Suspense>
            <LoginForm />
          </Suspense>
        </LoginShell>
      </Suspense>
    </div>
  );
}
