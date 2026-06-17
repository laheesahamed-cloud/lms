import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const brand = {
  ink: "#111827",
  muted: "#9CA3AF",
  blue: "#4AA3F4",
  indigo: "#5274F3",
  violet: "#6D35DF",
  pink: "#F43F9D",
  orange: "#FFB454",
  green: "#57D88B",
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const softPop = Easing.bezier(0.34, 1.56, 0.64, 1);

const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

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

const frameAt = (seconds: number, fps: number) => Math.round(seconds * fps);

const hookWords = [
  { text: "Are", start: 0.38, color: brand.ink },
  { text: "you", start: 0.72, color: brand.muted },
  { text: "a", start: 1.05, color: brand.muted },
  { text: "medical", start: 1.38, color: brand.violet },
  { text: "student?", start: 1.76, color: brand.ink },
];

const problemWords = [
  { text: "Tired", start: 3.0, color: brand.ink },
  { text: "of", start: 3.32, color: brand.muted },
  { text: "PDFs,", start: 3.68, color: brand.violet },
  { text: "printed notes,", start: 4.14, color: brand.ink },
  { text: "screenshots?", start: 4.7, color: brand.blue },
];

const problemTokens = [
  { label: "PDFs", angle: -28, radius: 380, color: brand.violet, start: 5.86 },
  {
    label: "Printed notes",
    angle: 35,
    radius: 455,
    color: brand.orange,
    start: 6.12,
  },
  {
    label: "Screenshots",
    angle: 118,
    radius: 420,
    color: brand.pink,
    start: 6.38,
  },
  {
    label: "Old MCQs",
    angle: 196,
    radius: 445,
    color: brand.blue,
    start: 6.64,
  },
  {
    label: "Random plans",
    angle: 278,
    radius: 390,
    color: brand.green,
    start: 6.88,
  },
];

const featureTokens = [
  { label: "MCQs", angle: -40, radius: 390, color: brand.blue, start: 12.12 },
  { label: "Notes", angle: 28, radius: 455, color: brand.violet, start: 12.42 },
  {
    label: "Flashcards",
    angle: 106,
    radius: 420,
    color: brand.pink,
    start: 12.75,
  },
  {
    label: "Mock exams",
    angle: 188,
    radius: 445,
    color: brand.orange,
    start: 13.1,
  },
  {
    label: "Analytics",
    angle: 265,
    radius: 395,
    color: brand.green,
    start: 13.45,
  },
];

export const Scene01MedicalStudent = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      className="xy-video"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, #FFFFFF 0%, #FCFCFA 48%, #F8FBFF 100%)",
        color: brand.ink,
      }}
    >
      <SceneAudio fps={fps} />
      <WhiteKineticBackground frame={frame} fps={fps} />
      <HookBeat frame={frame} fps={fps} />
      <ProblemTextBeat frame={frame} fps={fps} />
      <OrbitTokenBeat frame={frame} fps={fps} />
      <ResolveBeat frame={frame} fps={fps} />
      <FeatureOrbitBeat frame={frame} fps={fps} />
      <FinalLogoBeat frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

const SceneAudio = ({ fps }: { fps: number }) => (
  <>
    {[...hookWords, ...problemWords].map((item, index) => (
      <Sequence
        key={`${item.text}-${item.start}`}
        from={frameAt(item.start, fps)}
        durationInFrames={frameAt(0.16, fps)}
        layout="none"
        freeze={2}
      >
        <Audio
          playbackRate={1.08 + (index % 4) * 0.04}
          src={staticFile("audio/bubble-pop.mp3")}
          trimBefore={frameAt(0.17 + (index % 6) * 1.33, fps)}
          trimAfter={frameAt(0.3 + (index % 6) * 1.33, fps)}
          volume={() => 0.26}
        />
      </Sequence>
    ))}
    {[6.05, 6.5, 9.16, 12.12, 12.75, 16.2, 17.4].map((start, index) => (
      <Sequence
        key={`accent-${start}`}
        from={frameAt(start, fps)}
        durationInFrames={frameAt(0.18, fps)}
        layout="none"
      >
        <Audio
          playbackRate={1 + index * 0.03}
          src={staticFile("audio/card-snap.mp3")}
          trimBefore={0}
          trimAfter={frameAt(0.16, fps)}
          volume={() => 0.18}
        />
      </Sequence>
    ))}
    <Sequence
      from={frameAt(16.05, fps)}
      durationInFrames={frameAt(0.7, fps)}
      layout="none"
    >
      <Audio
        src={staticFile("audio/logo-shimmer.mp3")}
        trimBefore={frameAt(0.08, fps)}
        trimAfter={frameAt(0.62, fps)}
        volume={() => 0.32}
      />
    </Sequence>
  </>
);

