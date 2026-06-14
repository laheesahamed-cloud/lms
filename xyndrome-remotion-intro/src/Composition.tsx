import { Audio } from "@remotion/media";
import type { CSSProperties } from "react";
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
  ink: "#0F172A",
  muted: "#64748B",
  blue: "#4AA3F4",
  indigo: "#5274F3",
  violet: "#6D35DF",
  deep: "#2563EB",
  cream: "#FAFAF7",
  surface: "#F7F9FC",
  rose: "#FFD6D6",
  sky: "#D6F0FF",
  lavender: "#E8D6FF",
  mint: "#D6FFE8",
  peach: "#FFF3D6",
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const softPop = Easing.bezier(0.34, 1.56, 0.64, 1);

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

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

type StudyObject = {
  kind: "book" | "note" | "card" | "pill" | "scope" | "heart";
  label: string;
  color: string;
  accent: string;
  startX: number;
  startY: number;
  orbitRadius: number;
  orbitAngle: number;
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  rotate: number;
};

const studyObjects: StudyObject[] = [
  {
    kind: "book",
    label: "Anatomy",
    color: "#FFFFFF",
    accent: brand.sky,
    startX: -190,
    startY: 255,
    orbitRadius: 420,
    orbitAngle: -2.5,
    targetX: -180,
    targetY: -76,
    width: 250,
    height: 78,
    rotate: -8,
  },
  {
    kind: "book",
    label: "Pathology",
    color: "#F8FAFC",
    accent: brand.lavender,
    startX: -128,
    startY: 190,
    orbitRadius: 500,
    orbitAngle: -1.52,
    targetX: -92,
    targetY: 18,
    width: 235,
    height: 70,
    rotate: 6,
  },
  {
    kind: "note",
    label: "notes",
    color: brand.peach,
    accent: "#F59E0B",
    startX: 230,
    startY: 110,
    orbitRadius: 445,
    orbitAngle: -0.45,
    targetX: 122,
    targetY: -58,
    width: 155,
    height: 132,
    rotate: 12,
  },
  {
    kind: "card",
    label: "MCQs",
    color: "#FFFFFF",
    accent: brand.mint,
    startX: 190,
    startY: 280,
    orbitRadius: 520,
    orbitAngle: 0.55,
    targetX: 178,
    targetY: 56,
    width: 175,
    height: 112,
    rotate: -15,
  },
  {
    kind: "card",
    label: "flashcards",
    color: "#FFFFFF",
    accent: brand.rose,
    startX: -270,
    startY: 84,
    orbitRadius: 470,
    orbitAngle: 1.35,
    targetX: 6,
    targetY: 102,
    width: 205,
    height: 118,
    rotate: -18,
  },
  {
    kind: "note",
    label: "mock exams",
    color: brand.sky,
    accent: brand.deep,
    startX: 35,
    startY: 324,
    orbitRadius: 410,
    orbitAngle: 2.22,
    targetX: -132,
    targetY: 86,
    width: 180,
    height: 122,
    rotate: 8,
  },
  {
    kind: "pill",
    label: "",
    color: brand.rose,
    accent: "#FFFFFF",
    startX: 266,
    startY: -34,
    orbitRadius: 360,
    orbitAngle: 2.86,
    targetX: 92,
    targetY: 6,
    width: 130,
    height: 54,
    rotate: -28,
  },
  {
    kind: "scope",
    label: "",
    color: "#FFFFFF",
    accent: brand.indigo,
    startX: -244,
    startY: -18,
    orbitRadius: 490,
    orbitAngle: 3.54,
    targetX: -16,
    targetY: -88,
    width: 185,
    height: 130,
    rotate: 18,
  },
  {
    kind: "heart",
    label: "",
    color: brand.rose,
    accent: brand.violet,
    startX: 10,
    startY: 62,
    orbitRadius: 310,
    orbitAngle: 4.43,
    targetX: 20,
    targetY: -4,
    width: 114,
    height: 114,
    rotate: -4,
  },
];

const beatLines = [
  { start: 0.25, end: 3.95, text: "Tired of juggling five different study apps?" },
  { start: 4.15, end: 7.85, text: "Notes here. MCQs there. Flashcards somewhere else." },
  { start: 8.25, end: 11.85, text: "What if everything just came together?" },
  { start: 12.2, end: 16.75, text: "Notes, MCQs, flashcards and mock exams. One calm place." },
  { start: 17.1, end: 20.65, text: "We've got you." },
];

