import "./index.css";
import { Composition } from "remotion";
import { ErpmLmsStory, ErpmLmsStoryClean } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ErpmLmsStory"
        component={ErpmLmsStory}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={2160}
      />
      <Composition
        id="ErpmLmsStoryClean"
        component={ErpmLmsStoryClean}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
