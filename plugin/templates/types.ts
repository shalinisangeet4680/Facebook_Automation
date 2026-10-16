export type BrandColors = {
  bg: string;
  bg2: string;
  bgDeep: string;
  glow: string;
  accent: string;
  onAccent: string;
  text: string;
  muted: string;
  danger: string;
};

export type Brand = {
  name: string;
  wordmark: string[];
  colors: BrandColors;
  store: string | null;
  logo: string | null;
};

export type StorePalette = {
  ink: string;
  bg: string;
  line: string;
  muted: string;
  text: string;
  deep: string;
  mid: string;
};

export type StatusBarSpec = { bg: string; dark: boolean };

export type Callout = {
  tag: string;
  tone: string;
  text: string[];
  x: number;
  y: number;
  w?: number;
  toggles?: [string, boolean][];
};

export type CardProps = {
  headline: string[];
  sub?: string;
  screen: string;
  screenRatio: number;
  statusBar: StatusBarSpec | null;
  callouts: Callout[];
};

export type StoreCardProps = {
  style: string;
  width: number;
  height: number;
  card: CardProps;
  brand?: Partial<Brand>;
  palette?: Partial<StorePalette>;
};

export type FeatureGraphicProps = {
  style: string;
  brand?: Partial<Brand>;
  palette?: Partial<StorePalette>;
  screen: string;
  screenRatio: number;
  statusBar: StatusBarSpec | null;
  tagline: string;
};
