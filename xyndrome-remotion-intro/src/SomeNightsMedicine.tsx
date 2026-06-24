import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const openingWords = [
  "Some",
  "nights,",
  "studying",
  "medicine",
  "feels",
  "heavier",
  "than",
  "the",
  "books.",
];

const openingWordStart = 0.25;
const openingWordGap = 0.24;
const phraseSceneStart = 2.9;
const finalSentenceStart = 6.18;
const pdfCardSceneStart = 7.22;
const notesCardSceneStart = 7.86;
const screenshotCardSceneStart = 8.5;
const flashcardsCardSceneStart = 9.14;
const gridFlyOutStart = 9.98;
const paperTextSceneStart = 10.38;
const blackMemorySceneStart = 14.48;
const lightPullStart = 15.78;
const glassRevealStart = 16.05;
const socialOutroStart = 17.82;
const phrases = [
  { text: "We study,", start: phraseSceneStart + 0.12 },
  { text: "We forget,", start: phraseSceneStart + 1.08 },
  { text: "We start again.", start: phraseSceneStart + 2.12 },
];

const phraseDuration = 1.02;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const blackRgb = [16, 35, 63] as const;
const paperWords = [
  { text: "And", color: "#4AA3F4" },
  { text: "also,", color: "#6D35DF" },
  { text: "too", color: "#E95656" },
  { text: "many", color: "#57D88B" },
  { text: "papers", color: "#F59E0B" },
  { text: "to", color: "#4AA3F4" },
  { text: "scribble", color: "#6D35DF" },
  { text: "on", color: "#E95656" },
];
const memoryWords = ["Too", "much", "to", "remember", "alone"];
const xyndromeWords = ["xyndrome", "brings", "you", "everything"];

type FrameProps = {
  frame: number;
  fps: number;
};

const frameAt = (seconds: number, fps: number) => Math.round(seconds * fps);

const progress = (
  frame: number,
  fps: number,
  start: number,
  end: number,
  easing: (input: number) => number = easeOut,
) =>
  interpolate(frame, [start * fps, end * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "");

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ] as const;
};

const mixColor = (from: readonly number[], toHex: string, amount: number) => {
  const to = hexToRgb(toHex);
  const mixed = from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * amount),
  );

  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
};

const getScribblePoint = (amount: number) => {
  const x = 44 + amount * 1132;
  const y =
    108 +
    Math.sin(amount * Math.PI * 9.5) * 18 +
    Math.sin(amount * Math.PI * 25) * 5;

  return { x, y };
};

const scribblePath = Array.from({ length: 74 }, (_, index) => {
  const point = getScribblePoint(index / 73);

  return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
}).join(" ");

export const SomeNightsMedicine = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      className="xy-video"
      style={{
        background: "#F7FCFF",
        color: "#10233F",
      }}
    >
      <MusicTrack />
      <TypingSfx fps={fps} />
      <CyanIndigoBlur frame={frame} fps={fps} />
      <OpeningLine frame={frame} fps={fps} />
      <PhraseBeats frame={frame} fps={fps} />
      <FinalSentence frame={frame} fps={fps} />
      <PdfCardScene frame={frame} fps={fps} />
      <NotesCardScene frame={frame} fps={fps} />
      <ScreenshotCardScene frame={frame} fps={fps} />
      <FlashcardsCardScene frame={frame} fps={fps} />
      <PaperTextScene frame={frame} fps={fps} />
      <MemoryAloneScene frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

const MusicTrack = () => (
  <Audio src={staticFile("audio/source-beat.mp4")} volume={0.58} />
);

const TypingSfx = ({ fps }: { fps: number }) => (
  <>
    {openingWords.map((word, index) => (
      <Sequence
        key={`${word}-opening-type`}
        from={frameAt(openingWordStart + index * openingWordGap, fps)}
        durationInFrames={frameAt(0.18, fps)}
        layout="none"
      >
        <Audio
          src={staticFile("audio/type-key.wav")}
          playbackRate={0.95 + (index % 3) * 0.05}
          volume={() => 0.45}
        />
      </Sequence>
    ))}
    {phrases.map((phrase, index) => (
      <Sequence
        key={`${phrase.text}-type`}
        from={frameAt(phrase.start, fps)}
        durationInFrames={frameAt(0.18, fps)}
        layout="none"
      >
        <Audio
          src={staticFile("audio/type-key.wav")}
          playbackRate={0.95 + (index % 3) * 0.05}
          volume={() => 0.45}
        />
      </Sequence>
    ))}
  </>
);

