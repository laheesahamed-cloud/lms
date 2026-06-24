import "./index.css";
import { Composition } from "remotion";
import { AppPromo, AUDIO_DURATION_IN_FRAMES } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AppPromo"
        component={AppPromo}
        durationInFrames={AUDIO_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
