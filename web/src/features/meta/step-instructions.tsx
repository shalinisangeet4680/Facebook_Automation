import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { GuideStep } from "@/lib/api/types";

import { SOFT } from "./ui";

export function StepInstructions({
  step,
  index,
  total,
}: {
  step: GuideStep;
  index: number;
  total: number;
}) {
  return (
    <div style={{ minHeight: 148 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}
        >
          <span className="rp-label" style={{ color: "#0F6B4A", fontWeight: 600 }}>
            Step {index + 1} of {total}
          </span>
          <h2 className="rp-serif" style={{ fontSize: 26, lineHeight: 1.1, margin: 0 }}>
            {step.title}
          </h2>
          <p style={{ color: SOFT, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
            {step.description}
          </p>
          {step.actionUrl ? (
            <a
              href={step.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rp-btn-light"
              style={{ marginTop: 6, padding: "7px 12px" }}
            >
              {step.actionLabel ?? "Open"} <ExternalLink size={13} />
            </a>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
