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

type ShotKey =
  | "register"
  | "dashboard"
  | "qbank"
  | "courses"
  | "lessons"
  | "results"
  | "landing";

type Scene = {
  from: number;
  duration: number;
  shot: ShotKey;
  kicker: string;
  title: string;
  detail: string;
  cue: string;
  sfx: string;
  mode?: "phone" | "wide" | "split";
  accent?: string;
};

const shots: Record<ShotKey, string> = {
  register: "screenshots/fresh-00-register.png",
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
    shot: "dashboard",
    kicker: "Project intro",
    title: "ERPM Medical LMS",
    detail: "A premium learning app built for focused medical revision.",
    cue: "VO: This is ERPM Medical LMS, a clean study hub for medical students.",
    sfx: "SFX: soft riser, light whoosh on title.",
    accent: "#60a5fa",
  },
  {
    from: 105,
    duration: 120,
    shot: "dashboard",
    kicker: "Daily focus",
    title: "Start from the next best move",
    detail: "Dashboard, streaks, quick actions, and the next lesson in one flow.",
    cue: "VO: The dashboard brings the next study move, progress, and quick actions together.",
    sfx: "SFX: subtle click, card lift.",
    accent: "#8b5cf6",
  },
  {
    from: 225,
    duration: 120,
    shot: "courses",
    kicker: "Structured library",
    title: "Courses stay clear and visual",
    detail: "Students can scan subjects, lesson counts, and readiness instantly.",
    cue: "VO: Courses are organized by subject, with progress and readiness visible at a glance.",
    sfx: "SFX: whoosh transition.",
    accent: "#22c55e",
  },
  {
    from: 345,
    duration: 120,
    shot: "qbank",
    kicker: "Question bank",
    title: "Practice sets without clutter",
    detail: "Q-Bank groups exams by course so revision feels direct and calm.",
    cue: "VO: The Q-Bank keeps practice sets easy to find, so revision starts faster.",
    sfx: "SFX: fast swipe, small tap.",
    accent: "#38bdf8",
  },
  {
    from: 465,
    duration: 120,
    shot: "lessons",
    kicker: "Lesson notes",
    title: "Lessons designed for mobile study",
    detail: "Clinical notes are easy to browse from the same student app shell.",
    cue: "VO: Lesson notes are built for focused mobile study, not messy scrolling.",
    sfx: "SFX: page turn.",
    accent: "#a78bfa",
  },
  {
    from: 585,
    duration: 120,
    shot: "results",
    kicker: "Performance",
    title: "Results make progress visible",
    detail: "Attempts, averages, history, and review status live in one place.",
    cue: "VO: Results help students understand performance and build a study loop.",
    sfx: "SFX: clean data pop.",
    accent: "#f472b6",
  },
  {
    from: 705,
    duration: 105,
    shot: "landing",
    kicker: "SaaS ready",
    title: "Built as a full product",
    detail: "Responsive web, student app surfaces, auth, content, and subscriptions.",
    cue: "VO: Behind the app is a full SaaS platform: onboarding, content, access, and growth.",
    sfx: "SFX: glitch flash, premium hit.",
    mode: "wide",
    accent: "#06b6d4",
  },
  {
    from: 810,
    duration: 90,
    shot: "dashboard",
    kicker: "Launch",
    title: "ERPM LMS is ready to show",
    detail: "A modern medical learning system with a polished student experience.",
    cue: "VO: ERPM LMS is the foundation for a premium medical learning experience.",
    sfx: "SFX: final whoosh, soft logo hit.",
    accent: "#2563eb",
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function SceneCard({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - scene.from;
  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 105 } });
  const exit = interpolate(local, [scene.duration - 18, scene.duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = clamp(local / scene.duration, 0, 1);
  const opacity = enter * exit;
  const y = interpolate(enter, [0, 1], [48, 0]);
  const zoom = scene.mode === "wide"
    ? interpolate(progress, [0, 1], [1.02, 1.1])
    : interpolate(progress, [0, 1], [1.02, 1.08]);
  const x = scene.mode === "wide"
    ? interpolate(progress, [0, 1], [-120, 40])
    : interpolate(progress, [0, 1], [18, -18]);

  return (
    <Sequence from={scene.from} durationInFrames={scene.duration}>
      <AbsoluteFill style={{ opacity }}>
        <div className="story-bg">
          <div className="story-aurora story-aurora-a" />
          <div className="story-aurora story-aurora-b" />
          <div className="phone-stage">
            <div
              className={scene.mode === "wide" ? "wide-frame" : "phone-frame"}
              style={{
                transform: `translate(${x}px, ${scene.mode === "wide" ? 222 : 100}px) scale(${zoom})`,
              }}
            >
              <Img src={staticFile(shots[scene.shot])} className="shot-img" />
            </div>
          </div>
          <div
            className="title-panel"
            style={{
              borderColor: `${scene.accent}55`,
              transform: `translateY(${y}px)`,
            }}
          >
            <div className="kicker" style={{ color: scene.accent }}>{scene.kicker}</div>
            <div className="headline">{scene.title}</div>
            <div className="detail">{scene.detail}</div>
          </div>
          <div className="timeline">
            <div className="timeline-bar" style={{ width: `${progress * 100}%`, background: scene.accent }} />
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
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="canvas">
      <div className="crop-area">
        {scenes.map((scene) => (
          <SceneCard scene={scene} key={`${scene.from}-${scene.title}`} />
        ))}
        <div className="brand-lockup" style={{ opacity: intro }}>
          <span>ERPM</span>
          <strong>Medical LMS</strong>
        </div>
      </div>
      {showCueStrip ? <CueStrip /> : null}
    </AbsoluteFill>
  );
}

export const ErpmLmsStory = () => <StoryVideo showCueStrip />;

export const ErpmLmsStoryClean = () => <StoryVideo showCueStrip={false} />;