type FrameProps = {
  frame: number;
  fps: number;
};

const WhiteKineticBackground = ({ frame, fps }: FrameProps) => {
  const seconds = frame / fps;
  const orbit = seconds * 9;
  const dots = Array.from({ length: 28 }, (_, index) => index);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: -80,
          background:
            "radial-gradient(circle at 34% 42%, rgba(74,163,244,0.08), transparent 34%), radial-gradient(circle at 70% 58%, rgba(109,53,223,0.09), transparent 36%)",
          filter: "blur(18px)",
        }}
      />
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{
          inset: 0,
          opacity: 0.72,
          position: "absolute",
          transform: `rotate(${orbit * 0.08}deg)`,
          transformOrigin: "960px 540px",
        }}
      >
        <OrbitArc
          radius={380}
          color={brand.blue}
          dash="620 620"
          rotate={-25 + orbit}
        />
        <OrbitArc
          radius={500}
          color={brand.violet}
          dash="760 820"
          rotate={55 - orbit * 0.8}
        />
        <OrbitArc
          radius={625}
          color={brand.orange}
          dash="500 1180"
          rotate={120 + orbit * 0.55}
        />
        <OrbitArc
          radius={720}
          color={brand.green}
          dash="420 1500"
          rotate={220 - orbit * 0.45}
        />
      </svg>
      {dots.map((index) => {
        const seed = `white-dot-${index}`;
        const x = random(`${seed}-x`) * 1920;
        const y = random(`${seed}-y`) * 1080;
        const drift =
          Math.sin(seconds * (0.18 + random(`${seed}-speed`) * 0.2) + index) *
          16;
        const size = 3 + random(`${seed}-size`) * 7;

        return (
          <span
            key={seed}
            style={{
              background: [brand.blue, brand.violet, brand.orange, brand.green][
                index % 4
              ],
              borderRadius: "50%",
              height: size,
              left: x + drift,
              opacity: 0.08 + random(`${seed}-opacity`) * 0.12,
              position: "absolute",
              top: y - drift * 0.5,
              width: size,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const OrbitArc = ({
  radius,
  color,
  dash,
  rotate,
}: {
  radius: number;
  color: string;
  dash: string;
  rotate: number;
}) => (
  <circle
    cx="960"
    cy="540"
    fill="none"
    r={radius}
    stroke={color}
    strokeDasharray={dash}
    strokeLinecap="round"
    strokeOpacity="0.24"
    strokeWidth="4"
    transform={`rotate(${rotate} 960 540)`}
  />
);

const HookBeat = ({ frame, fps }: FrameProps) => {
  const exit = progress(frame, fps, 2.52, 3.0, easeInOut);

  return (
    <CenteredLine opacity={1 - exit} y={-exit * 22}>
      {hookWords.map((word) => (
        <KineticWord
          key={word.text}
          color={word.color}
          frame={frame}
          fps={fps}
          start={word.start}
          text={word.text}
        />
      ))}
    </CenteredLine>
  );
};

const ProblemTextBeat = ({ frame, fps }: FrameProps) => {
  const enter = progress(frame, fps, 2.86, 3.16, easeOut);
  const exit = progress(frame, fps, 5.64, 6.0, easeInOut);

  return (
    <CenteredLine
      opacity={enter * (1 - exit)}
      y={mix(24, 0, enter) - exit * 18}
    >
      {problemWords.map((word) => (
        <KineticWord
          key={word.text}
          color={word.color}
          frame={frame}
          fps={fps}
          start={word.start}
          text={word.text}
        />
      ))}
    </CenteredLine>
  );
};

const CenteredLine = ({
  children,
  opacity,
  y,
}: {
  children: React.ReactNode;
  opacity: number;
  y: number;
}) => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      gap: 18,
      inset: 0,
      justifyContent: "center",
      opacity,
      position: "absolute",
      transform: `translateY(${y}px)`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

const KineticWord = ({
  color,
  frame,
  fps,
  start,
  text,
}: {
  color: string;
  frame: number;
  fps: number;
  start: number;
  text: string;
}) => {
  const appear = progress(frame, fps, start, start + 0.34, softPop);
  const fade = progress(frame, fps, start, start + 0.2, easeOut);

  return (
    <span
      style={{
        color,
        display: "inline-block",
        fontSize: 58,
        fontWeight: 800,
        letterSpacing: 0,
        lineHeight: 1,
        opacity: fade,
        textShadow: "0 22px 50px rgba(15,23,42,0.05)",
        transform: `translateX(${mix(42, 0, appear)}px) translateY(${mix(18, 0, appear)}px) scale(${mix(0.92, 1, appear)})`,
        transformOrigin: "center",
      }}
    >
      {text}
    </span>
  );
};

const OrbitTokenBeat = ({ frame, fps }: FrameProps) => {
  const beatIn = progress(frame, fps, 5.82, 6.22, easeOut);
  const exit = progress(frame, fps, 8.68, 9.0, easeInOut);
  const seconds = frame / fps;

  return (
    <AbsoluteFill style={{ opacity: beatIn * (1 - exit) }}>
      <MiniLogo frame={frame} fps={fps} start={5.96} />
      {problemTokens.map((token, index) => (
        <FloatingToken
          key={token.label}
          frame={frame}
          fps={fps}
          index={index}
          kind="problem"
          seconds={seconds}
          token={token}
        />
      ))}
    </AbsoluteFill>
  );
};

const ResolveBeat = ({ frame, fps }: FrameProps) => {
  const questionIn = progress(frame, fps, 9.0, 9.42, softPop);
  const questionOut = progress(frame, fps, 10.36, 10.76, easeInOut);
  const resolveIn = progress(frame, fps, 10.58, 11.08, easeOut);
  const exit = progress(frame, fps, 11.72, 12.0, easeInOut);

  return (
    <AbsoluteFill>
      <div
        style={{
          color: brand.ink,
          fontSize: 60,
          fontWeight: 800,
          left: 0,
          lineHeight: 1.08,
          opacity: questionIn * (1 - questionOut),
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: "45%",
          transform: `translateY(${mix(22, 0, questionIn) - questionOut * 18}px)`,
        }}
      >
        What should I revise next?
      </div>
      <div
        style={{
          color: brand.ink,
          fontSize: 58,
          fontWeight: 800,
          left: 0,
          lineHeight: 1.12,
          opacity: resolveIn * (1 - exit),
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: "43%",
          transform: `translateY(${mix(28, 0, resolveIn) - exit * 18}px)`,
        }}
      >
        <span style={{ color: brand.violet }}>Xyndrome</span> organizes it for
        you
      </div>
    </AbsoluteFill>
  );
};

const FeatureOrbitBeat = ({ frame, fps }: FrameProps) => {
  const beatIn = progress(frame, fps, 12.0, 12.46, easeOut);
  const exit = progress(frame, fps, 15.62, 16.0, easeInOut);
  const seconds = frame / fps;

  return (
    <AbsoluteFill style={{ opacity: beatIn * (1 - exit) }}>
      <div
        style={{
          color: brand.ink,
          fontSize: 42,
          fontWeight: 800,
          left: 0,
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: 174,
        }}
      >
        Everything in one clean study flow
      </div>
      <MiniLogo frame={frame} fps={fps} start={12.15} />
      {featureTokens.map((token, index) => (
        <FloatingToken
          key={token.label}
          frame={frame}
          fps={fps}
          index={index}
          kind="feature"
          seconds={seconds}
          token={token}
        />
      ))}
    </AbsoluteFill>
  );
};

type TokenSpec = {
  label: string;
  angle: number;
  radius: number;
  color: string;
  start: number;
};

const FloatingToken = ({
  frame,
  fps,
  index,
  kind,
  seconds,
  token,
}: {
  frame: number;
  fps: number;
  index: number;
  kind: "feature" | "problem";
  seconds: number;
  token: TokenSpec;
}) => {
  const enter = progress(frame, fps, token.start, token.start + 0.5, softPop);
  const angle =
    ((token.angle + seconds * (kind === "feature" ? 13 : -10)) * Math.PI) / 180;
  const x = Math.cos(angle) * token.radius;
  const y = Math.sin(angle) * token.radius * 0.58;
  const rotate = Math.sin(seconds * 0.8 + index) * 5;

  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(255,255,255,0.86)",
        border: "1px solid rgba(17,24,39,0.06)",
        borderRadius: 999,
        boxShadow: "0 22px 70px rgba(17,24,39,0.08)",
        color: token.color,
        display: "flex",
        fontSize: kind === "feature" ? 32 : 30,
        fontWeight: 800,
        height: kind === "feature" ? 88 : 82,
        justifyContent: "center",
        left: "50%",
        opacity: enter,
        padding: "0 32px",
        position: "absolute",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${mix(0.72, 1, enter)})`,
        whiteSpace: "nowrap",
      }}
    >
      {token.label}
    </div>
  );
};

const MiniLogo = ({
  frame,
  fps,
  start,
}: {
  frame: number;
  fps: number;
  start: number;
}) => {
  const enter = progress(frame, fps, start, start + 0.5, softPop);

  return (
    <div
      style={{
        alignItems: "center",
        background: "#FFFFFF",
        borderRadius: "50%",
        boxShadow: "0 28px 90px rgba(82,116,243,0.14)",
        display: "flex",
        height: 150,
        justifyContent: "center",
        left: "50%",
        opacity: enter,
        position: "absolute",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${mix(0.74, 1, enter)})`,
        width: 150,
      }}
    >
      <Img
        src={staticFile("logo-mark-light.webp")}
        style={{
          height: 86,
          objectFit: "contain",
          width: 96,
        }}
      />
    </div>
  );
};

const FinalLogoBeat = ({ frame, fps }: FrameProps) => {
  const whiteOut = progress(frame, fps, 15.74, 16.1, easeInOut);
  const logoIn = progress(frame, fps, 16.08, 16.8, softPop);
  const logoExit = progress(frame, fps, 17.66, 18.02, easeInOut);
  const ctaIn = progress(frame, fps, 17.82, 18.28, softPop);
  const wordOneOut = progress(frame, fps, 18.48, 18.78, easeInOut);
  const wordTwoIn = progress(frame, fps, 18.48, 18.78, easeInOut);
  const wordTwoOut = progress(frame, fps, 19.08, 19.38, easeInOut);
  const wordThreeIn = progress(frame, fps, 19.08, 19.38, easeInOut);

  return (
    <AbsoluteFill style={{ opacity: whiteOut }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 48%, #FFFFFF 0%, #FBFDFF 44%, #F7F1FF 100%)",
        }}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          inset: 0,
          justifyContent: "center",
          opacity: logoIn * (1 - logoExit),
          position: "absolute",
          transform: `translateY(${mix(34, 0, logoIn) - logoExit * 120}px) scale(${mix(0.88, 1, logoIn)})`,
        }}
      >
        <Img
          src={staticFile("logo-full.png")}
          style={{
            filter: "drop-shadow(0 28px 56px rgba(82,116,243,0.16))",
            height: 270,
            objectFit: "contain",
            width: 560,
          }}
        />
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          inset: 0,
          justifyContent: "center",
          opacity: ctaIn,
          position: "absolute",
          transform: `translateY(${mix(34, 0, ctaIn)}px) scale(${mix(0.9, 1, ctaIn)})`,
        }}
      >
        <InstagramIcon />
        <div
          style={{
            color: brand.ink,
            fontSize: 58,
            fontWeight: 800,
            height: 76,
            lineHeight: "76px",
            marginLeft: 18,
            overflow: "hidden",
            position: "relative",
            width: 238,
          }}
        >
          <RotatingCtaWord text="Follow" progressOut={wordOneOut} />
          <RotatingCtaWord
            text="for"
            progressIn={wordTwoIn}
            progressOut={wordTwoOut}
          />
          <RotatingCtaWord text="more" progressIn={wordThreeIn} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RotatingCtaWord = ({
  progressIn = 1,
  progressOut = 0,
  text,
}: {
  progressIn?: number;
  progressOut?: number;
  text: string;
}) => {
  const y = mix(76, 0, progressIn) + mix(0, -76, progressOut);
  const rotate = mix(40, 0, progressIn) + mix(0, -40, progressOut);

  return (
    <span
      style={{
        display: "block",
        left: 0,
        opacity: progressIn * (1 - progressOut),
        position: "absolute",
        top: 0,
        transform: `translateY(${y}px) rotateX(${rotate}deg)`,
        transformOrigin: "center 112px",
        width: "100%",
      }}
    >
      {text}
    </span>
  );
};

const InstagramIcon = () => (
  <div
    style={{
      alignItems: "center",
      background:
        "linear-gradient(135deg, #F58529, #DD2A7B 46%, #8134AF 72%, #515BD4)",
      borderRadius: 28,
      boxShadow: "0 24px 58px rgba(221,42,123,0.26)",
      display: "flex",
      height: 88,
      justifyContent: "center",
      width: 88,
    }}
  >
    <svg width="52" height="52" viewBox="0 0 34 34" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="24"
        height="24"
        rx="8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <circle
        cx="17"
        cy="17"
        r="6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3"
      />
      <circle cx="24.5" cy="9.5" r="2" fill="#FFFFFF" />
    </svg>
  </div>
);