const CyanIndigoBlur = ({ frame, fps }: FrameProps) => {
  const drift = frame / fps;
  const fadeIn = progress(frame, fps, 0, 1.1, easeInOut);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #F8FDFF 0%, #E9F8FF 38%, #EEF1FF 72%, #FFFFFF 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -180,
          background:
            "radial-gradient(circle at 22% 36%, rgba(68,218,230,0.54), transparent 31%), radial-gradient(circle at 74% 42%, rgba(88,104,238,0.42), transparent 34%), radial-gradient(circle at 50% 86%, rgba(16,199,194,0.24), transparent 38%)",
          filter: "blur(82px)",
          opacity: fadeIn * 0.95,
          transform: `translate3d(${Math.sin(drift * 0.38) * 26}px, ${
            Math.cos(drift * 0.31) * 18
          }px, 0) scale(1.05)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.62))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(15,35,63,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,35,63,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
          opacity: 0.34,
        }}
      />
    </AbsoluteFill>
  );
};

const OpeningLine = ({ frame, fps }: FrameProps) => {
  const lineIn = progress(frame, fps, 0.18, 0.9, easeOut);
  const exit = progress(frame, fps, 2.45, 2.9, easeInOut);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity: lineIn * (1 - exit),
        padding: "0 150px",
        transform: `translateY(${(1 - lineIn) * 22 - exit * 24}px) scale(${
          1 - exit * 0.04
        })`,
      }}
    >
      <h1
        style={{
          fontSize: 86,
          lineHeight: 1.16,
          margin: 0,
          maxWidth: 1320,
          textAlign: "center",
          textShadow: "0 22px 80px rgba(57, 140, 220, 0.18)",
        }}
      >
        {openingWords.map((word, index) => {
          const wordIn = progress(
            frame,
            fps,
            openingWordStart + index * openingWordGap,
            openingWordStart + index * openingWordGap + 0.28,
            easeOut,
          );

          return (
            <span
              key={word}
              style={{
                display: "inline-block",
                filter: `blur(${(1 - wordIn) * 10 + exit * 10}px)`,
                opacity: wordIn,
                transform: `translateY(${(1 - wordIn) * 18}px)`,
              }}
            >
              {word}
              {index < openingWords.length - 1 ? "\u00A0" : ""}
            </span>
          );
        })}
      </h1>
    </AbsoluteFill>
  );
};

const PhraseBeats = ({ frame, fps }: FrameProps) => (
  <AbsoluteFill>
    {phrases.map((phrase) => (
      <CircularPhrase
        key={phrase.text}
        frame={frame}
        fps={fps}
        phrase={phrase.text}
        start={phrase.start}
      />
    ))}
  </AbsoluteFill>
);

const CircularPhrase = ({
  frame,
  fps,
  phrase,
  start,
}: FrameProps & {
  phrase: string;
  start: number;
}) => {
  const enter = progress(frame, fps, start, start + 0.18, easeOut);
  const exit = progress(
    frame,
    fps,
    start + 0.68,
    start + phraseDuration,
    easeInOut,
  );
  const opacity = enter * (1 - exit);
  const scale = 0.78 + enter * 0.24 - exit * 0.44;
  const rotation = -10 + enter * 10 + exit * 220;
  const blur = (1 - enter) * 16 + exit * 28;
  const circleScale = 0.3 + enter * 0.75 - exit * 0.48;
  const circleOpacity = enter * (1 - exit) * 0.22 + exit * 0.18;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: "0 150px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(91, 214, 232, 0.22), rgba(93, 103, 232, 0.1) 44%, transparent 68%)",
          filter: `blur(${10 + exit * 18}px)`,
          opacity: circleOpacity,
          transform: `scale(${circleScale}) rotate(${rotation * 0.5}deg)`,
        }}
      />
      <h1
        style={{
          filter: `blur(${blur}px)`,
          fontSize: 112,
          lineHeight: 1.04,
          margin: 0,
          maxWidth: 1320,
          textAlign: "center",
          textShadow: "0 22px 80px rgba(57, 140, 220, 0.18)",
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          transformOrigin: "50% 50%",
          whiteSpace: "nowrap",
        }}
      >
        {phrase}
      </h1>
    </AbsoluteFill>
  );
};

const FinalSentence = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    finalSentenceStart,
    finalSentenceStart + 0.55,
    easeOut,
  );
  const exit = progress(
    frame,
    fps,
    pdfCardSceneStart - 0.36,
    pdfCardSceneStart - 0.04,
    easeInOut,
  );
  const glow = progress(
    frame,
    fps,
    finalSentenceStart + 0.18,
    finalSentenceStart + 0.88,
    easeInOut,
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity: enter * (1 - exit),
        padding: "0 170px",
        transform: `translateY(${(1 - enter) * 26 - exit * 24}px)`,
      }}
    >
      <h2
        style={{
          filter: `blur(${(1 - enter) * 14}px)`,
          fontSize: 82,
          lineHeight: 1.12,
          margin: 0,
          maxWidth: 1360,
          textAlign: "center",
          textShadow: `0 24px ${70 + glow * 40}px rgba(57, 140, 220, ${
            0.12 + glow * 0.12
          })`,
        }}
      >
        So we look for smarter ways to study.
      </h2>
    </AbsoluteFill>
  );
};

const PdfCardScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    pdfCardSceneStart,
    pdfCardSceneStart + 0.58,
    easeOut,
  );
  const settle = progress(
    frame,
    fps,
    pdfCardSceneStart + 0.42,
    pdfCardSceneStart + 0.72,
    easeInOut,
  );
  const cardExit = progress(
    frame,
    fps,
    gridFlyOutStart,
    gridFlyOutStart + 0.48,
    easeInOut,
  );
  const notesStack = progress(
    frame,
    fps,
    notesCardSceneStart,
    notesCardSceneStart + 0.46,
    easeInOut,
  );
  const screenshotStack = progress(
    frame,
    fps,
    screenshotCardSceneStart,
    screenshotCardSceneStart + 0.46,
    easeInOut,
  );
  const flashcardsStack = progress(
    frame,
    fps,
    flashcardsCardSceneStart,
    flashcardsCardSceneStart + 0.46,
    easeInOut,
  );
  const x = interpolate(enter, [0, 1], [-880, 0]);
  const y =
    -170 * notesStack -
    128 * screenshotStack -
    108 * flashcardsStack -
    860 * cardExit;
  const opacity = enter * (1 - cardExit);
  const blur = (1 - enter) * 18;
  const scale =
    0.9 +
    enter * 0.13 -
    settle * 0.03 -
    notesStack * 0.08 -
    screenshotStack * 0.05 -
    flashcardsStack * 0.04 -
    cardExit * 0.1;
  const rotate =
    -8 +
    enter * 9 -
    settle -
    notesStack * 1.5 -
    screenshotStack -
    flashcardsStack * 0.7 -
    cardExit * 7;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: "0 150px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.72), rgba(221,228,238,0.48))",
          border: "1px solid rgba(85, 101, 124, 0.18)",
          borderRadius: 34,
          boxShadow:
            "0 34px 90px rgba(37, 74, 118, 0.16), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          filter: `blur(${blur}px)`,
          gap: 36,
          height: 280,
          justifyContent: "center",
          overflow: "hidden",
          padding: "38px 56px",
          position: "relative",
          transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: "50% 50%",
          width: 620,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 24% 18%, rgba(255,255,255,0.78), transparent 34%), radial-gradient(circle at 84% 82%, rgba(92,225,230,0.2), transparent 42%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <PdfIcon />
        <div
          style={{
            position: "relative",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#10233F",
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 14,
              textShadow: "0 18px 48px rgba(57, 140, 220, 0.14)",
            }}
          >
            PDF
          </div>
          <div
            style={{
              color: "rgba(16, 35, 63, 0.62)",
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            study document
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NotesCardScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    notesCardSceneStart,
    notesCardSceneStart + 0.58,
    easeOut,
  );
  const settle = progress(
    frame,
    fps,
    notesCardSceneStart + 0.42,
    notesCardSceneStart + 0.72,
    easeInOut,
  );
  const cardExit = progress(
    frame,
    fps,
    gridFlyOutStart,
    gridFlyOutStart + 0.48,
    easeInOut,
  );
  const screenshotStack = progress(
    frame,
    fps,
    screenshotCardSceneStart,
    screenshotCardSceneStart + 0.46,
    easeInOut,
  );
  const flashcardsStack = progress(
    frame,
    fps,
    flashcardsCardSceneStart,
    flashcardsCardSceneStart + 0.46,
    easeInOut,
  );
  const x = interpolate(enter, [0, 1], [-880, 0]);
  const y = -170 * screenshotStack - 128 * flashcardsStack - 860 * cardExit;
  const opacity = enter * (1 - cardExit);
  const blur = (1 - enter) * 18;
  const scale =
    0.9 +
    enter * 0.13 -
    settle * 0.03 -
    screenshotStack * 0.08 -
    flashcardsStack * 0.05 -
    cardExit * 0.1;
  const rotate =
    -8 + enter * 9 - settle - screenshotStack * 1.5 - flashcardsStack - cardExit * 7;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: "0 150px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.72), rgba(221,228,238,0.48))",
          border: "1px solid rgba(85, 101, 124, 0.18)",
          borderRadius: 34,
          boxShadow:
            "0 34px 90px rgba(37, 74, 118, 0.16), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          filter: `blur(${blur}px)`,
          gap: 36,
          height: 280,
          justifyContent: "center",
          overflow: "hidden",
          padding: "38px 56px",
          position: "relative",
          transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: "50% 50%",
          width: 620,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 24% 18%, rgba(255,255,255,0.78), transparent 34%), radial-gradient(circle at 84% 82%, rgba(92,225,230,0.2), transparent 42%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <NotesIcon />
        <div
          style={{
            position: "relative",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#10233F",
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 14,
              textShadow: "0 18px 48px rgba(57, 140, 220, 0.14)",
            }}
          >
            Notes
          </div>
          <div
            style={{
              color: "rgba(16, 35, 63, 0.62)",
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            organized learning
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ScreenshotCardScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    screenshotCardSceneStart,
    screenshotCardSceneStart + 0.58,
    easeOut,
  );
  const cardExit = progress(
    frame,
    fps,
    gridFlyOutStart,
    gridFlyOutStart + 0.48,
    easeInOut,
  );
  const settle = progress(
    frame,
    fps,
    screenshotCardSceneStart + 0.42,
    screenshotCardSceneStart + 0.72,
    easeInOut,
  );
  const flashcardsStack = progress(
    frame,
    fps,
    flashcardsCardSceneStart,
    flashcardsCardSceneStart + 0.46,
    easeInOut,
  );
  const x = interpolate(enter, [0, 1], [-880, 0]);
  const y = -170 * flashcardsStack - 860 * cardExit;
  const opacity = enter * (1 - cardExit);
  const blur = (1 - enter) * 18;
  const scale =
    0.9 + enter * 0.13 - settle * 0.03 - flashcardsStack * 0.08 - cardExit * 0.1;
  const rotate = -8 + enter * 9 - settle - flashcardsStack * 1.5 - cardExit * 7;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: "0 150px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.72), rgba(221,228,238,0.48))",
          border: "1px solid rgba(85, 101, 124, 0.18)",
          borderRadius: 34,
          boxShadow:
            "0 34px 90px rgba(37, 74, 118, 0.16), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          filter: `blur(${blur}px)`,
          gap: 36,
          height: 280,
          justifyContent: "center",
          overflow: "hidden",
          padding: "38px 56px",
          position: "relative",
          transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: "50% 50%",
          width: 620,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 24% 18%, rgba(255,255,255,0.78), transparent 34%), radial-gradient(circle at 84% 82%, rgba(92,225,230,0.2), transparent 42%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <ScreenshotIcon />
        <div
          style={{
            position: "relative",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#10233F",
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 14,
              textShadow: "0 18px 48px rgba(57, 140, 220, 0.14)",
            }}
          >
            Questions
          </div>
          <div
            style={{
              color: "rgba(16, 35, 63, 0.62)",
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            practice prompts
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FlashcardsCardScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    flashcardsCardSceneStart,
    flashcardsCardSceneStart + 0.58,
    easeOut,
  );
  const cardExit = progress(
    frame,
    fps,
    gridFlyOutStart,
    gridFlyOutStart + 0.48,
    easeInOut,
  );
  const settle = progress(
    frame,
    fps,
    flashcardsCardSceneStart + 0.42,
    flashcardsCardSceneStart + 0.72,
    easeInOut,
  );
  const x = interpolate(enter, [0, 1], [-880, 0]);
  const y = -860 * cardExit;
  const opacity = enter * (1 - cardExit);
  const blur = (1 - enter) * 18;
  const scale = 0.9 + enter * 0.13 - settle * 0.03 - cardExit * 0.1;
  const rotate = -8 + enter * 9 - settle - cardExit * 7;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: "0 150px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.72), rgba(221,228,238,0.48))",
          border: "1px solid rgba(85, 101, 124, 0.18)",
          borderRadius: 34,
          boxShadow:
            "0 34px 90px rgba(37, 74, 118, 0.16), inset 0 1px 0 rgba(255,255,255,0.86)",
          display: "flex",
          filter: `blur(${blur}px)`,
          gap: 36,
          height: 280,
          justifyContent: "center",
          overflow: "hidden",
          padding: "38px 56px",
          position: "relative",
          transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`,
          transformOrigin: "50% 50%",
          width: 620,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 24% 18%, rgba(255,255,255,0.78), transparent 34%), radial-gradient(circle at 84% 82%, rgba(92,225,230,0.2), transparent 42%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <FlashcardsIcon />
        <div
          style={{
            position: "relative",
            textAlign: "left",
          }}
        >
          <div
            style={{
              color: "#10233F",
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 14,
              textShadow: "0 18px 48px rgba(57, 140, 220, 0.14)",
            }}
          >
            Flashcards
          </div>
          <div
            style={{
              color: "rgba(16, 35, 63, 0.62)",
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            active recall
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PaperTextScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    paperTextSceneStart,
    paperTextSceneStart + 0.45,
    easeOut,
  );
  const settle = progress(
    frame,
    fps,
    paperTextSceneStart + 0.34,
    paperTextSceneStart + 0.75,
    easeInOut,
  );
  const zoom = progress(
    frame,
    fps,
    paperTextSceneStart + 2.86,
    blackMemorySceneStart + 0.1,
    easeInOut,
  );
  const exitFade = progress(
    frame,
    fps,
    blackMemorySceneStart - 0.08,
    blackMemorySceneStart + 0.14,
    easeInOut,
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity: enter * (1 - exitFade),
        padding: "0 150px",
        transform: `translateY(${(1 - enter) * 28 - settle * 8}px) scale(${1 + zoom * 0.54})`,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          position: "relative",
          width: "100%",
        }}
      >
        <PaperScribble frame={frame} fps={fps} enter={enter} />
        <h2
          style={{
            fontSize: 86,
            lineHeight: 1.12,
            margin: 0,
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            textShadow: "0 20px 64px rgba(57, 140, 220, 0.12)",
          }}
        >
          {paperWords.map((word, index) => {
            const colorStart = paperTextSceneStart + 0.68 + index * 0.29;
            const colorIn = progress(
              frame,
              fps,
              colorStart,
              colorStart + 0.1,
              easeInOut,
            );
            const colorOut = progress(
              frame,
              fps,
              colorStart + 0.18,
              colorStart + 0.28,
              easeInOut,
            );
            const wordColor = colorIn * (1 - colorOut);

            return (
              <span
                key={word.text}
                style={{
                  color: mixColor(blackRgb, word.color, wordColor),
                  display: "inline-block",
                  transform: `translateY(${(1 - enter) * 16}px)`,
                }}
              >
                {word.text}
                {index < paperWords.length - 1 ? "\u00A0" : ""}
              </span>
            );
          })}
        </h2>
      </div>
    </AbsoluteFill>
  );
};

