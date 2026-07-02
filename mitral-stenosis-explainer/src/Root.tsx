import "./index.css";
import { Composition } from "remotion";
import {
  durationInFrames,
  MitralStenosisExplainer,
} from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MitralStenosisExplainer"
        component={MitralStenosisExplainer}
        durationInFrames={durationInFrames}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
