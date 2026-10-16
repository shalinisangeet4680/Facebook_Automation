import { continueRender, delayRender } from "remotion";
import montUrl from "./fonts/Montserrat.woff2";

const loadLocal = (
  family: string,
  url: string,
  style: string,
  weight: string,
) => {
  if (typeof FontFace === "undefined" || typeof document === "undefined")
    return family;
  const handle = delayRender(`font ${family}`);
  const face = new FontFace(family, `url(${url}) format("woff2")`, {
    style,
    weight,
  });
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      continueRender(handle);
    })
    .catch(() => continueRender(handle));
  return family;
};

export const MONT = loadLocal("Montserrat", montUrl, "normal", "100 900");
