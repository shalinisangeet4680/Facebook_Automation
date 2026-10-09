import { notFound } from "next/navigation";

import { KitPreview } from "./kit-preview";

export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitPreview />;
}