export const XyndromeIntro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill className="xy-video">
      <AudioLayer />
      <Background frame={frame} fps={fps} />
      <ParticleField frame={frame} fps={fps} />
      <DeskPlane frame={frame} fps={fps} />
      <BeatCopy frame={frame} fps={fps} />
      <StudySystem frame={frame} fps={fps} />
      <EcgPulse frame={frame} fps={fps} />
      <AppCore frame={frame} fps={fps} />
      <FeatureStack frame={frame} fps={fps} />
      <AbstractX frame={frame} fps={fps} />
      <LogoLockup frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

const AudioLayer = () => {
  const { fps } = useVideoConfig();
  const voiceWindows = [
    [0.2, 3.7],
    [4.35, 7.8],
    [8.25, 11.7],
    [12.15, 16.4],
    [17.25, 19.5],
    [20.65, 24.1],
  ];

  const bedVolume = (localFrame: number) => {
    const seconds = localFrame / fps;
    const duck = voiceWindows.some(([start, end]) => seconds >= start && seconds <= end);
    const lift = progress(localFrame, fps, 8, 18, easeInOut);
    const fade = 1 - progress(localFrame, fps, 23.2, 25, easeInOut);
    return (duck ? 0.13 : 0.23 + lift * 0.05) * fade;
  };

  return (
    <>
      <Audio src={staticFile("audio/bed.mp3")} volume={bedVolume} />
      <AudioAt src="audio/vo1.mp3" at={0.25} volume={1.15} />
      <AudioAt src="audio/vo2.mp3" at={4.35} volume={1.12} />
      <AudioAt src="audio/vo3.mp3" at={8.25} volume={1.12} />
      <AudioAt src="audio/vo4.mp3" at={12.15} volume={1.12} />
      <AudioAt src="audio/vo5.mp3" at={17.25} volume={1.18} />
      <AudioAt src="audio/vo6.mp3" at={20.65} volume={1.15} />
      <AudioAt src="audio/whoosh.mp3" at={3.75} volume={0.42} />
      <AudioAt src="audio/whoosh.mp3" at={7.85} volume={0.55} playbackRate={0.9} />
      <AudioAt src="audio/heartbeat.mp3" at={8.55} volume={0.72} />
      <AudioAt src="audio/card-snap.mp3" at={12.8} volume={0.3} />
      <AudioAt src="audio/card-snap.mp3" at={14.1} volume={0.24} playbackRate={1.15} />
      <AudioAt src="audio/card-snap.mp3" at={15.35} volume={0.24} playbackRate={0.92} />
      <AudioAt src="audio/logo-shimmer.mp3" at={17.1} volume={0.42} />
      <AudioAt src="audio/logo-shimmer.mp3" at={20.9} volume={0.5} playbackRate={1.04} />
    </>
  );
};

const AudioAt = ({
  src,
  at,
  volume,
  playbackRate,
}: {
  src: string;
  at: number;
  volume: number;
  playbackRate?: number;
}) => {
  const { fps } = useVideoConfig();
  const from = frameAt(at, fps);

  return (
    <Sequence from={from} layout="none">
      <Audio src={staticFile(src)} volume={volume} playbackRate={playbackRate} />
    </Sequence>
  );
};

const Background = ({ frame, fps }: FrameProps) => {
  const turn = progress(frame, fps, 7.8, 12, easeInOut);
  const resolve = progress(frame, fps, 17, 22, easeInOut);
  const coolWash = mix(0.18, 0.02, turn);
  const warmth = mix(0.3, 0.78, turn);

  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(150deg, rgba(214,240,255,${0.7 - turn * 0.18}), rgba(250,250,247,${warmth}) 38%, rgba(232,214,255,${0.28 + resolve * 0.12}) 100%),
          radial-gradient(ellipse at 50% 12%, rgba(255,255,255,0.98), rgba(247,249,252,0.72) 46%, rgba(234,242,255,0.9))
        `,
      }}
    >
      <div
        className="xy-grain"
        style={{
          opacity: 0.12 - resolve * 0.04,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(15,23,42,${coolWash}), transparent 22%, rgba(255,255,255,0.18) 65%, rgba(15,23,42,${0.06 - resolve * 0.04}))`,
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};

type FrameProps = {
  frame: number;
  fps: number;
};

