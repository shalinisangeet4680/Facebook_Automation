"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { onSessionExpired } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  const router = useRouter();
  useEffect(
    () =>
      onSessionExpired(() => {
        if (window.location.pathname.startsWith("/login")) return;
        client.clear();
        router.replace("/login?expired=1");
      }),
    [client, router],
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="bottom-right" closeButton theme="system" richColors />
    </QueryClientProvider>
  );
}