const MemoryAloneScene = ({ frame, fps }: FrameProps) => {
  const sceneIn = progress(
    frame,
    fps,
    blackMemorySceneStart,
    blackMemorySceneStart + 0.24,
    easeInOut,
  );
  const textIn = progress(
    frame,
    fps,
    blackMemorySceneStart + 0.12,
    blackMemorySceneStart + 0.62,
    easeOut,
  );
  const glow = progress(
    frame,
    fps,
    blackMemorySceneStart + 0.18,
    blackMemorySceneStart + 0.72,
    easeOut,
  );
  const pull = progress(
    frame,
    fps,
    lightPullStart,
    lightPullStart + 0.82,
    easeInOut,
  );
  const textExit = progress(
    frame,
    fps,
    lightPullStart,
    lightPullStart + 0.68,
    easeInOut,
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background:
          "radial-gradient(circle at 50% 62%, rgba(74, 163, 244, 0.16), transparent 34%), #030509",
        color: "#F8FBFF",
        display: "flex",
        justifyContent: "center",
        opacity: sceneIn,
      }}
    >
      <PulledLightPanel pull={pull} />
      <div
        style={{
          display: "flex",
          gap: 26,
          justifyContent: "center",
          maxWidth: 1380,
          padding: "0 130px",
          position: "relative",
          textAlign: "center",
          transform: `translate(${textExit * -1980}px, ${(1 - textIn) * 74}px) scale(${
            0.96 + textIn * 0.04
          })`,
          whiteSpace: "nowrap",
          zIndex: 2,
        }}
      >
        <span
          style={{
            display: "inline-block",
            filter: `blur(${(1 - textIn) * 12}px)`,
            fontSize: 92,
            fontWeight: 760,
            letterSpacing: 0,
            lineHeight: 1.12,
            opacity: textIn,
            textShadow: `
              0 22px 34px rgba(74, 163, 244, ${0.18 + glow * 0.2}),
              0 0 ${22 + glow * 32}px rgba(109, 53, 223, ${0.18 + glow * 0.18})
            `,
          }}
        >
          {memoryWords.join(" ")}
        </span>
      </div>
      <GlassRevealScene frame={frame} fps={fps} />
      <SocialOutroScene frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

