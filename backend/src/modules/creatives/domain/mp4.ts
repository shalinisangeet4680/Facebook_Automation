export interface VideoInfo {
  width: number;
  height: number;
  durationSeconds: number;
}

function boxes(
  buf: Buffer,
  start: number,
  end: number,
): { type: string; start: number; end: number }[] {
  const out: { type: string; start: number; end: number }[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) break;
    out.push({ type, start: offset + header, end: offset + size });
    offset += size;
  }
  return out;
}

export function readMp4(buf: Buffer): VideoInfo | null {
  const top = boxes(buf, 0, buf.length);
  if (!top.some((b) => b.type === "ftyp")) return null;
  const moov = top.find((b) => b.type === "moov");
  if (!moov) return null;
  const inner = boxes(buf, moov.start, moov.end);
  const mvhd = inner.find((b) => b.type === "mvhd");
  if (!mvhd) return null;
  const version = buf.readUInt8(mvhd.start);
  const timescale =
    version === 1
      ? buf.readUInt32BE(mvhd.start + 20)
      : buf.readUInt32BE(mvhd.start + 12);
  const duration =
    version === 1
      ? Number(buf.readBigUInt64BE(mvhd.start + 24))
      : buf.readUInt32BE(mvhd.start + 16);
  let width = 0;
  let height = 0;
  for (const trak of inner.filter((b) => b.type === "trak")) {
    const parts = boxes(buf, trak.start, trak.end);
    const mdia = parts.find((b) => b.type === "mdia");
    const hdlr = mdia
      ? boxes(buf, mdia.start, mdia.end).find((b) => b.type === "hdlr")
      : undefined;
    if (
      !hdlr ||
      buf.toString("latin1", hdlr.start + 8, hdlr.start + 12) !== "vide"
    )
      continue;
    const tkhd = parts.find((b) => b.type === "tkhd");
    if (!tkhd) continue;
    const tkVersion = buf.readUInt8(tkhd.start);
    const base = tkhd.start + (tkVersion === 1 ? 88 : 76);
    width = Math.round(buf.readUInt32BE(base) / 65536);
    height = Math.round(buf.readUInt32BE(base + 4) / 65536);
    break;
  }
  if (!timescale || !width || !height) return null;
  return {
    width,
    height,
    durationSeconds: Math.round((duration / timescale) * 10) / 10,
  };
}