const DeskPlane = ({ frame, fps }: FrameProps) => {
  const lift = progress(frame, fps, 3.2, 7.6, easeOut);
  const fade = 1 - progress(frame, fps, 8.2, 10.3, easeInOut);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "66%",
        width: 930,
        height: 520,
        borderRadius: 54,
        background: `linear-gradient(135deg, ${brand.cream}, #FFFFFF)`,
        boxShadow: "0 42px 95px rgba(49, 64, 120, 0.13)",
        opacity: fade,
        transform: `translate(-50%, -50%) perspective(1000px) rotateX(${mix(61, 67, lift)}deg) translateY(${lift * 86}px) scale(${1 + lift * 0.04})`,
        transformOrigin: "center",
      }}
    />
  );
};

const BeatCopy = ({ frame, fps }: FrameProps) => {
  return (
    <div className="xy-copy-shell">
      {beatLines.map((beat) => {
        const enter = progress(frame, fps, beat.start, beat.start + 0.7, easeOut);
        const exit = progress(frame, fps, beat.end - 0.7, beat.end, easeInOut);
        const opacity = enter * (1 - exit);
        const y = mix(26, 0, enter) - exit * 18;

        return (
          <div
            key={beat.text}
            className="xy-beat-copy"
            style={{
              opacity,
              transform: `translate3d(0, ${y}px, 0)`,
            }}
          >
            {beat.text}
          </div>
        );
      })}
    </div>
  );
};

const StudySystem = ({ frame, fps }: FrameProps) => {
  return (
    <AbsoluteFill>
      {studyObjects.map((item, index) => (
        <StudyObjectNode key={`${item.kind}-${item.label}-${index}`} item={item} index={index} frame={frame} fps={fps} />
      ))}
    </AbsoluteFill>
  );
};

const StudyObjectNode = ({
  item,
  index,
  frame,
  fps,
}: {
  item: StudyObject;
  index: number;
  frame: number;
  fps: number;
}) => {
  const time = frame / fps;
  const lift = progress(frame, fps, 2.9, 7.85, easeOut);
  const order = progress(frame, fps, 8.0, 12.05, easeInOut);
  const converge = progress(frame, fps, 12.0, 16.8, easeInOut);
  const vanish = progress(frame, fps, 16.9, 18.4, easeInOut);
  const pulse = Math.sin(time * 2.1 + index) * (1 - order) * 26;
  const orbitSpin = time * mix(0.96, 0.28, order);
  const chaosRadius = item.orbitRadius + Math.sin(time * 1.7 + index * 1.3) * 44 * (1 - order);
  const orbitX = Math.cos(item.orbitAngle + orbitSpin) * chaosRadius + pulse;
  const orbitY = Math.sin(item.orbitAngle + orbitSpin) * chaosRadius * 1.22;
  const orderedX = Math.cos(item.orbitAngle + order * 0.75) * 330;
  const orderedY = Math.sin(item.orbitAngle + order * 0.75) * 420;
  const liftedX = mix(item.startX, orbitX, lift);
  const liftedY = mix(item.startY, orbitY, lift);
  const calmX = mix(liftedX, orderedX, order);
  const calmY = mix(liftedY, orderedY, order);
  const x = mix(calmX, item.targetX, converge);
  const y = mix(calmY, item.targetY, converge);
  const rotate = item.rotate + lift * Math.sin(time * 1.35 + index) * 24 - converge * item.rotate * 0.72;
  const scale = mix(1, 0.82, converge) + softPop(clamp((converge - 0.72) / 0.28)) * 0.08;
  const opacity = (1 - vanish) * mix(0.86, 1, lift);
  const blur = mix(0, 4, vanish);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: item.width,
        height: item.height,
        opacity,
        filter: `blur(${blur}px) drop-shadow(0 24px 36px rgba(37, 99, 235, ${0.09 + order * 0.04}))`,
        transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      {renderStudyShape(item, frame, fps, index)}
    </div>
  );
};

