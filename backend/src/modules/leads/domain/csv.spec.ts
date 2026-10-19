import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Patna")).toBe("Patna");
    expect(csvCell("Patna, Bihar")).toBe('"Patna, Bihar"');
    expect(csvCell('She said "call me"')).toBe('"She said ""call me"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("neutralises cells that spreadsheets would run as formulas", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    );
    expect(csvCell("+919876543210")).toBe("'+919876543210");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\t=1")).toBe("'\t=1");
    expect(csvCell("a=1")).toBe("a=1");
  });

  it("builds rows with a header and CRLF line endings", () => {
    expect(
      toCsv(
        ["Name", "Phone"],
        [
          ["Priya", "+911234567890"],
          ["Rohan, Jr", null],
        ],
      ),
    ).toBe('Name,Phone\r\nPriya,\'+911234567890\r\n"Rohan, Jr",\r\n');
  });
});
