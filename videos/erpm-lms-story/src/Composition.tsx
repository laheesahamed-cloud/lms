import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

type ShotKey = "dashboard" | "qbank" | "courses" | "lessons" | "results" | "landing";

type SceneKind = "hero" | "focus" | "library" | "practice" | "lessons" | "analytics" | "platform" | "final";

type Scene = {
  from: number;
  duration: number;
  kind: SceneKind;
  shot: ShotKey;
  eyebrow: string;
  title: string;
  subline: string;
  cue: string;
  sfx: string;
  accent: string;
};

const shots: Record<ShotKey, string> = {
  dashboard: "screenshots/fresh-01-dashboard.png",
  qbank: "screenshots/fresh-02-qbank.png",
  courses: "screenshots/fresh-03-courses.png",
  lessons: "screenshots/fresh-04-lessons.png",
  results: "screenshots/fresh-05-results.png",
  landing: "screenshots/fresh-06-landing-desktop.png",
};

const scenes: Scene[] = [
  {
    from: 0,
    duration: 105,
    kind: "hero",
    shot: "dashboard",
    eyebrow: "Medical SaaS",
    title: "ERPM LMS",
    subline: "A premium study platform for focused clinical revision.",
    cue: "VO: Meet ERPM LMS, a premium medical learning platform built for focused revision.",
    sfx: "SFX: deep riser, clean logo hit, soft whoosh.",
    accent: "#38bdf8",
  },
  {
    from: 105,
    duration: 120,
    kind: "focus",
    shot: "dashboard",
    eyebrow: "Daily focus",
    title: "One home for the next study move",
    subline: "Dashboard, streaks, quick actions, and lesson routing in one mobile shell.",
    cue: "VO: The dashboard turns every session into one clear next step.",
    sfx: "SFX: cursor tap, card pop, short swipe.",
    accent: "#8b5cf6",
  },
  {
    from: 225,
    duration: 120,
    kind: "library",
    shot: "courses",
    eyebrow: "Course engine",
    title: "Structured learning paths",
    subline: "Courses, readiness, lesson counts, and progress are surfaced instantly.",
    cue: "VO: Courses are structured so students can see where they are and what is left.",
    sfx: "SFX: stacked card whoosh, light data tick.",
    accent: "#22c55e",
  },
  {
    from: 345,
    duration: 120,
    kind: "practice",
    shot: "qbank",
    eyebrow: "Question bank",
    title: "Practice without the clutter",
    subline: "Q-Bank groups practice sets by course for fast revision decisions.",
    cue: "VO: The Q-Bank keeps practice sets clean, direct, and ready to start.",
    sfx: "SFX: fast swipe, two small clicks.",
    accent: "#60a5fa",
  },
  {
    from: 465,
    duration: 120,
    kind: "lessons",
    shot: "lessons",
    eyebrow: "Lesson notes",
    title: "Mobile-first clinical notes",
    subline: "Lessons are built as readable, navigable study modules.",
    cue: "VO: Lesson notes are designed for mobile study, not messy scrolling.",
    sfx: "SFX: page flip, soft reveal.",
    accent: "#a78bfa",
  },
  {
    from: 585,
    duration: 120,
    kind: "analytics",
    shot: "results",
    eyebrow: "Performance",
    title: "A study loop with feedback",
    subline: "Attempts, averages, history, and review status become visible.",
    cue: "VO: Results close the loop with performance, history, and review status.",
    sfx: "SFX: data ticks, graph sweep.",
    accent: "#f472b6",
  },
  {
    from: 705,
    duration: 105,
    kind: "platform",
    shot: "landing",
    eyebrow: "Full product",
    title: "Student app plus SaaS platform",
    subline: "Auth, subscriptions, content, analytics, and responsive surfaces.",
    cue: "VO: Behind the mobile app is a full SaaS system for content, access, and growth.",
    sfx: "SFX: controlled glitch, wide-screen impact.",
    accent: "#06b6d4",
  },
  {
    from: 810,
    duration: 90,
    kind: "final",
    shot: "dashboard",
    eyebrow: "Launch ready",
    title: "ERPM Medical LMS",
    subline: "A modern learning system with a polished student experience.",
    cue: "VO: ERPM LMS is ready to become a premium medical learning experience.",
    sfx: "SFX: final whoosh, logo resolve.",
    accent: "#2563eb",
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function mapRange(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function useSceneMotion(scene: Scene) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - scene.from;
  const enter = spring({ frame: local, fps, config: { damping: 19, stiffness: 115 } });
  const exit = mapRange(local, [scene.duration - 18, scene.duration], [1, 0]);
  return {
    local,
    enter,
    exit,
    opacity: enter * exit,
    progress: clamp(local / scene.duration, 0, 1),
  };
}

function GlassCard({
  className = "",
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div className={`glass-card ${className}`} style={style}>{children}</div>;
}

function TextBlock({ scene, local }: { scene: Scene; local: number }) {
  const y = mapRange(local, [0, 24], [44, 0]);
  const opacity = mapRange(local, [0, 18], [0, 1]);
  return (
    <div className="motion-copy" style={{ transform: `translateY(${y}px)`, opacity }}>
      <div className="motion-eyebrow" style={{ color: scene.accent }}>{scene.eyebrow}</div>
      <h1>{scene.title}</h1>
      <p>{scene.subline}</p>
    </div>
  );
}

function PhoneShell({
  shot,
  local,
  accent,
  variant = "front",
}: {
  shot: ShotKey;
  local: number;
  accent: string;
  variant?: "front" | "right" | "small";
}) {
  const lift = mapRange(local, [0, 34], [110, 0]);
  const scale = variant === "small" ? 0.66 : variant === "right" ? 0.82 : 0.9;
  const rotate = variant === "right" ? -7 : variant === "small" ? 5 : 0;
  const drift = Math.sin(local / 24) * 8;

  return (
    <div
      className={`phone-shell phone-${variant}`}
      style={{
        borderColor: `${accent}66`,
        transform: `translateY(${lift + drift}px) rotate(${rotate}deg) scale(${scale})`,
      }}
    >
      <div className="phone-top">
        <span />
      </div>
      <Img src={staticFile(shots[shot])} className="phone-shot" />
    </div>
  );
}

function WideScreen({ local, accent }: { local: number; accent: string }) {
  const y = mapRange(local, [0, 28], [96, 0]);
  const rotate = mapRange(local, [0, 80], [-4, 0]);
  return (
    <div
      className="wide-screen"
      style={{ borderColor: `${accent}66`, transform: `translateY(${y}px) rotateX(${rotate}deg)` }}
    >
      <Img src={staticFile(shots.landing)} className="wide-shot" />
      <div className="wide-overlay">
        <span>WEB</span>
        <span>APP</span>
        <span>ADMIN</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  local,
  delay,
  accent,
  x,
  y,
}: {
  label: string;
  value: string;
  local: number;
  delay: number;
  accent: string;
  x: number;
  y: number;
}) {
  const pop = spring({ frame: local - delay, fps: 30, config: { damping: 15, stiffness: 130 } });
  return (
    <GlassCard
      className="metric-card"
      style={{
        transform: `translateY(${mapRange(pop, [0, 1], [34, 0])}px) scale(${mapRange(pop, [0, 1], [0.9, 1])})`,
        opacity: pop,
        borderColor: `${accent}38`,
        left: x,
        top: y,
      }}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </GlassCard>
  );
}

function CursorTap({ local, x, y, accent }: { local: number; x: number; y: number; accent: string }) {
  const appear = mapRange(local, [18, 30], [0, 1]);
  const tap = interpolate(local, [52, 60, 72], [1, 0.78, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ring = mapRange(local, [54, 78], [0, 1]);
  return (
    <div className="cursor-wrap" style={{ left: x, top: y, opacity: appear, transform: `scale(${tap})` }}>
      <div className="tap-ring" style={{ opacity: 1 - ring, transform: `scale(${1 + ring * 1.9})`, borderColor: accent }} />
      <div className="cursor-arrow" />
    </div>
  );
}

function FeatureRail({ local, accent, items }: { local: number; accent: string; items: string[] }) {
  return (
    <div className="feature-rail">
      {items.map((item, index) => {
        const p = spring({ frame: local - 18 - index * 7, fps: 30, config: { damping: 17, stiffness: 120 } });
        return (
          <div
            className="feature-pill"
            style={{
              borderColor: `${accent}55`,
              transform: `translateX(${mapRange(p, [0, 1], [80, 0])}px)`,
              opacity: p,
            }}
            key={item}
          >
            <span style={{ background: accent }} />
            {item}
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({ local, accent }: { local: number; accent: string }) {
  const bars = [58, 82, 44, 76, 95, 68];
  const draw = mapRange(local, [18, 88], [0, 1]);
  return (
    <GlassCard className="chart-panel" style={{ borderColor: `${accent}42` }}>
      <div className="panel-title">Study signal</div>
      <div className="bars">
        {bars.map((bar, index) => (
          <span
            key={`${bar}-${index}`}
            style={{
              height: `${bar * draw}%`,
              background: index === 4 ? accent : "rgba(148, 163, 184, 0.45)",
            }}
          />
        ))}
      </div>
      <svg viewBox="0 0 360 110" className="graph-line">
        <path d="M8 86 C58 62 82 84 130 48 S214 20 258 44 S318 48 350 18" style={{ strokeDashoffset: 420 - 420 * draw, stroke: accent }} />
      </svg>
    </GlassCard>
  );
}

function OrbitSystem({ local, accent }: { local: number; accent: string }) {
  const p = mapRange(local, [10, 52], [0, 1]);
  const labels = ["Auth", "Courses", "Q-Bank", "Results", "Plans"];
  return (
    <div className="orbit-system" style={{ opacity: p, transform: `scale(${0.86 + p * 0.14})` }}>
      <div className="orbit-core" style={{ boxShadow: `0 0 44px ${accent}88` }}>ERPM</div>
      {labels.map((label, index) => (
        <div className={`orbit-node orbit-node-${index}`} key={label}>
          {label}
        </div>
      ))}
    </div>
  );
}

function HeroVisual({ scene, local }: { scene: Scene; local: number }) {
  return (
    <>
      <PhoneShell shot="dashboard" local={local} accent={scene.accent} />
      <MetricCard label="courses" value="4" local={local} delay={20} accent={scene.accent} x={68} y={710} />
      <MetricCard label="practice sets" value="9" local={local} delay={30} accent={scene.accent} x={790} y={820} />
      <MetricCard label="lessons" value="9" local={local} delay={40} accent={scene.accent} x={92} y={1180} />
      <FeatureRail local={local} accent={scene.accent} items={["Student app", "Course library", "Performance loop"]} />
    </>
  );
}

function SceneVisual({ scene, local }: { scene: Scene; local: number }) {
  if (scene.kind === "hero") return <HeroVisual scene={scene} local={local} />;
  if (scene.kind === "platform") {
    return (
      <>
        <WideScreen local={local} accent={scene.accent} />
        <OrbitSystem local={local} accent={scene.accent} />
        <FeatureRail local={local} accent={scene.accent} items={["Auth", "Subscriptions", "Content", "Analytics"]} />
      </>
    );
  }
  if (scene.kind === "final") {
    return (
      <>
        <PhoneShell shot="dashboard" local={local} accent={scene.accent} variant="small" />
        <OrbitSystem local={local} accent={scene.accent} />
        <GlassCard className="final-card" style={{ borderColor: `${scene.accent}66` }}>
          <span>Premium medical learning</span>
          <strong>ERPM LMS</strong>
        </GlassCard>
      </>
    );
  }

  const railItems = {
    focus: ["Next move", "Streaks", "Quick actions"],
    library: ["Courses", "Readiness", "Progress"],
    practice: ["Medicine", "Surgery", "Practice sets"],
    lessons: ["Clinical notes", "Readable modules", "Mobile-first"],
    analytics: ["Attempts", "Average", "Review status"],
  }[scene.kind] ?? [];

  return (
    <>
      <PhoneShell shot={scene.shot} local={local} accent={scene.accent} variant="right" />
      <ChartPanel local={local} accent={scene.accent} />
      <CursorTap local={local} x={scene.kind === "analytics" ? 645 : 705} y={scene.kind === "lessons" ? 595 : 715} accent={scene.accent} />
      <FeatureRail local={local} accent={scene.accent} items={railItems} />
    </>
  );
}

function MotionScene({ scene }: { scene: Scene }) {
  const { local, opacity, progress } = useSceneMotion(scene);
  const wipe = mapRange(local, [0, 22], [-110, 110]);
  const glowX = mapRange(progress, [0, 1], [-120, 120]);

  return (
    <Sequence from={scene.from} durationInFrames={scene.duration}>
      <AbsoluteFill style={{ opacity }}>
        <div className="motion-scene">
          <div className="grid-field" />
          <div className="orb orb-a" style={{ background: scene.accent, transform: `translateX(${glowX}px)` }} />
          <div className="orb orb-b" />
          <div className="scan-wipe" style={{ transform: `translateX(${wipe}%)` }} />
          <TextBlock scene={scene} local={local} />
          <SceneVisual scene={scene} local={local} />
          <div className="scene-progress">
            <span style={{ width: `${progress * 100}%`, background: scene.accent }} />
          </div>
        </div>
      </AbsoluteFill>
    </Sequence>
  );
}

function CueStrip() {
  const frame = useCurrentFrame();
  const active = scenes.find((scene) => frame >= scene.from && frame < scene.from + scene.duration) ?? scenes[0];

  return (
    <div className="cue-strip">
      <div className="cue-left">
        <span>VOICEOVER TEXT</span>
        <strong>{active.cue}</strong>
      </div>
      <div className="cue-right">
        <span>SFX NOTE</span>
        <strong>{active.sfx}</strong>
      </div>
    </div>
  );
}

function StoryVideo({ showCueStrip }: { showCueStrip: boolean }) {
  return (
    <AbsoluteFill className="canvas">
      <div className="crop-area">
        {scenes.map((scene) => (
          <MotionScene scene={scene} key={`${scene.from}-${scene.kind}`} />
        ))}
      </div>
      {showCueStrip ? <CueStrip /> : null}
    </AbsoluteFill>
  );
}

export const ErpmLmsStory = () => <StoryVideo showCueStrip />;

export const ErpmLmsStoryClean = () => <StoryVideo showCueStrip={false} />;
