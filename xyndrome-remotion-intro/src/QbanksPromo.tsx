import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const brand = {
  ink: "#0F172A",
  blue: "#3B82F6",
  cyan: "#06B6D4",
  violet: "#7C3AED",
  mint: "#14B8A6",
  soft: "#F8FAFC",
};

const lightMoodBackground =
  "radial-gradient(circle at 22% 18%, rgba(165,243,252,0.5), transparent 34%), radial-gradient(circle at 82% 72%, rgba(221,214,254,0.52), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #F8FCFF 48%, #F3F4FF 100%)";

const audioDurationSeconds = 25;
const timelineMap = [
  [0, 0],
  [2.499, 5.86],
  [3.673, 8.95],
  [5.922, 12.72],
  [6.897, 15.02],
  [8.496, 18.0],
  [10.095, 21.22],
  [11.22, 24.42],
  [12.769, 27.08],
  [14.418, 29.48],
  [15.968, 32.56],
  [18.117, 36.16],
  [20.016, 39.0],
  [20.791, 40.78],
  [21.865, 42.46],
  [22.915, 44.14],
  [23.464, 46.28],
  [23.989, 47.18],
  [audioDurationSeconds, 50.2],
] as const;

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const softPop = Easing.bezier(0.34, 1.56, 0.64, 1);

const progress = (
  frame: number,
  fps: number,
  start: number,
  end: number,
  easing: (input: number) => number = easeOut,
) =>
  interpolate(frame, [start * fps, end * fps], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const timelineTangents = timelineMap.map((point, index) => {
  if (index === 0) {
    const next = timelineMap[index + 1];
    return (next[1] - point[1]) / (next[0] - point[0]);
  }

  if (index === timelineMap.length - 1) {
    const previous = timelineMap[index - 1];
    return (point[1] - previous[1]) / (point[0] - previous[0]);
  }

  const previous = timelineMap[index - 1];
  const next = timelineMap[index + 1];
  const slopeBefore = (point[1] - previous[1]) / (point[0] - previous[0]);
  const slopeAfter = (next[1] - point[1]) / (next[0] - point[0]);

  return (slopeBefore + slopeAfter) / 2;
});

const cubicTimelineInterpolate = (
  local: number,
  outputStart: number,
  outputEnd: number,
  tangentStart: number,
  tangentEnd: number,
  inputDuration: number,
) => {
  const localSquared = local * local;
  const localCubed = localSquared * local;
  const h00 = 2 * localCubed - 3 * localSquared + 1;
  const h10 = localCubed - 2 * localSquared + local;
  const h01 = -2 * localCubed + 3 * localSquared;
  const h11 = localCubed - localSquared;
  const value =
    h00 * outputStart +
    h10 * inputDuration * tangentStart +
    h01 * outputEnd +
    h11 * inputDuration * tangentEnd;

  return clamp(value, outputStart, outputEnd);
};

const remapTimelineSeconds = (seconds: number) => {
  for (let index = 1; index < timelineMap.length; index++) {
    const [inputStart, outputStart] = timelineMap[index - 1];
    const [inputEnd, outputEnd] = timelineMap[index];

    if (seconds <= inputEnd) {
      const local = (seconds - inputStart) / (inputEnd - inputStart);

      return cubicTimelineInterpolate(
        local,
        outputStart,
        outputEnd,
        timelineTangents[index - 1],
        timelineTangents[index],
        inputEnd - inputStart,
      );
    }
  }

  return timelineMap[timelineMap.length - 1][1];
};

const remapTimelineFrame = (frame: number, fps: number) =>
  remapTimelineSeconds(frame / fps) * fps;

const message = "Q banks are an easier way to study";

export const QbanksPromo = () => {
  const sourceFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = remapTimelineFrame(sourceFrame, fps);

  const bubbleIn = progress(frame, fps, 0.12, 0.82, softPop);
  const questionIn = progress(frame, fps, 0.52, 0.96, softPop);
  const questionHide = progress(frame, fps, 1.55, 1.9, easeIn);
  const capsule = progress(frame, fps, 1.78, 2.65, easeOut);
  const textReveal = progress(frame, fps, 2.15, 2.65, easeInOut);
  const cardZoom = progress(frame, fps, 5.1, 5.92, Easing.in(Easing.cubic));
  const cardFade = 1 - progress(frame, fps, 5.75, 6.06, easeInOut);
  const firstSceneOpacity = 1 - progress(frame, fps, 5.86, 6.16, easeInOut);
  const darkSceneOpacity =
    progress(frame, fps, 6.08, 6.48, easeInOut) *
    (1 - progress(frame, fps, 8.55, 8.95, easeInOut));
  const answerSceneOpacity =
    progress(frame, fps, 8.75, 9.18, easeInOut) *
    (1 - progress(frame, fps, 12.45, 12.92, easeInOut));
  const phoneSceneOpacity =
    progress(frame, fps, 12.72, 13.12, easeInOut) *
    (1 - progress(frame, fps, 22.36, 22.68, easeInOut));
  const moreSceneOpacity =
    progress(frame, fps, 22.42, 22.82, easeInOut) *
    (1 - progress(frame, fps, 24.12, 24.42, easeInOut));
  const keypointsSceneOpacity =
    progress(frame, fps, 24.42, 24.84, easeInOut) *
    (1 - progress(frame, fps, 32.2, 32.56, easeInOut));
  const featureListSceneOpacity =
    progress(frame, fps, 32.56, 33.0, easeInOut) *
    (1 - progress(frame, fps, 38.84, 39.12, easeInOut));
  const meetSceneOpacity =
    progress(frame, fps, 39.0, 39.44, easeInOut) *
    (1 - progress(frame, fps, 46.0, 46.28, easeInOut));
  const logoSceneOpacity =
    progress(frame, fps, 46.28, 46.56, easeInOut) *
    (1 - progress(frame, fps, 47.04, 47.18, easeInOut));
  const instagramSceneOpacity = progress(frame, fps, 47.18, 47.48, easeInOut);

  const typedLength = Math.round(message.length * textReveal);
  const bubbleSize = interpolate(bubbleIn, [0, 1], [140, 332]);
  const capsuleWidth = interpolate(capsule, [0, 1], [bubbleSize, 1010]);
  const capsuleHeight = interpolate(capsule, [0, 1], [bubbleSize, 156]);
  const capsuleRadius = interpolate(capsule, [0, 1], [999, 78]);
  const questionScale = interpolate(questionIn - questionHide, [0, 1], [0.52, 1]);
  const questionOpacity = clamp(questionIn - questionHide);
  const cardScale = interpolate(bubbleIn, [0, 1], [0.86, 1]) *
    interpolate(cardZoom, [0, 1], [1, 8.5]);
  const cardTop = 738 + interpolate(cardZoom, [0, 1], [0, 144]);
  const cardOpacity = interpolate(bubbleIn, [0, 1], [0, 1]) * cardFade;

  return (
    <AbsoluteFill
      className="xy-video"
      style={{
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 22% 18%, rgba(165,243,252,0.5), transparent 34%), radial-gradient(circle at 82% 72%, rgba(221,214,254,0.52), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #F8FCFF 48%, #F3F4FF 100%)",
      }}
    >
      <AudioLayer fps={fps} />
      <WhiteBackground frame={frame} fps={fps} opacity={firstSceneOpacity} />
      <div
        style={{
          position: "absolute",
          top: cardTop,
          left: "50%",
          width: capsuleWidth,
          height: capsuleHeight,
          borderRadius: capsuleRadius,
          opacity: cardOpacity,
          transform: `translateX(-50%) scale(${cardScale})`,
          transformOrigin: "center",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.76), rgba(255,255,255,0.36))",
          border: "1.5px solid rgba(255, 255, 255, 0.92)",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -34px 70px rgba(59,130,246,0.08), 0 34px 90px rgba(59,130,246,0.18), 0 10px 32px rgba(15,23,42,0.06)",
          backdropFilter: "blur(22px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: "inherit",
            border: "1px solid rgba(255,255,255,0.72)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 28,
            left: interpolate(capsule, [0, 1], [50, 44]),
            width: interpolate(capsule, [0, 1], [72, 136]),
            height: 12,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.82), rgba(255,255,255,0))",
            opacity: interpolate(bubbleIn, [0, 1], [0, 0.9]),
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: brand.blue,
            fontSize: 176,
            lineHeight: 1,
            opacity: questionOpacity,
            transform: `translateY(${interpolate(questionHide, [0, 1], [0, 24])}px) scale(${questionScale})`,
            textShadow: "0 18px 38px rgba(59,130,246,0.18)",
          }}
        >
          ?
        </div>
        <div
          style={{
            position: "absolute",
            inset: "0 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: brand.ink,
            fontSize: 47,
            lineHeight: 1,
            textAlign: "center",
            whiteSpace: "nowrap",
            opacity: capsule,
            transform: `translateY(${interpolate(textReveal, [0, 1], [14, 0])}px)`,
          }}
        >
          {message.slice(0, typedLength)}
          <span
            style={{
              display: typedLength >= message.length ? "none" : "inline-block",
              width: 5,
              height: 62,
              marginLeft: 8,
              borderRadius: 999,
              background: brand.blue,
              opacity: interpolate(
                Math.sin((frame / fps) * Math.PI * 7),
                [-1, 1],
                [0.22, 0.82],
              ),
              verticalAlign: "-10px",
            }}
          />
        </div>
      </div>
      <DarkButScene frame={frame} fps={fps} opacity={darkSceneOpacity} />
      <AnswerStopScene frame={frame} fps={fps} opacity={answerSceneOpacity} />
      <IphoneOpenScene frame={frame} fps={fps} opacity={phoneSceneOpacity} />
      <MoreAddedScene frame={frame} fps={fps} opacity={moreSceneOpacity} />
      <KeypointsCardScene
        frame={frame}
        fps={fps}
        opacity={keypointsSceneOpacity}
      />
      <FeatureListScene
        frame={frame}
        fps={fps}
        opacity={featureListSceneOpacity}
      />
      <MeetQbankScene frame={frame} fps={fps} opacity={meetSceneOpacity} />
      <LogoRevealScene frame={frame} fps={fps} opacity={logoSceneOpacity} />
      <InstagramFollowScene
        frame={frame}
        fps={fps}
        opacity={instagramSceneOpacity}
      />
    </AbsoluteFill>
  );
};

