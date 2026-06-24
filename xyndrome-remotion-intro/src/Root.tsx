import "./index.css";
import { Composition } from "remotion";
import { XyndromeIntro } from "./Composition";
import { QbanksPromo } from "./QbanksPromo";
import { Scene01MedicalStudent } from "./Scene01MedicalStudent";
import { SomeNightsMedicine } from "./SomeNightsMedicine";

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
      <Composition
        id="QbanksPromo"
        component={QbanksPromo}
        durationInFrames={750}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene01MedicalStudent"
        component={Scene01MedicalStudent}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SomeNightsMedicine"
        component={SomeNightsMedicine}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
