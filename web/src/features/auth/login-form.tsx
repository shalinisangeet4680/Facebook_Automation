"use client";

import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useRequestOtp, useVerifyOtp } from "@/lib/api/queries";

import { useCountdown } from "./use-countdown";

type Step = "phone" | "code";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/setup";
}

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const resendIn = useCountdown(resendAt);
  const expired = params.has("expired");

  function sendCode() {
    setError(null);
    requestOtp.mutate(phone, {
      onSuccess: (res) => {
        setDisplayPhone(res.phone);
        setResendAt(Date.now() + res.resendInSeconds * 1000);
        setCode("");
        setCodeInvalid(false);
        setStep("code");
      },
      onError: (err) => setError(errorMessage(err)),
    });
  }

  function verify(value: string) {
    setError(null);
    verifyOtp.mutate(
      { phone, code: value },
      {
        onSuccess: () => router.replace(safeNext(params.get("next"))),
        onError: (err) => {
          setError(errorMessage(err));
          setCodeInvalid(true);
          if (err instanceof ApiError && err.code === "OTP_INVALID") setCode("");
        },
      },
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <LogoMark className="mb-8 size-10 lg:hidden" />
      {expired && step === "phone" ? (
        <div
          role="status"
          className="border-border bg-surface-muted text-small text-muted mb-6 flex items-start gap-2.5 rounded-[var(--radius-control)] border px-3.5 py-3"
        >
          <Info className="text-accent mt-0.5 size-4 shrink-0" />
          Your session ended. Sign in again to continue.
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {step === "phone" ? (
          <motion.form
            key="phone"
            {...slide}
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
            className="flex flex-col gap-6"
          >
            <div>
              <h2 className="text-title font-semibold tracking-tight">Sign in</h2>
              <p className="text-muted mt-2">
                Enter your mobile number. We&apos;ll send you a 6-digit code.
              </p>
            </div>
            <Field label="Mobile number" error={error}>
              {(p) => <PhoneInput value={phone} onChange={setPhone} autoFocus {...p} />}
            </Field>
            <Button
              type="submit"
              size="lg"
              loading={requestOtp.isPending}
              disabled={phone.length !== 10}
            >
              Continue <ArrowRight />
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            {...slide}
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) verify(code);
            }}
            className="flex flex-col gap-6"
          >
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
                className="text-small text-muted hover:text-foreground mb-6 inline-flex items-center gap-1.5 font-medium transition-colors"
              >
                <ArrowLeft className="size-4" /> Change number
              </button>
              <h2 className="text-title font-semibold tracking-tight">Enter the code</h2>
              <p className="text-muted mt-2">
                Sent to <span className="text-foreground font-medium">{displayPhone}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setCodeInvalid(false);
                }}
                onComplete={verify}
                disabled={verifyOtp.isPending}
                invalid={codeInvalid}
                autoFocus
                aria-describedby="otp-error"
              />
              <p id="otp-error" role="alert" className="text-small text-danger min-h-5">
                {error}
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              loading={verifyOtp.isPending}
              disabled={code.length !== 6}
            >
              Verify and continue
            </Button>
            <p className="text-small text-muted text-center">
              Didn&apos;t get it?{" "}
              {resendIn > 0 ? (
                <span className="tabular-nums">Resend in {resendIn}s</span>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={requestOtp.isPending}
                  className="text-accent font-medium hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
