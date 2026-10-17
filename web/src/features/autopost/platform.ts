import type {
  AutopostCommentClass,
  AutopostContentType,
  AutopostFormat,
  AutopostStatus,
  PostMode,
  SocialPlatform,
} from "@/lib/api/autopost";

export interface PlatformInfo {
  id: SocialPlatform;
  name: string;
  product: string;
  base: string;
  color: string;
  soft: string;
  formats: AutopostFormat[];
  captionMax: number;
}

export const PLATFORMS: Record<SocialPlatform, PlatformInfo> = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    product: "Instagram Autopost",
    base: "/instagram",
    color: "#C2185B",
    soft: "#FBEFF6",
    formats: ["image", "carousel", "reel", "story"],
    captionMax: 2200,
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    product: "Facebook Autopost",
    base: "/facebook",
    color: "#2D5BD7",
    soft: "#EEF2FD",
    formats: ["image", "multi_image", "video", "text", "link"],
    captionMax: 5000,
  },
};

export const FORMAT_LABEL: Record<AutopostFormat, string> = {
  image: "Image",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  multi_image: "Multi-image",
  video: "Video or Reel",
  text: "Text",
  link: "Link",
};

export const FORMAT_HINT: Record<AutopostFormat, string> = {
  image: "One square or portrait image.",
  carousel: "2 to 10 images or videos people swipe through.",
  reel: "One vertical video, 3 seconds to 15 minutes.",
  story: "One image or video up to 60 seconds. Disappears after 24 hours.",
  multi_image: "2 to 10 images in one post.",
  video: "One video, posted as a Reel when it’s vertical.",
  text: "Just text, no image.",
  link: "Text with a link preview.",
};

export const CONTENT_LABEL: Record<AutopostContentType, string> = {
  tip: "Tip",
  offer: "Offer",
  behind_the_scenes: "Behind the scenes",
  testimonial: "Testimonial",
  festival: "Festival or event",
  product: "Product or service",
  announcement: "Announcement",
};

export const CONTENT_TYPES = Object.keys(CONTENT_LABEL) as AutopostContentType[];

export const STATUS_STYLE: Record<AutopostStatus, [string, string, string]> = {
  draft: ["#EFEDE8", "#55534E", "Draft"],
  pending_approval: ["#FBF3E2", "#8A5A00", "Needs approval"],
  scheduled: ["#ECEFF6", "#3B4A6B", "Scheduled"],
  publishing: ["#ECEFF6", "#3B4A6B", "Publishing"],
  published: ["#EAF3EE", "#0F6B4A", "Published"],
  failed: ["#FDF0EE", "#B42318", "Failed"],
  cancelled: ["#EFEDE8", "#76736C", "Cancelled"],
};

export const CLASS_LABEL: Record<AutopostCommentClass, string> = {
  question: "Question",
  praise: "Praise",
  complaint: "Complaint",
  spam: "Spam",
  other: "Other",
};

export const CLASS_STYLE: Record<AutopostCommentClass, [string, string]> = {
  question: ["#ECEFF6", "#3B4A6B"],
  praise: ["#EAF3EE", "#0F6B4A"],
  complaint: ["#FDF0EE", "#B42318"],
  spam: ["#EFEDE8", "#55534E"],
  other: ["#F4F2EE", "#55534E"],
};

export const MODE_TEXT: Record<PostMode, string> = {
  auto: "Auto",
  approval: "Approval",
  manual: "Manual",
};

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

export const fmtNum = (n: number) =>
  n >= 100_000
    ? `${(n / 1000).toFixed(0)}k`
    : n >= 10_000
      ? `${(n / 1000).toFixed(1)}k`
      : n.toLocaleString("en-IN");

export function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