const SocialOutroScene = ({ frame, fps }: FrameProps) => {
  const instagramIn = progress(
    frame,
    fps,
    socialOutroStart + 0.96,
    socialOutroStart + 1.2,
    easeOut,
  );
  const followIn = progress(
    frame,
    fps,
    socialOutroStart + 1.18,
    socialOutroStart + 1.42,
    easeOut,
  );
  const handleIn = progress(
    frame,
    fps,
    socialOutroStart + 1.42,
    socialOutroStart + 1.66,
    easeOut,
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          opacity: instagramIn,
          transform: `translateY(${(1 - instagramIn) * 34}px) scale(${
            0.86 + instagramIn * 0.14
          })`,
        }}
      >
        <InstagramIcon />
        <div
          style={{
            color: "#10233F",
            fontSize: 56,
            fontWeight: 760,
            letterSpacing: 0,
            lineHeight: 1,
            opacity: followIn,
            textShadow: "0 18px 42px rgba(57, 140, 220, 0.14)",
            transform: `translateY(${(1 - followIn) * 24}px)`,
          }}
        >
          follow for more
        </div>
        <div
          style={{
            color: "#4A35D8",
            fontSize: 44,
            fontWeight: 740,
            letterSpacing: 0,
            lineHeight: 1,
            opacity: handleIn,
            textShadow: "0 16px 36px rgba(74, 53, 216, 0.16)",
            transform: `translateY(${(1 - handleIn) * 22}px)`,
          }}
        >
          @xyndrome.med
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InstagramIcon = () => (
  <svg
    width="86"
    height="86"
    viewBox="0 0 86 86"
    style={{
      filter: "drop-shadow(0 18px 32px rgba(206, 63, 128, 0.28))",
      flexShrink: 0,
    }}
  >
    <defs>
      <linearGradient id="instagramGradient" x1="14" x2="74" y1="76" y2="10">
        <stop stopColor="#FEDA75" />
        <stop offset="0.28" stopColor="#FA7E1E" />
        <stop offset="0.52" stopColor="#D62976" />
        <stop offset="0.76" stopColor="#962FBF" />
        <stop offset="1" stopColor="#4F5BD5" />
      </linearGradient>
    </defs>
    <rect
      x="6"
      y="6"
      width="74"
      height="74"
      rx="23"
      fill="url(#instagramGradient)"
    />
    <rect
      x="22"
      y="22"
      width="42"
      height="42"
      rx="13"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="6"
    />
    <circle
      cx="43"
      cy="43"
      r="11"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="6"
    />
    <circle cx="58" cy="28" r="4.6" fill="#FFFFFF" />
  </svg>
);

