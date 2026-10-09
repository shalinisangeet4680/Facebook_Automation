import { ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { GuideStep } from "@/lib/api/types";

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
    <div className="min-h-[148px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          <p className="text-caption text-accent font-semibold tracking-wide uppercase">
            Step {index + 1} of {total}
          </p>
          <h2 className="text-heading mt-1.5 font-semibold">{step.title}</h2>
          <p className="text-muted mt-1.5">{step.description}</p>
          {step.actionUrl ? (
            <Button asChild variant="secondary" size="sm" className="mt-4">
              <a href={step.actionUrl} target="_blank" rel="noopener noreferrer">
                {step.actionLabel ?? "Open"} <ExternalLink />
              </a>
            </Button>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