const renderStudyShape = (
  item: StudyObject,
  frame: number,
  fps: number,
  index: number,
) => {
  const heartbeat = progress(frame, fps, 14.0, 14.55, softPop);
  const common: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: item.kind === "note" ? 22 : 30,
    background: item.color,
    border: "1px solid rgba(82,116,243,0.12)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
  };

  if (item.kind === "book") {
    return (
      <div className="xy-object xy-book" style={common}>
        <div className="xy-book-band" style={{ background: item.accent }} />
        <span>{item.label}</span>
      </div>
    );
  }

  if (item.kind === "note") {
    return (
      <div className="xy-object xy-note" style={common}>
        <span>{item.label}</span>
        <div style={{ background: item.accent }} />
      </div>
    );
  }

  if (item.kind === "card") {
    return (
      <div className="xy-object xy-card" style={common}>
        <div className="xy-card-topline" style={{ background: item.accent }} />
        <span>{item.label}</span>
        <div className="xy-card-rows" />
      </div>
    );
  }

  if (item.kind === "pill") {
    return (
      <div className="xy-pill">
        <div style={{ background: item.color }} />
        <div style={{ background: item.accent }} />
      </div>
    );
  }

  if (item.kind === "scope") {
    return (
      <svg viewBox="0 0 190 130" className="xy-scope" aria-hidden="true">
        <path
          d="M54 22v25c0 27 20 47 44 47s44-20 44-47V22"
          fill="none"
          stroke={item.accent}
          strokeLinecap="round"
          strokeWidth="13"
        />
        <path
          d="M98 94c0 22 15 35 35 35 18 0 31-12 31-28"
          fill="none"
          stroke={brand.ink}
          strokeLinecap="round"
          strokeWidth="10"
          opacity="0.24"
        />
        <circle cx="165" cy="97" r="16" fill={brand.sky} stroke={item.accent} strokeWidth="8" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 120 120"
      className="xy-heart"
      aria-hidden="true"
      style={{
        transform: `scale(${1 + heartbeat * 0.08 + Math.sin(frame / fps * 3 + index) * 0.012})`,
      }}
    >
      <path
        d="M61 100C32 77 18 61 18 39c0-14 11-25 25-25 8 0 15 4 19 10 4-6 11-10 19-10 14 0 25 11 25 25 0 22-16 39-45 61Z"
        fill={item.color}
        stroke={item.accent}
        strokeWidth="7"
      />
      <path
        d="M36 55h13l6-12 12 26 7-14h12"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
    </svg>
  );
};

