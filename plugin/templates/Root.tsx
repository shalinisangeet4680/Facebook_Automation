import React from "react";
import { Still } from "remotion";
import { FeatureGraphic, StoreCard } from "./StoreCard";
import { FeatureGraphicProps, StoreCardProps } from "./types";

const card = {
  headline: ["Your app,", "at a glance"],
  screen: "screens/sample.png",
  screenRatio: 2400 / 1080,
  statusBar: null,
  callouts: [],
};

const storeDefaults: StoreCardProps = {
  style: "callouts",
  width: 1080,
  height: 1920,
  card,
};

const featureDefaults: FeatureGraphicProps = {
  style: "dark",
  screen: card.screen,
  screenRatio: card.screenRatio,
  statusBar: null,
  tagline: "Your tagline",
};

export const Root: React.FC = () => (
  <>
    <Still
      id="StoreCard"
      component={StoreCard}
      width={1080}
      height={1920}
      defaultProps={storeDefaults}
      calculateMetadata={({ props }) => ({
        width: props.width,
        height: props.height,
      })}
    />
    <Still
      id="FeatureGraphic"
      component={FeatureGraphic}
      width={1024}
      height={500}
      defaultProps={featureDefaults}
    />
  </>
);
