"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/errors";
import { useMe, useSignOut } from "@/lib/api/queries";

function formatPhone(e164: string) {
  const local = e164.slice(-10);
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function UserMenu() {
  const router = useRouter();
  const me = useMe();
  const signOut = useSignOut();

  if (!me.data) return <Skeleton className="size-9 rounded-full" />;
  const initials = (me.data.user.name ?? me.data.workspace.name).slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-full text-[14px] font-semibold outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="text-[14px] font-semibold">{me.data.workspace.name}</p>
          <p className="text-small text-muted">{formatPhone(me.data.user.phone)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={() =>
            signOut.mutate(undefined, {
              onSuccess: () => router.replace("/login"),
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
