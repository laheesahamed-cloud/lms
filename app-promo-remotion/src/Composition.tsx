import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";

export const AUDIO_DURATION_IN_FRAMES = 502;

const sceneFrames = {
  hard: 50,
  easy: 41,
  intro: 42,
  logo: 34,
  courses: 81,
  cta: 53,
  trackLearn: 75,
  motivation: 36,
  audience: 58,
  instagram: 32,
};

type TextSceneProps = {
  animated?: boolean;
  background: string;
  color: string;
  fadeOnly?: boolean;
  text: string;
};

const courses = [
  {
    background: "#0a84ff",
    icon: "courses/medicine.svg",
    name: "Medicine",
  },
  {
    background: "#ff9f0a",
    icon: "courses/surgery.svg",
    name: "Surgery",
  },
  {
    background: "#30d158",
    icon: "courses/paediatrics.svg",
    name: "Paediatrics",
  },
  {
    background: "#ff2d55",
    icon: "courses/gyn-obs.svg",
    name: "Gyn & Obs",
  },
  {
    background: "#bf5af2",
    icon: "courses/psychiatry.svg",
    name: "Psychiatry",
  },
];

const TextScene: React.FC<TextSceneProps> = ({
  animated = true,
  background,
  color,
  fadeOnly = false,
  text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterEnd = 1.2 * fps;
  const progress = interpolate(frame, [0, enterEnd], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(progress, [0, 1], [-260, 0]);
  const baseY = interpolate(progress, [0, 1], [92, -24]);
  const arcLift = Math.sin(progress * Math.PI) * -96;
  const y = baseY + arcLift;

  const opacity = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="scene" style={{ background, color }}>
      <h1
        style={{
          opacity: animated || fadeOnly ? opacity : 1,
          transform:
            animated && !fadeOnly ? `translate(${x}px, ${y}px)` : undefined,
        }}
      >
        {text}
      </h1>
    </AbsoluteFill>
  );
};

const AllCoursesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = "All courses. One place";
  const visibleCharacters = Math.ceil(
    interpolate(frame, [0, 0.7 * fps], [0, title.length], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const titleOpacity = interpolate(frame, [0, 0.45 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleLift = interpolate(frame, [0.75 * fps, 1.15 * fps], [0, -285], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="course-scene">
      <div
        className="course-title-wrap"
        style={{
          opacity: titleOpacity,
          transform: `translateY(calc(-50% + ${titleLift}px))`,
        }}
      >
        <h1>{title.slice(0, visibleCharacters)}</h1>
      </div>
      <div className="course-grid">
        {courses.map((course, index) => {
          const start = (1.05 + index * 0.08) * fps;
          const progress = interpolate(
            frame,
            [start, start + 0.45 * fps],
            [0, 1],
            {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const opacity = interpolate(progress, [0, 1], [0, 1]);
          const y = interpolate(progress, [0, 1], [46, 0]);
          const scale = interpolate(progress, [0, 1], [0.96, 1]);

          return (
            <div
              className="course-card"
              key={course.name}
              style={
                {
                  "--card-bg": course.background,
                  opacity,
                  transform: `translateY(${y}px) scale(${scale})`,
                } as React.CSSProperties
              }
            >
              <Img className="course-icon" src={staticFile(course.icon)} />
              <span>{course.name}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], {
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [sceneFrames.logo - 8, sceneFrames.logo - 1], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(enter - exit, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale =
    interpolate(enter, [0, 0.75, 1], [0.88, 1.04, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) + exit * 0.12;
  const reveal = interpolate(enter, [0, 1], [42, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(enter - exit, [0, 0.35, 1], [0, 0.32, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringScale = interpolate(frame, [0, sceneFrames.logo - 1], [0.7, 1.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="scene scene--logo">
      <div
        className="logo-beat-ring"
        style={{
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
        }}
      />
      <Img
        className="brand-logo"
        src={staticFile("logo-full.png")}
        style={{
          clipPath: `inset(0 ${reveal}% 0 ${reveal}% round 18px)`,
          opacity,
          transform: `scale(${scale})`,
          translate: "-2px -119.8px",
        }}
      />
    </AbsoluteFill>
  );
};

const StartTodayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.35 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const buttonProgress = interpolate(frame, [0.25 * fps, 0.65 * fps], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorProgress = interpolate(frame, [0.75 * fps, 1.25 * fps], [0, 1], {
    easing: Easing.bezier(0.22, 1, 0.36, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clickProgress = interpolate(
    frame,
    [1.25 * fps, 1.36 * fps, 1.5 * fps],
    [0, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const buttonOpacity = interpolate(buttonProgress, [0, 1], [0, 1]);
  const buttonY = interpolate(buttonProgress, [0, 1], [34, 0]);
  const buttonScale = 1 - clickProgress * 0.045;
  const rippleOpacity = interpolate(clickProgress, [0, 0.25, 1], [0, 0.45, 0]);
  const rippleScale = interpolate(clickProgress, [0, 1], [0.35, 1.85]);
  const cursorX = interpolate(cursorProgress, [0, 1], [430, 150]);
  const cursorY = interpolate(cursorProgress, [0, 1], [250, 122]);
  const cursorScale = 1 - clickProgress * 0.1;

  return (
    <AbsoluteFill className="start-scene">
      <h1
        style={{
          opacity: titleOpacity,
        }}
      >
        Start today
      </h1>
      <button
        className="continue-button"
        style={{
          opacity: buttonOpacity,
          transform: `translateY(${buttonY}px) scale(${buttonScale})`,
        }}
      >
        <span
          className="click-ripple"
          style={{
            opacity: rippleOpacity,
            transform: `translate(-50%, -50%) scale(${rippleScale})`,
          }}
        />
        <span className="button-label">Continue learning</span>
      </button>
      <svg
        className="cursor"
        viewBox="0 0 52 68"
        style={{
          transform: `translate(${cursorX}px, ${cursorY}px) scale(${cursorScale})`,
        }}
        aria-hidden="true"
      >
        <path
          d="M9 5L44 39L27.2 41.4L36.4 61.2L28.5 65L19.4 45.1L7.2 56.7L9 5Z"
          fill="white"
        />
        <path
          d="M9 5L44 39L27.2 41.4L36.4 61.2L28.5 65L19.4 45.1L7.2 56.7L9 5Z"
          fill="none"
          stroke="rgba(15, 23, 42, 0.72)"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    </AbsoluteFill>
  );
};

const progressItems = [
  { color: "#06b6d4", label: "Medicine", value: 0.86 },
  { color: "#2563eb", label: "Surgery", value: 0.72 },
  { color: "#4f46e5", label: "Paediatrics", value: 0.64 },
  { color: "#14b8a6", label: "Daily streak", value: 0.92 },
];

const ProgressTrackingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0.1 * fps, 0.45 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleX = interpolate(frame, [0.1 * fps, 0.55 * fps], [70, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitProgress = interpolate(frame, [1.25 * fps, 1.65 * fps], [0, 1], {
    easing: Easing.bezier(0.7, 0, 0.84, 0),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const learnProgress = interpolate(frame, [1.65 * fps, 2.25 * fps], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const learnOpacity = interpolate(learnProgress, [0, 1], [0, 1]);
  const learnY = interpolate(learnProgress, [0, 1], [62, 0]);

  return (
    <AbsoluteFill className="progress-scene" style={{ display: "grid" }}>
      <div
        className="progress-layout"
        style={{
          opacity: 1 - exitProgress,
          transform: `translateY(${-360 * exitProgress}px)`,
        }}
      >
        <div className="progress-panel">
          {progressItems.map((item, index) => {
            const start = (0.15 + index * 0.1) * fps;
            const progress = interpolate(
              frame,
              [start, start + 0.8 * fps],
              [0, item.value],
              {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const itemOpacity = interpolate(
              frame,
              [start - 0.2 * fps, start + 0.25 * fps],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const percentage = Math.round(progress * 100);

            return (
              <div
                className="progress-row"
                key={item.label}
                style={{ opacity: itemOpacity }}
              >
                <div className="progress-meta">
                  <span>{item.label}</span>
                  <strong>{percentage}%</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      background: item.color,
                      width: `${progress * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <h1
          className="progress-title"
          style={{
            opacity: titleOpacity,
            transform: `translateX(${titleX}px)`,
          }}
        >
          Track every step.
        </h1>
      </div>
      <div
        className="learn-layout"
        style={{
          opacity: learnOpacity,
          transform: `translateY(${learnY}px)`,
        }}
      >
        <h1>Learn your way.</h1>
        <div className="learn-card-grid">
          <div className="learn-card video-card">
            <div className="learn-visual play-visual" />
            <span>Video lesson</span>
          </div>
          <div className="learn-card pdf-card">
            <div className="learn-visual pdf-visual">PDF</div>
            <span>PDF</span>
          </div>
          <div className="learn-card quiz-card">
            <div className="learn-visual quiz-visual">
              <i />
              <i />
              <i />
            </div>
            <span>Quiz</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MotivationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 0.55 * fps], [46, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="motivation-scene">
      <h1
        style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)` }}
      >
        Stay motivated
      </h1>
      <div className="motivation-grid">
        {[
          { className: "badge-visual", label: "Badges" },
          { className: "streak-visual", label: "Streak" },
          { className: "completion-visual", label: "Completion" },
        ].map((item, index) => {
          const start = (0.45 + index * 0.12) * fps;
          const progress = interpolate(
            frame,
            [start, start + 0.45 * fps],
            [0, 1],
            {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          );
          const opacity = interpolate(progress, [0, 1], [0, 1]);
          const y = interpolate(progress, [0, 1], [54, 0]);
          const scale = interpolate(progress, [0, 1], [0.94, 1]);

          return (
            <div
              className="motivation-card"
              key={item.label}
              style={{
                opacity,
                transform: `translateY(${y}px) scale(${scale})`,
              }}
            >
              <div className={`motivation-visual ${item.className}`}>
                {item.className === "badge-visual" && <span>★</span>}
                {item.className === "streak-visual" && <span>7</span>}
                {item.className === "completion-visual" && <span>✓</span>}
              </div>
              <strong>{item.label}</strong>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const InstagramEndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [0, 0.65 * fps], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [42, 0]);
  const scale = interpolate(progress, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill className="instagram-scene">
      <div
        className="instagram-lockup"
        style={{
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
        }}
      >
        <div className="instagram-logo">
          <div />
        </div>
        <span>@xyndrome.med</span>
      </div>
    </AbsoluteFill>
  );
};

const AudienceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audiences = [
    { label: "Sri Lankan Local", width: 560 },
    { label: "ERPM", width: 250 },
    { label: "KDU students", width: 430 },
  ];
  const forOpacity = interpolate(frame, [0, 0.25 * fps], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="audience-scene">
      <div className="audience-stack">
        <span className="audience-for" style={{ opacity: forOpacity }}>
          For
        </span>
        <div className="audience-pill-row">
          {audiences.map((audience, index) => {
            const start = (index * 0.34 + 0.05) * fps;
            const progress = interpolate(
              frame,
              [start, start + 0.38 * fps],
              [0, 1],
              {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            );
            const opacity = interpolate(progress, [0, 0.45, 1], [0, 1, 1]);
            const innerX = interpolate(progress, [0, 1], [54, 0]);
            const innerScale = interpolate(progress, [0, 1], [0.92, 1]);

            return (
              <div
                className="audience-pill-slot"
                key={audience.label}
                style={{
                  width: audience.width * progress,
                }}
              >
                <div
                  className="audience-pill"
                  style={{
                    opacity,
                    transform: `translateX(${innerX}px) scale(${innerScale})`,
                    width: audience.width,
                  }}
                >
                  {audience.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AppPromo = () => {
  return (
    <>
      <Audio src={staticFile("audio/promo-audio.mov")} />
      <Series>
        <Series.Sequence durationInFrames={sceneFrames.hard}>
          <TextScene
            background="#000"
            color="#fff"
            text="Learning feels hard?"
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.easy}>
          <TextScene
            background="#fff"
            color="#000"
            text="We'll make it a bit easy"
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.intro}>
          <TextScene
            animated={false}
            background="#000"
            color="#fff"
            text="Introducing"
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.logo}>
          <LogoScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.courses}>
          <AllCoursesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.cta}>
          <StartTodayScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.trackLearn}>
          <ProgressTrackingScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.motivation}>
          <MotivationScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.audience}>
          <AudienceScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sceneFrames.instagram}>
          <InstagramEndScene />
        </Series.Sequence>
      </Series>
    </>
  );
};
