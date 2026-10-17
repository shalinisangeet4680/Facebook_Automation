import type { Metadata } from "next";
import { Suspense } from "react";

import { GoogleSignIn } from "@/features/auth/google-sign-in";
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
            <GoogleSignIn />
          </Suspense>
        </LoginShell>
      </Suspense>
    </div>
  );
}
