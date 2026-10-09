"use client";

import { LogOut, Settings, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckRow } from "@/components/ui/check-row";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ProgressRing } from "@/components/ui/progress-ring";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";

export function KitPreview() {
  const [phone, setPhone] = useState("8434230999");
  const [otp, setOtp] = useState("963");
  const [choice, setChoice] = useState("a");
  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-10">
      <h1 className="text-title font-semibold tracking-tight">UI kit</h1>
      <section className="flex flex-wrap items-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Saving</Button>
        <Button size="lg">
          <Sparkles /> Large
        </Button>
        <Button variant="secondary" size="icon" aria-label="Settings">
          <Settings />
        </Button>
        <CopyButton value="ads_management" label="Copy permissions" />
      </section>
      <section className="flex flex-wrap gap-2">
        <Badge>Neutral</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="success">Passed</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Failed</Badge>
        <Badge tone="outline">Soon</Badge>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <Field label="Mobile number" hint="We'll send a 6-digit code.">
          {(p) => <PhoneInput value={phone} onChange={setPhone} {...p} />}
        </Field>
        <Field label="Workspace name" error="This name is already taken.">
          {(p) => <Input defaultValue="Arogya" {...p} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium">Verification code</span>
          <OtpInput value={otp} onChange={setOtp} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-small font-medium">Invalid code</span>
          <OtpInput value="111111" onChange={() => undefined} invalid />
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verification</CardTitle>
            <CardDescription>Checks run against your Meta business.</CardDescription>
          </CardHeader>
          <CardContent className="divide-border divide-y pt-3">
            <CheckRow state="passed" label="Token" message="Token is valid." />
            <CheckRow state="warning" label="Instagram" message="No Instagram account is linked." />
            <CheckRow state="failed" label="Facebook Pages" message="No Page is assigned." />
            <CheckRow state="running" label="Datasets" />
            <CheckRow state="pending" label="Ad accounts" />
          </CardContent>
          <CardFooter>
            <Button variant="secondary" size="sm">
              <LogOut /> Cancel
            </Button>
            <Button size="sm" className="ml-auto">
              Continue
            </Button>
          </CardFooter>
        </Card>
        <div className="grid gap-4">
          <div className="flex items-center gap-6">
            <ProgressRing value={3} total={9} />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <RadioCardGroup value={choice} onValueChange={setChoice}>
            <RadioCard
              value="a"
              title="Arogya System Ads"
              description="act_1201000000000001"
              meta={<Badge>INR</Badge>}
            />
            <RadioCard value="b" title="Arogya Test Ads" description="act_1201000000000002" />
          </RadioCardGroup>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <EmptyState
            title="No campaigns yet"
            description="Your first campaign appears here after launch."
          />
        </Card>
        <ErrorState message="Meta isn't responding right now." onRetry={() => undefined} />
      </section>
    </main>
  );
}
