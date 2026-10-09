import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OtpInput } from "./otp-input";

function Harness({ onComplete }: { onComplete: (v: string) => void }) {
  const [value, setValue] = useState("");
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

const digit = (n: number) => screen.getByLabelText(`Digit ${n}`) as HTMLInputElement;

describe("OtpInput", () => {
  it("moves focus forward as digits are typed and completes at six", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    "963101".split("").forEach((d, i) => {
      fireEvent.change(digit(i + 1), { target: { value: d } });
    });
    expect(digit(6).value).toBe("1");
    expect(onComplete).toHaveBeenCalledWith("963101");
  });

  it("fills every box from a pasted code", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(digit(1), { clipboardData: { getData: () => "Your code is 963 101" } });
    expect(onComplete).toHaveBeenCalledWith("963101");
    expect(digit(3).value).toBe("3");
  });

  it("ignores letters", () => {
    render(<Harness onComplete={vi.fn()} />);
    fireEvent.change(digit(1), { target: { value: "a" } });
    expect(digit(1).value).toBe("");
  });

  it("clears the previous box on backspace from an empty box", () => {
    render(<Harness onComplete={vi.fn()} />);
    fireEvent.change(digit(1), { target: { value: "9" } });
    fireEvent.keyDown(digit(2), { key: "Backspace" });
    expect(digit(1).value).toBe("");
  });
});
