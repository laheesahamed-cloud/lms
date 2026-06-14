import "./index.css";
import { Composition } from "remotion";
import { XyndromeIntro } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="XyndromeIntro"
        component={XyndromeIntro}
        durationInFrames={750}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