const GlassRevealScene = ({ frame, fps }: FrameProps) => {
  const enter = progress(
    frame,
    fps,
    glassRevealStart,
    glassRevealStart + 0.22,
    easeOut,
  );
  const expand = progress(
    frame,
    fps,
    glassRevealStart + 0.08,
    glassRevealStart + 0.46,
    easeInOut,
  );
  const textIn = progress(
    frame,
    fps,
    glassRevealStart + 0.28,
    glassRevealStart + 0.56,
    easeOut,
  );
  const capsuleExit = progress(
    frame,
    fps,
    socialOutroStart - 0.42,
    socialOutroStart - 0.12,
    easeInOut,
  );
  const logoIn = progress(
    frame,
    fps,
    socialOutroStart - 0.18,
    socialOutroStart + 0.16,
    easeOut,
  );
  const logoOut = progress(
    frame,
    fps,
    socialOutroStart + 0.72,
    socialOutroStart + 0.92,
    easeInOut,
  );
  const logoOpacity = logoIn * (1 - logoOut);
  const width = interpolate(expand, [0, 1], [62, 1280]);
  const height = interpolate(expand, [0, 1], [72, 154]);
  const radius = 999;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        opacity: enter,
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.28) 48%, rgba(226,244,255,0.46))",
          border: "1px solid rgba(255,255,255,0.82)",
          borderRadius: radius,
          boxShadow:
            "0 32px 90px rgba(37, 74, 118, 0.18), inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -20px 60px rgba(109,53,223,0.08)",
          display: "flex",
          height,
          justifyContent: "center",
          opacity: 1 - capsuleExit,
          overflow: "hidden",
          padding: "0 96px",
          position: "relative",
          transform: `translateY(${(1 - enter) * 42 - capsuleExit * 30}px) scale(${
            0.9 + enter * 0.1 - capsuleExit * 0.08
          })`,
          width,
        }}
      >
        <div
          style={{
            background:
              "radial-gradient(circle at 32% 22%, rgba(255,255,255,0.96), transparent 18%), radial-gradient(circle at 72% 72%, rgba(74,163,244,0.24), transparent 32%)",
            filter: "blur(1px)",
            inset: 0,
            opacity: 0.9,
            position: "absolute",
          }}
        />
        <div
          style={{
            background:
              "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.58) 42%, transparent 58%)",
            height: "140%",
            left: `${-35 + expand * 82}%`,
            position: "absolute",
            top: "-20%",
            transform: "rotate(8deg)",
            width: 180,
          }}
        />
        <div
          style={{
            color: "#10233F",
            display: "flex",
            gap: 24,
            justifyContent: "center",
            opacity: textIn * (1 - capsuleExit),
            position: "relative",
            textAlign: "center",
            transform: `translateY(${(1 - textIn) * 34}px)`,
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {xyndromeWords.map((word, index) => {
            return (
              <span
                key={word}
                style={{
                  color: index === 0 ? "#4A35D8" : "#10233F",
                  display: "inline-block",
                  fontSize: index === 0 ? 70 : 64,
                  fontWeight: index === 0 ? 820 : 720,
                  letterSpacing: 0,
                  lineHeight: 1,
                  opacity: 1,
                  textShadow:
                    index === 0
                      ? "0 16px 42px rgba(74,53,216,0.18)"
                      : "0 16px 42px rgba(57,140,220,0.12)",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
      <Img
        src={staticFile("logo-mark-light.webp")}
        style={{
          filter: "drop-shadow(0 26px 54px rgba(37, 74, 118, 0.2))",
          height: 300,
          objectFit: "contain",
          opacity: logoOpacity,
          position: "absolute",
          transform: `translateY(${(1 - logoIn) * 34 - logoOut * 22}px) scale(${
            0.88 + logoIn * 0.12 - logoOut * 0.08
          })`,
          width: 340,
          zIndex: 2,
        }}
      />
    </AbsoluteFill>
  );
};

const PulledLightPanel = ({ pull }: { pull: number }) => (
  <AbsoluteFill
    style={{
      overflow: "hidden",
      pointerEvents: "none",
      transform: `translateX(${(1 - pull) * 100}%)`,
      zIndex: 1,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(135deg, #F8FDFF 0%, #E9F8FF 38%, #EEF1FF 72%, #FFFFFF 100%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: -180,
        background:
          "radial-gradient(circle at 22% 36%, rgba(68,218,230,0.52), transparent 31%), radial-gradient(circle at 74% 42%, rgba(88,104,238,0.42), transparent 34%), radial-gradient(circle at 50% 86%, rgba(16,199,194,0.22), transparent 38%)",
        filter: "blur(82px)",
        opacity: 0.94,
        transform: `translateX(${(1 - pull) * 80}px) scale(1.05)`,
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(15,35,63,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,35,63,0.05) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        maskImage:
          "linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)",
        opacity: 0.3,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        top: 0,
        width: 8,
        background: "rgba(255,255,255,0.92)",
        boxShadow:
          "-14px 0 0 rgba(3,5,9,0.95), 12px 0 30px rgba(74,163,244,0.28)",
      }}
    />
  </AbsoluteFill>
);

const PaperScribble = ({
  frame,
  fps,
  enter,
}: FrameProps & { enter: number }) => {
  const write = progress(
    frame,
    fps,
    paperTextSceneStart + 0.58,
    paperTextSceneStart + 2.78,
    easeInOut,
  );
  const leave = progress(
    frame,
    fps,
    paperTextSceneStart + 2.74,
    paperTextSceneStart + 3.02,
    easeInOut,
  );
  const pen = getScribblePoint(write);
  const nextPen = getScribblePoint(Math.min(1, write + 0.01));
  const penAngle =
    (Math.atan2(nextPen.y - pen.y, nextPen.x - pen.x) * 180) / Math.PI - 12;

  return (
    <div
      style={{
        height: 170,
        left: "50%",
        opacity: enter * (1 - leave),
        pointerEvents: "none",
        position: "absolute",
        top: -136,
        transform: "translateX(-50%)",
        width: 1220,
        zIndex: 2,
      }}
    >
      <svg
        width="1220"
        height="170"
        viewBox="0 0 1220 170"
        style={{
          overflow: "visible",
        }}
      >
        <path
          d={scribblePath}
          fill="none"
          pathLength="1"
          stroke="rgba(109, 53, 223, 0.72)"
          strokeDasharray="1"
          strokeDashoffset={1 - write}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d={scribblePath}
          fill="none"
          pathLength="1"
          stroke="rgba(74, 163, 244, 0.44)"
          strokeDasharray="1"
          strokeDashoffset={1 - Math.max(0, write - 0.035)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          transform="translate(0 19)"
        />
      </svg>
      <Img
        src={staticFile("images/illustrated-marker.png")}
        style={{
          filter: "drop-shadow(0 18px 24px rgba(16, 35, 63, 0.22))",
          height: 152,
          left: 0,
          objectFit: "contain",
          position: "absolute",
          top: 0,
          transform: `translate(${pen.x - 17}px, ${pen.y - 128}px) rotate(${penAngle + 45}deg)`,
          transformOrigin: "11% 84%",
          width: 152,
        }}
      />
    </div>
  );
};

const PdfIcon = () => <DocumentIcon label="PDF" accent="#E95656" />;

const NotesIcon = () => <DocumentIcon label="NOTE" accent="#4AA3F4" />;

const ScreenshotIcon = () => <DocumentIcon label="Q" accent="#6D35DF" />;

const FlashcardsIcon = () => <DocumentIcon label="FC" accent="#57D88B" />;

const DocumentIcon = ({ label, accent }: { label: string; accent: string }) => (
  <svg
    width="132"
    height="162"
    viewBox="0 0 154 188"
    style={{
      filter: "drop-shadow(0 18px 34px rgba(37, 74, 118, 0.18))",
      position: "relative",
    }}
  >
    <path
      d="M24 6H96L140 50V164C140 174 132 182 122 182H24C14 182 6 174 6 164V24C6 14 14 6 24 6Z"
      fill="rgba(255,255,255,0.92)"
      stroke="rgba(85,101,124,0.24)"
      strokeWidth="3"
    />
    <path
      d="M96 8V42C96 49.7 102.3 56 110 56H139"
      fill="rgba(229,236,248,0.88)"
      stroke="rgba(85,101,124,0.18)"
      strokeWidth="3"
    />
    <rect x="28" y="78" width="98" height="42" rx="8" fill={accent} />
    <text
      fill="#FFFFFF"
      fontFamily="Plus Jakarta Xyndrome, Inter, Arial, sans-serif"
      fontSize={label.length > 3 ? "20" : "26"}
      fontWeight="700"
      letterSpacing="0"
      textAnchor="middle"
      x="77"
      y="108"
    >
      {label}
    </text>
    <rect
      x="28"
      y="134"
      width="80"
      height="8"
      rx="4"
      fill="rgba(16,35,63,0.14)"
    />
    <rect
      x="28"
      y="150"
      width="62"
      height="8"
      rx="4"
      fill="rgba(16,35,63,0.1)"
    />
  </svg>
);