const AudioLayer = ({ fps }: { fps: number }) => (
  <Audio
    src={staticFile("audio/qbanks-reference-v2-1x.wav")}
    trimBefore={0}
    trimAfter={Math.ceil(audioDurationSeconds * fps)}
    volume={(audioFrame) => {
      const seconds = audioFrame / fps;
      const fadeIn = interpolate(seconds, [0, 0.35], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(
        seconds,
        [audioDurationSeconds - 0.55, audioDurationSeconds],
        [1, 0],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
      const finalBreath = seconds > 22.6 ? 0.86 : 1;

      return 0.92 * fadeIn * fadeOut * finalBreath;
    }}
  />
);

const WhiteBackground = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const float = Math.sin((frame / fps) * 1.2);
  const dots = Array.from({ length: 18 }, (_, index) => index);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.028) 1px, transparent 1px)",
          backgroundSize: "76px 76px",
          opacity: 0.52,
          maskImage:
            "radial-gradient(circle at 50% 43%, rgba(0,0,0,0.86), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 370 + float * 16,
          left: 128,
          width: 220,
          height: 220,
          borderRadius: 999,
          background: "rgba(6,182,212,0.08)",
          filter: "blur(34px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 90,
          bottom: 520 - float * 18,
          width: 260,
          height: 260,
          borderRadius: 999,
          background: "rgba(124,58,237,0.08)",
          filter: "blur(38px)",
        }}
      />
      {dots.map((dot) => {
        const angle = dot * 0.78 + frame / fps * 0.08;
        const radius = 360 + (dot % 5) * 72;
        const dotOpacity = 0.08 + (dot % 4) * 0.035;

        return (
          <div
            key={dot}
            style={{
              position: "absolute",
              left: 540 + Math.cos(angle) * radius,
              top: 814 + Math.sin(angle) * radius * 0.82,
              width: 8 + (dot % 3) * 4,
              height: 8 + (dot % 3) * 4,
              borderRadius: 999,
              background: dot % 2 === 0 ? brand.cyan : brand.violet,
              opacity: dotOpacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const DarkButScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const rows = Array.from({ length: 15 }, (_, index) => index);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(circle at 50% 43%, #172033 0%, #080D18 48%, #030712 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.055), transparent 28%, rgba(59,130,246,0.045) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: 0.28,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -120,
          background:
            "radial-gradient(circle at 50% 46%, rgba(59,130,246,0.22), transparent 42%)",
          filter: "blur(18px)",
        }}
      />
      {rows.map((row) => {
        const speed = 36 + row * 2.2;
        const stagger = row * 46;
        const x = -180 - stagger - (frame / fps) * speed;
        const rowOpacity = 0.42 + (row % 4) * 0.055;

        return (
          <div
            key={row}
            style={{
              position: "absolute",
              top: -66 + row * 140,
              left: -420,
              width: 2600,
              opacity: rowOpacity,
              color: "#FFFFFF",
              fontSize: 104,
              lineHeight: 1,
              whiteSpace: "nowrap",
              transform: `translateX(${x}px)`,
              textShadow: "0 0 36px rgba(59,130,246,0.26)",
            }}
          >
            {"but ?    ".repeat(18)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const randomPhoneApps = [
  { label: "Calc", glyph: "+" },
  { label: "Notes", glyph: "-" },
  { label: "Mail", glyph: "@" },
  { label: "Files", glyph: "#" },
  { label: "Clock", glyph: ":" },
  { label: "Med", glyph: "+" },
  { label: "Cards", glyph: "Q" },
  { label: "Plan", glyph: "✓" },
];

const teachingConfetti = Array.from({ length: 18 }, (_, index) => ({
  x: -250 + index * 30,
  y: -18 - (index % 5) * 18,
  drift: -34 + (index % 7) * 12,
  size: 9 + (index % 4) * 4,
  color: ["#06B6D4", "#3B82F6", "#4F46E5"][index % 3],
}));

const sampleQuizAnswers = [
  "Mitral stenosis",
  "Aortic regurgitation",
  "Tricuspid stenosis",
  "Pulmonary stenosis",
  "Ventricular septal defect",
];

const AnswerStopScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const firstLine = progress(frame, fps, 9.05, 9.52, easeOut);
  const secondLine = progress(frame, fps, 9.46, 9.96, easeOut);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(circle at 24% 22%, rgba(165,243,252,0.48), transparent 34%), radial-gradient(circle at 76% 74%, rgba(221,214,254,0.54), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #F8FCFF 48%, #F3F4FF 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)",
          backgroundSize: "78px 78px",
          maskImage:
            "radial-gradient(circle at 50% 45%, rgba(0,0,0,0.9), transparent 72%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 960,
          transform: "translate(-50%, -50%)",
          color: brand.ink,
          fontSize: 66,
          lineHeight: 1.02,
          textAlign: "center",
          textShadow: "0 20px 42px rgba(59,130,246,0.14)",
        }}
      >
        <div
          style={{
            opacity: firstLine,
            transform: `translateX(${interpolate(firstLine, [0, 1], [220, 0])}px)`,
          }}
        >
          Most question banks stop
        </div>
        <div
          style={{
            marginTop: 8,
            opacity: secondLine,
            transform: `translateX(${interpolate(secondLine, [0, 1], [240, 0])}px)`,
          }}
        >
          when you choose an answer
        </div>
      </div>
    </AbsoluteFill>
  );
};

const IphoneOpenScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const phoneIn = progress(frame, fps, 12.82, 13.72, easeOut);
  const cursorIn = progress(frame, fps, 13.72, 14.18, easeOut);
  const cursorMove = progress(frame, fps, 14.12, 14.86, easeInOut);
  const click = progress(frame, fps, 14.86, 15.06, softPop);
  const appOpen = progress(frame, fps, 15.02, 16.12, easeOut);
  const phoneDown = progress(frame, fps, 15.76, 16.38, easeOut);
  const teachingText = progress(frame, fps, 16.12, 16.72, easeOut);
  const teachingExit = progress(frame, fps, 18.0, 18.34, Easing.in(Easing.cubic));
  const phonePlace = progress(frame, fps, 17.92, 19.08, easeInOut);
  const phoneScale = interpolate(phoneIn, [0, 1], [0.94, 1]);
  const phoneOpacity = opacity;
  const cursorX = interpolate(cursorMove, [0, 1], [286, -112]);
  const cursorY = interpolate(cursorMove, [0, 1], [575, 206]);
  const iconScale = interpolate(click, [0, 1], [1, 0.9]) *
    interpolate(appOpen, [0, 1], [1, 1.18]);
  const appScreenOpacity = progress(frame, fps, 15.22, 15.74, easeOut);
  const clickRing = progress(frame, fps, 14.82, 15.18, easeOut);
  const teachingBurst = progress(frame, fps, 16.08, 17.18, easeOut);
  const teachingHold = teachingText * (1 - teachingExit);
  const teachingSparkFade = 1 - teachingExit;
  const stopLine = progress(frame, fps, 19.02, 19.42, easeOut);
  const understandLine = progress(frame, fps, 19.42, 19.84, easeOut);
  const understandingBall = progress(frame, fps, 18.98, 20.75, easeInOut);
  const quizCardIn = progress(frame, fps, 18.1, 18.58, easeOut);
  const nextCursorIn = progress(frame, fps, 20.34, 20.74, easeOut);
  const nextCursorMove = progress(frame, fps, 20.58, 20.98, easeInOut);
  const nextTap = progress(frame, fps, 20.98, 21.24, easeInOut);
  const nextCursorOut = progress(frame, fps, 21.18, 21.44, easeInOut);
  const phoneCenterSpin = progress(frame, fps, 21.22, 22.34, easeInOut);
  const rightTextExit = 1 - progress(frame, fps, 21.08, 21.42, easeInOut);
  const ballJump = Math.abs(Math.sin(understandingBall * Math.PI * 4.5));
  const ballLineShift = understandingBall > 0.55 ? 82 : 0;
  const nextTapPulse = Math.sin(nextTap * Math.PI);
  const placedPhoneTop =
    interpolate(phoneIn, [0, 1], [1920, 430]) +
    interpolate(phoneDown, [0, 1], [0, 1065]) +
    interpolate(phonePlace, [0, 1], [0, -945]);
  const placedPhoneCenterX = interpolate(phonePlace, [0, 1], [540, 315]);
  const placedPhonePerspective = interpolate(phonePlace, [0, 1], [0, 10]);
  const phoneTop = interpolate(phoneCenterSpin, [0, 1], [placedPhoneTop, 520]);
  const phoneCenterX = interpolate(
    phoneCenterSpin,
    [0, 1],
    [placedPhoneCenterX, 540],
  );
  const phonePerspective = interpolate(
    phoneCenterSpin,
    [0, 1],
    [placedPhonePerspective, 0],
  );
  const phoneYRotation = interpolate(phoneCenterSpin, [0, 1], [0, 360]);
  const phoneSpinScale = interpolate(
    phoneCenterSpin,
    [0, 0.52, 1],
    [1, 1.06, 1],
  );
  const nextTapX = placedPhoneCenterX + 73;
  const nextTapY = placedPhoneTop + 644;
  const nextCursorX = interpolate(
    nextCursorMove,
    [0, 1],
    [760, nextTapX + 8],
  );
  const nextCursorY = interpolate(
    nextCursorMove,
    [0, 1],
    [1290, nextTapY - 8],
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          "radial-gradient(circle at 24% 20%, rgba(165,243,252,0.48), transparent 35%), radial-gradient(circle at 80% 76%, rgba(221,214,254,0.54), transparent 38%), linear-gradient(180deg, #FFFFFF 0%, #F8FCFF 50%, #F3F4FF 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: phoneCenterX,
          top: phoneTop,
          width: 430,
          height: 850,
          opacity: phoneOpacity,
          transform: `translateX(-50%) perspective(1200px) rotateY(${phonePerspective + phoneYRotation}deg) scale(${phoneScale * phoneSpinScale})`,
          transformOrigin: "50% 45%",
          borderRadius: 68,
          background: "#0B1220",
          boxShadow:
            "0 54px 130px rgba(37,99,235,0.24), 0 26px 80px rgba(15,23,42,0.18)",
          padding: 16,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 13,
            left: "50%",
            width: 126,
            height: 32,
            transform: "translateX(-50%)",
            borderRadius: 999,
            background: "#020617",
            zIndex: 8,
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: 54,
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 112,
              left: 32,
              right: 32,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridAutoRows: 126,
              justifyItems: "center",
              alignItems: "start",
              opacity: 1 - progress(frame, fps, 15.65, 15.95, easeInOut),
            }}
          >
          <div
            style={{
              width: 86,
              textAlign: "center",
              transform: `scale(${iconScale})`,
              transformOrigin: "50% 42%",
              zIndex: 4,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 6,
                left: "50%",
                width: interpolate(clickRing, [0, 1], [82, 132]),
                height: interpolate(clickRing, [0, 1], [82, 132]),
                borderRadius: 30,
                opacity: (1 - clickRing) * clickRing,
                transform: "translateX(-50%)",
                border: "3px solid rgba(37,99,235,0.34)",
                boxShadow: "0 0 42px rgba(37,99,235,0.16)",
              }}
            />
            <div
              style={{
                width: 78,
                height: 78,
                margin: "0 auto 9px",
                borderRadius: 22,
                border: "1.5px solid #CBD5E1",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px rgba(15,23,42,0.045)",
              }}
            >
              <Img
                src={staticFile("logo-mark-light.webp")}
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "contain",
                  filter: "drop-shadow(0 6px 10px rgba(37,99,235,0.12))",
                }}
              />
            </div>
            <div
              style={{
                color: brand.ink,
                fontSize: 13,
                lineHeight: 1,
              }}
            >
              xyndrome
            </div>
          </div>
          {randomPhoneApps.map((app) => (
            <div
              key={app.label}
              style={{
                width: 86,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 78,
                  height: 78,
                  margin: "0 auto 9px",
                  borderRadius: 22,
                  border: "1.5px solid #D1D5DB",
                  background: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748B",
                  fontSize: 28,
                  lineHeight: 1,
                  boxShadow: "0 10px 24px rgba(15,23,42,0.045)",
                }}
              >
                {app.glyph}
              </div>
              <div
                style={{
                  color: "#64748B",
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                {app.label}
              </div>
            </div>
          ))}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: appScreenOpacity,
              background: "#FFFFFF",
              zIndex: 5,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 88,
                left: 34,
                right: 34,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  border: "1.5px solid #CBD5E1",
                  background: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Img
                  src={staticFile("logo-mark-light.webp")}
                  style={{
                    width: 34,
                    height: 34,
                    objectFit: "contain",
                    filter: "drop-shadow(0 6px 10px rgba(37,99,235,0.12))",
                  }}
                />
              </div>
              <div>
                <div style={{ color: brand.ink, fontSize: 31, lineHeight: 1 }}>
                  xyndrome
                </div>
                <div style={{ color: "#64748B", fontSize: 17, marginTop: 8 }}>
                  Qbank
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 190,
                left: 34,
                right: 34,
                minHeight: 500,
                borderRadius: 32,
                opacity: quizCardIn,
                transform: `translateY(${interpolate(quizCardIn, [0, 1], [24, 0])}px)`,
                background: "#FFFFFF",
                border: "1px solid rgba(203,213,225,0.9)",
                boxShadow: "0 20px 48px rgba(37,99,235,0.08)",
                padding: 24,
              }}
            >
              <div
                style={{
                  color: "#2563EB",
                  fontSize: 16,
                  lineHeight: 1,
                  marginBottom: 16,
                }}
              >
                Cardiology · Single best answer
              </div>
              <div
                style={{
                  color: brand.ink,
                  fontSize: 21,
                  lineHeight: 1.2,
                  marginBottom: 18,
                }}
              >
                Which murmur is classically heard best at the apex?
              </div>
              {sampleQuizAnswers.map((answer, index) => (
                <div
                  key={answer}
                  style={{
                    height: 48,
                    marginTop: 10,
                    borderRadius: 18,
                    border:
                      index === 0
                        ? "1.5px solid rgba(6,182,212,0.55)"
                        : "1px solid #E2E8F0",
                    background:
                      index === 0
                        ? "rgba(6,182,212,0.08)"
                        : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0 14px",
                    color: index === 0 ? "#0F766E" : "#475569",
                    fontSize: 15,
                    lineHeight: 1,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: index === 0 ? "#06B6D4" : "#FFFFFF",
                      border: index === 0 ? "none" : "1px solid #CBD5E1",
                      color: index === 0 ? "#FFFFFF" : "#64748B",
                      fontSize: 13,
                    }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  {answer}
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 16,
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#475569",
                    fontSize: 15,
                  }}
                >
                  Check
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 16,
                    background: "linear-gradient(90deg, #06B6D4, #2563EB)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 15,
                    boxShadow: "0 12px 24px rgba(37,99,235,0.18)",
                    transform: `scale(${1 - nextTapPulse * 0.06})`,
                    transformOrigin: "50% 50%",
                  }}
                >
                  Next
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 58,
                right: 58,
                bottom: 44,
                height: 10,
                borderRadius: 999,
                background: "#E2E8F0",
              }}
            >
              <div
                style={{
                  width: `${interpolate(quizCardIn, [0, 1], [18, 62])}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #06B6D4, #2563EB)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: phoneCenterX + cursorX,
          top: phoneTop + cursorY,
          opacity: opacity * cursorIn * (1 - progress(frame, fps, 15.24, 15.52, easeInOut)),
          transform: `scale(${interpolate(click, [0, 1], [1, 0.82])})`,
          transformOrigin: "10px 10px",
          zIndex: 20,
        }}
      >
        <svg
          width="74"
          height="90"
          viewBox="0 0 74 90"
          style={{
            display: "block",
            filter: "drop-shadow(0 14px 22px rgba(15,23,42,0.28))",
          }}
        >
          <path
            d="M10 5L58 53L35 57L48 82L34 89L21 63L5 80L10 5Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M35 57L48 82L34 89L21 63"
            fill="#E2E8F0"
            stroke="#0F172A"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: nextTapX,
          top: nextTapY,
          width: interpolate(nextTap, [0, 1], [24, 86]),
          height: interpolate(nextTap, [0, 1], [24, 86]),
          borderRadius: 999,
          border: "3px solid rgba(6,182,212,0.34)",
          opacity: opacity * nextTapPulse * 0.9,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 42px rgba(37,99,235,0.22)",
          zIndex: 24,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: nextCursorX,
          top: nextCursorY,
          opacity: opacity * nextCursorIn * (1 - nextCursorOut),
          transform: `translate(-12px, -10px) scale(${interpolate(nextTap, [0, 1], [1, 0.9])}) rotate(-8deg)`,
          transformOrigin: "32px 12px",
          zIndex: 25,
        }}
      >
        <svg
          width="92"
          height="104"
          viewBox="0 0 92 104"
          style={{
            display: "block",
            filter: "drop-shadow(0 16px 24px rgba(15,23,42,0.24))",
          }}
        >
          <path
            d="M35 92C26 86 20 75 19 62L17 43C16 38 19 34 24 33C27 32 30 33 32 36L31 18C31 12 35 8 41 8C47 8 51 12 51 18V45L55 33C56 28 61 25 66 27C70 28 73 32 72 37L69 52L73 46C76 42 82 41 86 44C90 47 91 53 88 57L73 80C66 91 58 96 47 96C42 96 38 95 35 92Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M31 42V64M51 45V63M65 45L62 63"
            stroke="#CBD5E1"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M38 14C41 10 47 12 47 18V45"
            stroke="#F8FAFC"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          top: 640,
          left: "50%",
          width: 820,
          height: 150,
          opacity: opacity * teachingHold * teachingSparkFade,
          transform: `translateX(-50%) translateY(${interpolate(teachingExit, [0, 1], [0, -210])}px)`,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            width: 560,
            height: 96,
            borderRadius: 999,
            transform: `translateX(-50%) scale(${interpolate(teachingBurst, [0, 1], [0.72, 1])})`,
            background:
              "radial-gradient(circle, rgba(6,182,212,0.16), rgba(59,130,246,0.1) 44%, rgba(79,70,229,0.08) 62%, transparent 76%)",
            filter: "blur(12px)",
          }}
        />
        {teachingConfetti.map((piece, index) => {
          const floatIn = interpolate(teachingBurst, [0, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const loopTime = Math.max(0, frame / fps - 16.08);
          const orbit = loopTime * (1.8 + (index % 5) * 0.18) + index * 0.72;
          const loopX = Math.cos(orbit) * (14 + (index % 4) * 7);
          const loopY = Math.sin(orbit * 1.16) * (12 + (index % 3) * 8);
          const lift = Math.sin(loopTime * 3.2 + index) * 8;

          return (
            <div
              key={`${piece.color}-${index}`}
              style={{
                position: "absolute",
                left: 410 + piece.x + piece.drift * floatIn * 0.7 + loopX,
                top: 76 + piece.y * 0.42 + Math.sin(index * 1.7) * 28 - floatIn * (12 + (index % 4) * 5) + loopY + lift,
                width: piece.size,
                height: index % 3 === 0 ? piece.size : piece.size * 0.55,
                borderRadius: index % 3 === 0 ? 999 : 3,
                opacity: interpolate(floatIn, [0, 0.18, 1], [0, 1, 0.82]),
                background: piece.color,
                boxShadow: `0 0 22px ${piece.color}66`,
                transform: `rotate(${index * 23 + floatIn * 90 + loopTime * (70 + index * 4)}deg) scale(${1 + Math.sin(loopTime * 2.6 + index) * 0.08})`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 650,
          left: 116,
          right: 116,
          opacity: opacity * teachingHold,
          transform: `translateY(${interpolate(teachingText, [0, 1], [34, 0]) - interpolate(teachingExit, [0, 1], [0, 260])}px)`,
          fontSize: 64,
          lineHeight: 1.06,
          textAlign: "center",
          textWrap: "balance",
          textShadow: "0 22px 46px rgba(37,99,235,0.14)",
        }}
      >
        <span style={{ color: "#06B6D4" }}>xyndrome</span>{" "}
        <span style={{ color: "#2563EB" }}>starts</span>{" "}
        <span style={{ color: "#4F46E5" }}>teaching</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 555,
          width: 430,
          transform: "translateY(-50%)",
          opacity: opacity * rightTextExit,
          textAlign: "left",
          color: brand.ink,
          fontSize: 48,
          lineHeight: 1.1,
          textShadow: "0 20px 44px rgba(37,99,235,0.12)",
        }}
      >
        <div
          style={{
            opacity: stopLine,
            transform: `translateX(${interpolate(stopLine, [0, 1], [96, 0])}px)`,
          }}
        >
          Stop memorising.
        </div>
        <div
          style={{
            marginTop: 14,
            opacity: understandLine,
            color: "#2563EB",
            transform: `translateX(${interpolate(understandLine, [0, 1], [112, 0])}px)`,
          }}
        >
          Start understanding
        </div>
        <div
          style={{
            position: "absolute",
            left: interpolate(understandingBall, [0, 1], [4, 310]),
            top: 15 + ballLineShift * 0.72 - ballJump * 34,
            width: 28,
            height: 28,
            borderRadius: 999,
            opacity: Math.max(stopLine, understandLine) * rightTextExit,
            background: "rgba(6,182,212,0.78)",
            boxShadow:
              "0 0 30px rgba(6,182,212,0.46), 0 14px 34px rgba(37,99,235,0.18)",
            filter: "blur(3px)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const MoreAddedScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const textIn = progress(frame, fps, 22.74, 23.22, easeOut);
  const words = ["so", "we", "added", "more"];

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          justifyContent: "center",
          color: brand.ink,
          fontSize: 82,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: 0,
          textAlign: "center",
          textShadow: "0 24px 60px rgba(37,99,235,0.14)",
        }}
      >
        {words.map((word, index) => {
          const wordIn = progress(
            frame,
            fps,
            22.74 + index * 0.1,
            23.14 + index * 0.1,
            easeOut,
          );

          return (
            <span
              key={word}
              style={{
                display: "inline-block",
                opacity: textIn * wordIn,
                transform: `translateY(${interpolate(wordIn, [0, 1], [46, 0])}px) scale(${interpolate(wordIn, [0, 1], [0.92, 1])})`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const KeypointsCardScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const cardIn = progress(frame, fps, 24.58, 25.04, softPop);
  const expand = progress(frame, fps, 25.0, 25.82, easeOut);
  const titleIn = progress(frame, fps, 25.42, 25.84, easeOut);
  const shrink = progress(frame, fps, 26.34, 27.08, easeInOut);
  const detailIn = progress(frame, fps, 25.72, 26.18, easeOut);
  const rotateOut = progress(frame, fps, 27.08, 27.76, easeInOut);
  const firstCardFade = 1 - progress(frame, fps, 27.5, 27.78, easeInOut);
  const nextCardIn = progress(frame, fps, 27.42, 28.08, softPop);
  const nextDetailsIn = progress(frame, fps, 27.92, 28.42, easeOut);
  const nextCardOut = progress(frame, fps, 29.1, 29.78, easeInOut);
  const wrongCardIn = progress(frame, fps, 29.48, 30.18, softPop);
  const wrongTextIn = progress(frame, fps, 29.98, 30.62, easeOut);
  const cardWidth = interpolate(expand, [0, 1], [360, 820]) -
    interpolate(shrink, [0, 1], [0, 180]);
  const cardHeight = interpolate(expand, [0, 1], [150, 620]) -
    interpolate(shrink, [0, 1], [0, 300]);
  const cardRadius = interpolate(expand, [0, 1], [38, 54]) -
    interpolate(shrink, [0, 1], [0, 16]);
  const firstCardRotation = interpolate(rotateOut, [0, 1], [0, -82]);
  const firstCardX = interpolate(rotateOut, [0, 1], [0, -260]);
  const nextCardRotation = interpolate(nextCardIn, [0, 1], [76, 0]);
  const nextCardX = interpolate(nextCardIn, [0, 1], [260, 0]);
  const nextCardExitRotation = interpolate(nextCardOut, [0, 1], [0, -74]);
  const nextCardExitX = interpolate(nextCardOut, [0, 1], [0, -240]);
  const wrongCardRotation = interpolate(wrongCardIn, [0, 1], [72, 0]);
  const wrongCardX = interpolate(wrongCardIn, [0, 1], [250, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: cardWidth,
          height: cardHeight,
          borderRadius: cardRadius,
          opacity: cardIn * firstCardFade,
          transform: `perspective(1200px) translateX(${firstCardX}px) rotateY(${firstCardRotation}deg) scale(${interpolate(cardIn, [0, 1], [0.72, 1])}) translateY(${interpolate(cardIn, [0, 1], [38, 0])}px)`,
          transformOrigin: "50% 50%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,249,255,0.96))",
          border: "1.5px solid rgba(255,255,255,0.86)",
          boxShadow:
            "0 46px 120px rgba(6,182,212,0.22), 0 20px 70px rgba(79,70,229,0.16)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 24% 10%, rgba(165,243,252,0.5), transparent 34%), radial-gradient(circle at 86% 88%, rgba(199,210,254,0.58), transparent 40%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 48,
            right: 48,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
          }}
        >
          <div
            style={{
              color: brand.ink,
              fontSize: 64,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Key points
          </div>
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 24,
              background: "linear-gradient(135deg, #06B6D4, #4F46E5)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              lineHeight: 1,
              boxShadow: "0 18px 36px rgba(37,99,235,0.28)",
            }}
          >
            ✓
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            top: 168,
            opacity: detailIn * (1 - shrink * 0.9),
            transform: `translateY(${interpolate(detailIn, [0, 1], [30, 0])}px)`,
          }}
        >
          {["High-yield summary", "Why the answer is correct", "What to avoid next time"].map(
            (item, index) => (
              <div
                key={item}
                style={{
                  height: 78,
                  marginTop: index === 0 ? 0 : 20,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.74)",
                  border: "1px solid rgba(203,213,225,0.74)",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 24px",
                  color: index === 0 ? "#0F766E" : "#475569",
                  fontSize: 28,
                  lineHeight: 1,
                  boxShadow: "0 14px 30px rgba(15,23,42,0.04)",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: index === 0 ? "#06B6D4" : "#DBEAFE",
                    color: index === 0 ? "#FFFFFF" : "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  {index + 1}
                </span>
                {item}
              </div>
            ),
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 42,
            height: 10,
            borderRadius: 999,
            opacity: interpolate(shrink, [0, 1], [0, 1]),
            background: "#E2E8F0",
          }}
        >
          <div
            style={{
              width: "58%",
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #06B6D4, #4F46E5)",
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          width: interpolate(nextCardIn, [0, 1], [500, 720]),
          height: interpolate(nextCardIn, [0, 1], [220, 470]),
          borderRadius: interpolate(nextCardIn, [0, 1], [34, 48]),
          opacity: nextCardIn * (1 - progress(frame, fps, 29.5, 29.8, easeInOut)),
          transform: `perspective(1200px) translateX(${nextCardX + nextCardExitX}px) rotateY(${nextCardRotation + nextCardExitRotation}deg) scale(${interpolate(nextCardIn, [0, 1], [0.86, 1])})`,
          transformOrigin: "50% 50%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,243,255,0.96))",
          border: "1.5px solid rgba(255,255,255,0.88)",
          boxShadow:
            "0 48px 120px rgba(79,70,229,0.24), 0 18px 64px rgba(6,182,212,0.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 80% 12%, rgba(196,181,253,0.56), transparent 36%), radial-gradient(circle at 16% 86%, rgba(165,243,252,0.48), transparent 38%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 46,
            left: 48,
            right: 48,
          }}
        >
          <div
            style={{
              color: "#4F46E5",
              fontSize: 22,
              lineHeight: 1,
              marginBottom: 18,
            }}
          >
            After every question
          </div>
          <div
            style={{
              color: brand.ink,
              fontSize: 56,
              lineHeight: 1.04,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Clear explanations
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 27,
              lineHeight: 1.28,
              marginTop: 22,
              opacity: nextDetailsIn,
              transform: `translateY(${interpolate(nextDetailsIn, [0, 1], [22, 0])}px)`,
            }}
          >
            See why the answer works and what made the other choices tempting.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 42,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            opacity: nextDetailsIn,
            transform: `translateY(${interpolate(nextDetailsIn, [0, 1], [24, 0])}px)`,
          }}
        >
          {["Answer logic", "Exam traps"].map((label, index) => (
            <div
              key={label}
              style={{
                height: 74,
                borderRadius: 22,
                background: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(203,213,225,0.78)",
                color: index === 0 ? "#0F766E" : "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                lineHeight: 1,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          width: interpolate(wrongCardIn, [0, 1], [520, 790]),
          height: interpolate(wrongCardIn, [0, 1], [260, 560]),
          borderRadius: interpolate(wrongCardIn, [0, 1], [36, 52]),
          opacity: wrongCardIn,
          transform: `perspective(1200px) translateX(${wrongCardX}px) rotateY(${wrongCardRotation}deg) scale(${interpolate(wrongCardIn, [0, 1], [0.86, 1])})`,
          transformOrigin: "50% 50%",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,246,255,0.96))",
          border: "1.5px solid rgba(255,255,255,0.88)",
          boxShadow:
            "0 48px 120px rgba(6,182,212,0.2), 0 20px 76px rgba(79,70,229,0.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 12%, rgba(165,243,252,0.52), transparent 34%), radial-gradient(circle at 88% 86%, rgba(196,181,253,0.56), transparent 40%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 46,
            left: 50,
            right: 50,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 46,
              padding: "0 18px",
              borderRadius: 999,
              background: "rgba(6,182,212,0.12)",
              color: "#0891B2",
              fontSize: 21,
              lineHeight: 1,
              marginBottom: 22,
            }}
          >
            Tempting options
          </div>
          <div
            style={{
              color: brand.ink,
              fontSize: 54,
              lineHeight: 1.04,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Why other options are wrong
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 30,
              lineHeight: 1.26,
              marginTop: 26,
              opacity: wrongTextIn,
              transform: `translateY(${interpolate(wrongTextIn, [0, 1], [24, 0])}px)`,
            }}
          >
            When another option looks tempting, xyndrome shows why it is wrong too.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            bottom: 46,
            display: "grid",
            gap: 14,
            opacity: wrongTextIn,
            transform: `translateY(${interpolate(wrongTextIn, [0, 1], [26, 0])}px)`,
          }}
        >
          {[
            ["B", "Sounds close, but misses the key finding"],
            ["C", "Common trap answer explained clearly"],
          ].map(([letter, label], index) => (
            <div
              key={letter}
              style={{
                height: 74,
                borderRadius: 22,
                background: "rgba(255,255,255,0.76)",
                border: "1px solid rgba(203,213,225,0.78)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 20px",
                color: index === 0 ? "#0F766E" : "#4F46E5",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: index === 0 ? "#06B6D4" : "#DBEAFE",
                  color: index === 0 ? "#FFFFFF" : "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                {letter}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FeatureListScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const features = [
    {
      title: "Key points",
      body: "High-yield takeaways stay visible after every question.",
      color: "#06B6D4",
      soft: "rgba(6,182,212,0.12)",
    },
    {
      title: "Clear explanations",
      body: "Understand the answer logic, not just the correct letter.",
      color: "#4F46E5",
      soft: "rgba(79,70,229,0.12)",
    },
    {
      title: "Why other options are wrong",
      body: "See why tempting choices fail, so the mistake does not repeat.",
      color: "#14B8A6",
      soft: "rgba(20,184,166,0.12)",
    },
  ];
  const theoryTextIn = progress(frame, fps, 34.04, 34.52, easeOut);
  const theoryCardIn = progress(frame, fps, 34.48, 35.12, softPop);
  const theoryHandIn = progress(frame, fps, 35.22, 35.58, easeOut);
  const theoryHandMove = progress(frame, fps, 35.42, 35.92, easeInOut);
  const theoryTap = progress(frame, fps, 35.92, 36.18, easeInOut);
  const theoryHandOut = progress(frame, fps, 36.12, 36.36, easeInOut);
  const theoryExpand = progress(frame, fps, 36.16, 37.18, easeOut);
  const theoryCollapse = progress(frame, fps, 38.12, 38.92, easeInOut);
  const theoryTapPulse = Math.sin(theoryTap * Math.PI);
  const theoryOpen = theoryExpand * (1 - theoryCollapse);
  const theoryCardTop = interpolate(theoryOpen, [0, 1], [1345, 485]);
  const theoryCardHeight = interpolate(theoryOpen, [0, 1], [220, 1080]);
  const theoryHandX = interpolate(theoryHandMove, [0, 1], [980, 802]);
  const theoryHandY = interpolate(theoryHandMove, [0, 1], [1658, 1450]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 355,
          left: 110,
          right: 110,
          color: brand.ink,
          fontSize: 58,
          lineHeight: 1.06,
          fontWeight: 700,
          letterSpacing: 0,
          textAlign: "center",
          textShadow: "0 22px 58px rgba(37,99,235,0.12)",
        }}
      >
        Everything together
      </div>
      <div
        style={{
          position: "absolute",
          top: 485,
          left: "50%",
          width: 880,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {features.map((feature, index) => {
          const rowIn = progress(
            frame,
            fps,
            32.86 + index * 0.18,
            33.54 + index * 0.18,
            softPop,
          );
          const expand = progress(
            frame,
            fps,
            33.1 + index * 0.18,
            33.88 + index * 0.18,
            easeOut,
          );

          return (
            <div
              key={feature.title}
              style={{
                position: "relative",
                width: interpolate(expand, [0, 1], [560, 880]),
                height: interpolate(expand, [0, 1], [122, 220]),
                alignSelf: "center",
                borderRadius: interpolate(expand, [0, 1], [32, 42]),
                opacity: rowIn,
                transform: `translateY(${interpolate(rowIn, [0, 1], [54, 0])}px) scale(${interpolate(rowIn, [0, 1], [0.88, 1])})`,
                transformOrigin: "50% 50%",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))",
                border: "1.5px solid rgba(255,255,255,0.86)",
                boxShadow:
                  "0 36px 88px rgba(6,182,212,0.14), 0 18px 58px rgba(79,70,229,0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at 84% 10%, ${feature.soft}, transparent 36%)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 34,
                  left: 34,
                  width: 74,
                  height: 74,
                  borderRadius: 24,
                  background: feature.color,
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  lineHeight: 1,
                  boxShadow: `0 18px 34px ${feature.color}44`,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 38,
                  left: 132,
                  right: 34,
                  color: brand.ink,
                  fontSize: 38,
                  lineHeight: 1.05,
                  fontWeight: 700,
                  letterSpacing: 0,
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 132,
                  right: 42,
                  top: 102,
                  color: "#475569",
                  fontSize: 25,
                  lineHeight: 1.25,
                  opacity: expand,
                  transform: `translateY(${interpolate(expand, [0, 1], [18, 0])}px)`,
                }}
              >
                {feature.body}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1267,
          left: 90,
          right: 90,
          opacity: theoryTextIn,
          transform: `translateY(${interpolate(theoryTextIn, [0, 1], [28, 0])}px)`,
          color: brand.ink,
          fontSize: 48,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: 0,
          textAlign: "center",
          whiteSpace: "nowrap",
          textShadow: "0 22px 54px rgba(6,182,212,0.16)",
        }}
      >
        Wanna refresh the theory?
      </div>
      <div
        style={{
          position: "absolute",
          top: interpolate(theoryCardIn, [0, 1], [1379, theoryCardTop]),
          left: "50%",
          width: interpolate(theoryCardIn, [0, 1], [560, 880]),
          height: interpolate(theoryCardIn, [0, 1], [122, theoryCardHeight]),
          borderRadius: interpolate(theoryCardIn, [0, 1], [32, 42]),
          opacity: theoryCardIn,
          transform: `translateX(-50%) scale(${interpolate(theoryCardIn, [0, 1], [0.9, 1])})`,
          transformOrigin: "50% 100%",
          zIndex: 8,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,251,235,0.95))",
          border: "1.5px solid rgba(255,255,255,0.86)",
          boxShadow:
            "0 36px 88px rgba(245,158,11,0.16), 0 18px 58px rgba(79,70,229,0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 84% 10%, rgba(245,158,11,0.14), transparent 36%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 34,
            left: 34,
            width: 74,
            height: 74,
            borderRadius: 24,
            background: "linear-gradient(135deg, #F59E0B, #FACC15)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            lineHeight: 1,
            boxShadow: "0 18px 34px rgba(245,158,11,0.34)",
          }}
        >
          4
        </div>
        <div
          style={{
            position: "absolute",
            top: 38,
            left: 132,
            right: 34,
            color: brand.ink,
            fontSize: 38,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: 0,
          }}
        >
          Quick theory recap
        </div>
        <div
          style={{
            position: "absolute",
            top: 102,
            left: 132,
            right: 42,
            color: "#475569",
            fontSize: 25,
            lineHeight: 1.25,
            opacity: theoryCardIn,
            transform: `translateY(${interpolate(theoryCardIn, [0, 1], [18, 0])}px)`,
          }}
        >
          Jump back to the exact concept behind the question.
        </div>
        <div
          style={{
            position: "absolute",
            left: 74,
            right: 74,
            top: 238,
            opacity: interpolate(theoryOpen, [0, 0.32, 1], [0, 0, 1]),
            transform: `translateY(${interpolate(theoryOpen, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              color: brand.ink,
              fontSize: 44,
              lineHeight: 1.18,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Open the one-tap recap
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 27,
              lineHeight: 1.24,
              marginTop: 16,
            }}
          >
            Right beside the question, xyndrome breaks it into:
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
              marginTop: 36,
            }}
          >
            {[
              {
                label: "Causes",
                color: "#F59E0B",
                soft: "rgba(245,158,11,0.15)",
              },
              {
                label: "Mechanisms",
                color: "#06B6D4",
                soft: "rgba(6,182,212,0.14)",
              },
              {
                label: "Clinical features",
                color: "#4F46E5",
                soft: "rgba(79,70,229,0.13)",
              },
              {
                label: "Investigations",
                color: "#14B8A6",
                soft: "rgba(20,184,166,0.14)",
              },
              {
                label: "Treatment",
                color: "#2563EB",
                soft: "rgba(37,99,235,0.13)",
              },
              {
                label: "Mnemonics",
                color: "#D946EF",
                soft: "rgba(217,70,239,0.12)",
              },
              {
                label: "High-yield facts",
                color: "#EF4444",
                soft: "rgba(239,68,68,0.12)",
              },
            ].map((chip, index) => {
              const chipIn = progress(
                frame,
                fps,
                36.52 + index * 0.1,
                37.02 + index * 0.1,
                softPop,
              ) * (1 - theoryCollapse);

              return (
                <div
                  key={chip.label}
                  style={{
                    height: 84,
                    gridColumn: index === 6 ? "1 / span 2" : undefined,
                    borderRadius: 28,
                    background: `linear-gradient(135deg, ${chip.soft}, rgba(255,255,255,0.78))`,
                    border: `1.5px solid ${chip.color}33`,
                    color: brand.ink,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "0 24px",
                    fontSize: 27,
                    lineHeight: 1,
                    fontWeight: 700,
                    opacity: chipIn,
                    transform: `translateY(${interpolate(chipIn, [0, 1], [26, 0])}px) scale(${interpolate(chipIn, [0, 1], [0.9, 1])})`,
                    transformOrigin: "50% 50%",
                    boxShadow: `0 18px 34px ${chip.color}22`,
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      background: chip.color,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    {index + 1}
                  </span>
                  {chip.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 802,
          top: 1450,
          width: interpolate(theoryTap, [0, 1], [26, 96]),
          height: interpolate(theoryTap, [0, 1], [26, 96]),
          borderRadius: 999,
          border: "3px solid rgba(245,158,11,0.36)",
          opacity: opacity * theoryTapPulse * 0.9,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 44px rgba(245,158,11,0.24)",
          zIndex: 18,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: theoryHandX,
          top: theoryHandY,
          opacity: opacity * theoryHandIn * (1 - theoryHandOut),
          transform: `translate(-12px, -10px) scale(${interpolate(theoryTap, [0, 1], [1, 0.9])}) rotate(-8deg)`,
          transformOrigin: "32px 12px",
          zIndex: 20,
        }}
      >
        <svg
          width="92"
          height="104"
          viewBox="0 0 92 104"
          style={{
            display: "block",
            filter: "drop-shadow(0 16px 24px rgba(15,23,42,0.24))",
          }}
        >
          <path
            d="M35 92C26 86 20 75 19 62L17 43C16 38 19 34 24 33C27 32 30 33 32 36L31 18C31 12 35 8 41 8C47 8 51 12 51 18V45L55 33C56 28 61 25 66 27C70 28 73 32 72 37L69 52L73 46C76 42 82 41 86 44C90 47 91 53 88 57L73 80C66 91 58 96 47 96C42 96 38 95 35 92Z"
            fill="#FFFFFF"
            stroke="#0F172A"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M31 42V64M51 45V63M65 45L62 63"
            stroke="#CBD5E1"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M38 14C41 10 47 12 47 18V45"
            stroke="#F8FAFC"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

const MeetQbankScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const titleIn = progress(frame, fps, 39.22, 39.82, softPop);
  const subtitleIn = progress(frame, fps, 39.72, 40.16, easeOut);
  const ballRun = progress(frame, fps, 39.34, 40.32, easeInOut);
  const ballOpacity = 1 - progress(frame, fps, 40.12, 40.32, easeInOut);
  const ballJump = Math.abs(Math.sin(ballRun * Math.PI * 4));
  const wordColor =
    ballRun < 0.34 ? "#06B6D4" : ballRun < 0.68 ? "#2563EB" : "#4F46E5";
  const ballColor =
    ballRun < 0.5
      ? "linear-gradient(135deg, #67E8F9, #06B6D4)"
      : "linear-gradient(135deg, #60A5FA, #4F46E5)";
  const exclusiveIn = progress(frame, fps, 40.38, 40.78, easeOut);
  const audiences = [
    {
      label: "Sri Lankan Local Students",
      color: "#06B6D4",
      start: 40.78,
    },
    { label: "ERPM Students", color: "#4F46E5", start: 42.46 },
    { label: "KDU Students", color: "#14B8A6", start: 44.14 },
  ];

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 720,
          left: 84,
          right: 84,
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            color: brand.ink,
            fontSize: 74,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: 0,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [42, 0])}px) scale(${interpolate(titleIn, [0, 1], [0.92, 1])})`,
            textShadow: "0 28px 72px rgba(37,99,235,0.14)",
          }}
        >
          Meet{" "}
          <span
            style={{
              position: "relative",
              color: wordColor,
              display: "inline-block",
              textShadow: "0 22px 54px rgba(37,99,235,0.22)",
            }}
          >
            xyndrome
          </span>
          <div style={{ marginTop: 16 }}>Q-Bank.</div>
          <div
            style={{
              position: "absolute",
              left: interpolate(ballRun, [0, 1], [202, 552]),
              top: 2 - ballJump * 46,
              width: 30,
              height: 30,
              borderRadius: 999,
              opacity: titleIn * ballOpacity,
              background: ballColor,
              boxShadow:
                "0 0 32px rgba(6,182,212,0.42), 0 16px 34px rgba(79,70,229,0.18)",
              transform: `scale(${interpolate(ballRun, [0, 0.5, 1], [0.88, 1.12, 0.96])})`,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 30,
            color: "#475569",
            fontSize: 42,
            lineHeight: 1.14,
            fontWeight: 600,
            letterSpacing: 0,
            opacity: subtitleIn,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [30, 0])}px)`,
          }}
        >
          Learn the reason, not just the answer.
        </div>
        <div
          style={{
            marginTop: 152,
            opacity: exclusiveIn,
            transform: `translateY(${interpolate(exclusiveIn, [0, 1], [28, 0])}px)`,
          }}
        >
          <div
            style={{
              color: "#64748B",
              fontSize: 34,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            Exclusive for
          </div>
          <div
            style={{
              position: "relative",
              height: 92,
              marginTop: 26,
              overflow: "hidden",
            }}
          >
            {audiences.map((audience) => {
              const itemIn = progress(
                frame,
                fps,
                audience.start,
                audience.start + 0.56,
                softPop,
              );
              const itemOut = progress(
                frame,
                fps,
                audience.start + 1.36,
                audience.start + 1.66,
                easeInOut,
              );
              const itemOpacity = itemIn * (1 - itemOut);
              const rotateX =
                interpolate(itemIn, [0, 1], [-78, 0]) +
                interpolate(itemOut, [0, 1], [0, 78]);

              return (
                <div
                  key={audience.label}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: itemOpacity,
                    color: audience.color,
                    fontSize: 54,
                    lineHeight: 1,
                    fontWeight: 800,
                    letterSpacing: 0,
                    transform: `perspective(900px) rotateX(${rotateX}deg) translateY(${interpolate(itemIn, [0, 1], [-42, 0]) + interpolate(itemOut, [0, 1], [0, 42])}px)`,
                    transformOrigin: "50% 50%",
                    textShadow: `0 20px 48px ${audience.color}33`,
                  }}
                >
                  {audience.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LogoRevealScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const logoIn = progress(frame, fps, 46.34, 46.72, softPop);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 610,
          left: "50%",
          width: 520,
          height: 520,
          transform: `translateX(-50%) translateY(${interpolate(logoIn, [0, 1], [44, 0])}px) scale(${interpolate(logoIn, [0, 1], [0.82, 1])})`,
          opacity: logoIn,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile("logo-mark-light.webp")}
          style={{
            position: "relative",
            width: 420,
            height: 420,
            objectFit: "contain",
            filter: "drop-shadow(0 26px 54px rgba(37,99,235,0.18))",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const InstagramFollowScene = ({
  frame,
  fps,
  opacity,
}: {
  frame: number;
  fps: number;
  opacity: number;
}) => {
  const iconIn = progress(frame, fps, 47.18, 47.5, softPop);
  const followIn = progress(frame, fps, 47.9, 48.18, easeOut);
  const handleIn = progress(frame, fps, 48.75, 49.08, easeOut);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: lightMoodBackground,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 90,
          right: 90,
          transform: "translateY(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 190,
            height: 190,
            margin: "0 auto",
            borderRadius: 56,
            opacity: iconIn,
            transform: `translateY(${interpolate(iconIn, [0, 1], [42, 0])}px) scale(${interpolate(iconIn, [0, 1], [0.78, 1])})`,
            background:
              "radial-gradient(circle at 30% 110%, #FEDA75 0%, #FA7E1E 26%, transparent 42%), radial-gradient(circle at 10% 10%, #D62976 0%, #962FBF 45%, #4F5BD5 100%)",
            boxShadow:
              "0 38px 90px rgba(150,47,191,0.28), 0 20px 56px rgba(250,126,30,0.16)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 42,
              borderRadius: 34,
              border: "10px solid #FFFFFF",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 73,
              left: 73,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "10px solid #FFFFFF",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 54,
              right: 54,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#FFFFFF",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 62,
            color: brand.ink,
            fontSize: 70,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: 0,
            opacity: followIn,
            transform: `translateY(${interpolate(followIn, [0, 1], [34, 0])}px)`,
            textShadow: "0 28px 72px rgba(37,99,235,0.14)",
          }}
        >
          Follow for more
        </div>
        <div
          style={{
            marginTop: 28,
            color: "#4F46E5",
            fontSize: 56,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: 0,
            opacity: handleIn,
            transform: `translateY(${interpolate(handleIn, [0, 1], [30, 0])}px)`,
            textShadow: "0 24px 56px rgba(79,70,229,0.18)",
          }}
        >
          @xyndrome.med
        </div>
      </div>
    </AbsoluteFill>
  );
};
