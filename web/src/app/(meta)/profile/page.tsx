import type { Metadata } from "next";

import { ProfilePage } from "@/features/profile/profile-page";

export const metadata: Metadata = { title: "Page & Instagram" };

export default function Page() {
  return <ProfilePage />;
}
