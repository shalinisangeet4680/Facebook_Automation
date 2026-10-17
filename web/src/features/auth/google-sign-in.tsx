"use client";

import { AlertCircle, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleSignIn() {
  const params = useSearchParams();
  const [leaving, setLeaving] = useState(false);
  const error = params.get("error");
  const expired = params.has("expired");

  function go() {
    setLeaving(true);
    const url = new URL("/api/v1/auth/google/start", window.location.origin);
    url.searchParams.set("next", safeNext(params.get("next")));
    url.searchParams.set("origin", window.location.origin);
    const hint = params.get("hint");
    if (hint) url.searchParams.set("hint", hint);
    window.location.assign(url.toString());
  }

  return (
    <div className="tv-gsign">
      {error ? (
        <p role="alert" className="tv-gsignNote tv-gsignError">
          <AlertCircle size={16} /> {error}
        </p>
      ) : expired ? (
        <p role="status" className="tv-gsignNote">
          <Info size={16} /> Your session ended. Sign in again to continue.
        </p>
      ) : null}
      <h2>Sign in</h2>
      <p className="tv-gsignSub">
        Use your Google account. New here? This creates your free account.
      </p>
      <button type="button" className="tv-gbtn" onClick={go} disabled={leaving}>
        {leaving ? <span className="tv-gspin" aria-hidden /> : <GoogleMark />}
        {leaving ? "Opening Google…" : "Continue with Google"}
      </button>
      <p className="tv-gsignFine">
        We only see your name, email and photo. Nothing is posted until you connect a product.
      </p>
    </div>
  );
}