const EcgPulse = ({ frame, fps }: FrameProps) => {
  const draw = progress(frame, fps, 8.0, 10.7, easeOut);
  const fade = progress(frame, fps, 11.5, 13.1, easeInOut);
  const glow = progress(frame, fps, 8.45, 9.2, softPop);
  const length = 2200;

  return (
    <svg
      viewBox="0 0 1080 1920"
      style={{
        position: "absolute",
        inset: 0,
        opacity: draw * (1 - fade),
        filter: `drop-shadow(0 0 ${18 + glow * 34}px rgba(109, 53, 223, 0.42))`,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pulseGradient" x1="110" x2="970" y1="0" y2="0">
          <stop offset="0%" stopColor={brand.blue} />
          <stop offset="52%" stopColor={brand.indigo} />
          <stop offset="100%" stopColor={brand.violet} />
        </linearGradient>
      </defs>
      <path
        d="M-80 1004 C70 1000 132 1000 210 1000 L266 1000 L294 942 L342 1084 L390 874 L446 1000 L560 1000 C646 1000 674 946 730 946 C804 946 796 1002 890 1002 L1160 1002"
        fill="none"
        stroke="url(#pulseGradient)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={(1 - draw) * length}
        strokeWidth="16"
      />
      <path
        d="M-80 1004 C70 1000 132 1000 210 1000 L266 1000 L294 942 L342 1084 L390 874 L446 1000 L560 1000 C646 1000 674 946 730 946 C804 946 796 1002 890 1002 L1160 1002"
        fill="none"
        stroke="rgba(255,255,255,0.74)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={(1 - draw) * length}
        strokeWidth="5"
      />
    </svg>
  );
};

const AppCore = ({ frame, fps }: FrameProps) => {
  const enter = progress(frame, fps, 9.2, 11.7, easeOut);
  const assemble = progress(frame, fps, 12.0, 16.4, easeInOut);
  const exit = progress(frame, fps, 16.8, 18.0, easeInOut);
  const opacity = enter * (1 - exit);
  const y = mix(42, -8, enter) + assemble * -20;
  const scale = mix(0.82, 1, enter) - exit * 0.08;

  return (
    <div
      className="xy-core"
      style={{
        opacity,
        transform: `translate(-50%, -50%) translate3d(0, ${y}px, 0) scale(${scale})`,
      }}
    >
      <div className="xy-phone">
        <div className="xy-phone-glass" />
        <div className="xy-phone-header">
          <span>xyndrome</span>
          <div />
        </div>
        <div className="xy-progress-ring">
          <span>{Math.round(mix(21, 84, assemble))}%</span>
        </div>
        <div className="xy-plan-card">
          <strong>Today</strong>
          <span>48 MCQs</span>
          <span>12 flashcards</span>
        </div>
        <div className="xy-mini-grid">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
};

const FeatureStack = ({ frame, fps }: FrameProps) => {
  const enter = progress(frame, fps, 12.1, 13.1, easeOut);
  const exit = progress(frame, fps, 16.5, 17.6, easeInOut);
  const features = [
    ["AI notes", brand.sky],
    ["MCQ bank", brand.mint],
    ["flashcards", brand.rose],
    ["mock exams", brand.lavender],
  ] as const;

  return (
    <div
      className="xy-feature-stack"
      style={{
        opacity: enter * (1 - exit),
        transform: `translate(-50%, 0) translateY(${mix(42, 0, enter) + exit * -20}px)`,
      }}
    >
      {features.map(([label, color], index) => {
        const itemEnter = progress(frame, fps, 12.25 + index * 0.22, 13.15 + index * 0.22, softPop);
        return (
          <div
            key={label}
            className="xy-feature-pill"
            style={{
              background: color,
              opacity: itemEnter,
              transform: `translateY(${mix(24, 0, itemEnter)}px) scale(${mix(0.94, 1, itemEnter)})`,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

const AbstractX = ({ frame, fps }: FrameProps) => {
  const form = progress(frame, fps, 16.75, 18.2, softPop);
  const settle = progress(frame, fps, 18.2, 20.8, easeInOut);
  const fade = progress(frame, fps, 21.0, 22.0, easeInOut);
  const opacity = form * (1 - fade);
  const scale = mix(0.82, 1.03, form) - settle * 0.03;
  const rotation = mix(-12, 0, form);

  return (
    <div
      className="xy-abstract-x"
      style={{
        opacity,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
      }}
    >
      <div className="xy-x-bar xy-x-a" />
      <div className="xy-x-bar xy-x-b" />
      <div className="xy-x-core" />
      <div className="xy-x-ring" />
    </div>
  );
};

const LogoLockup = ({ frame, fps }: FrameProps) => {
  const logoIn = progress(frame, fps, 20.85, 22.0, easeOut);
  const tagIn = progress(frame, fps, 22.05, 23.1, easeOut);
  const finalGlow = progress(frame, fps, 21.0, 22.5, softPop);

  return (
    <div
      className="xy-lockup"
      style={{
        opacity: logoIn,
        transform: `translate(-50%, -50%) translateY(${mix(28, 0, logoIn)}px)`,
        filter: `drop-shadow(0 28px ${34 + finalGlow * 24}px rgba(82, 116, 243, 0.18))`,
      }}
    >
      <Img src={staticFile("logo-full.png")} className="xy-logo" />
      <div
        className="xy-tagline"
        style={{
          opacity: tagIn,
          transform: `translateY(${mix(22, 0, tagIn)}px)`,
        }}
      >
        Your exam prep starts now.
      </div>
    </div>
  );
};

const ParticleField = ({ frame, fps }: FrameProps) => {
  const turn = progress(frame, fps, 8, 12, easeInOut);
  const lock = progress(frame, fps, 17, 21, easeInOut);
  const particles = Array.from({ length: 54 }, (_, index) => index);

  return (
    <AbsoluteFill>
      {particles.map((index) => {
        const seed = `particle-${index}`;
        const baseX = random(`${seed}-x`) * 1080;
        const baseY = random(`${seed}-y`) * 1920;
        const drift = (random(`${seed}-drift`) - 0.5) * 88;
        const size = 3 + random(`${seed}-size`) * 5;
        const spin = frame / fps * (0.24 + random(`${seed}-speed`) * 0.4);
        const xTarget = 540 + Math.cos(index * 2.399 + spin) * (150 + index % 4 * 28);
        const yTarget = 960 + Math.sin(index * 2.399 + spin) * (180 + index % 5 * 22);
        const x = mix(baseX + Math.sin(spin + index) * drift, xTarget, lock);
        const y = mix(baseY + Math.cos(spin * 0.7 + index) * drift, yTarget, lock);
        const tone = [brand.sky, brand.lavender, brand.mint, brand.peach, "#FFFFFF"][index % 5];
        const opacity = (0.2 + random(`${seed}-o`) * 0.34 + turn * 0.15) * (1 - progress(frame, fps, 22.8, 25, easeInOut));

        return (
          <span
            key={seed}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              opacity,
              borderRadius: 2,
              background: tone,
              transform: `rotate(${spin * 100}deg)`,
              boxShadow: "0 0 14px rgba(82,116,243,0.18)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
