import { sanitizeSvg } from "./creative.rules";

describe("sanitizeSvg", () => {
  it("accepts plain SVG", () => {
    expect(
      sanitizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      ),
    ).toBeTruthy();
    expect(
      sanitizeSvg(
        '<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"><use href="#a"/></svg>',
      ),
    ).toBeTruthy();
  });

  it("rejects scripts, event handlers, foreign objects and remote references", () => {
    expect(sanitizeSvg("<svg><script>alert(1)</script></svg>")).toBeNull();
    expect(sanitizeSvg('<svg onload="x()"></svg>')).toBeNull();
    expect(sanitizeSvg("<svg><foreignObject/></svg>")).toBeNull();
    expect(
      sanitizeSvg('<svg><image href="https://evil.example/a.png"/></svg>'),
    ).toBeNull();
    expect(
      sanitizeSvg('<svg><image href="file:///etc/passwd"/></svg>'),
    ).toBeNull();
    expect(sanitizeSvg("<html><svg/></html>")).toBeNull();
  });
});
