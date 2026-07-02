import { Audio } from "@remotion/media";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const fps = 30;
export const introSkipSeconds = 5.8;
export const durationSeconds = 164;
export const durationInFrames = Math.round(durationSeconds * fps);

const palette = {
  ink: "#17212F",
  paper: "#FFF9EF",
  red: "#E35D5B",
  redDeep: "#B83A3A",
  blue: "#4D8FE8",
  blueDeep: "#2563A8",
  cyan: "#8FE5F4",
  green: "#55B884",
  yellow: "#F5C84C",
  violet: "#8D6AE8",
  plum: "#9B4D68",
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
const popEase = Easing.bezier(0.34, 1.56, 0.64, 1);

type Scene = {
  key: string;
  from: number;
  to: number;
  title: string;
  kicker: string;
  caption: string;
};

const scenes: Scene[] = [
  {
    key: "doorway",
    from: 0,
    to: 22,
    title: "The mitral valve is a doorway",
    kicker: "Normal: 4-6 cm2",
    caption:
      "In mitral stenosis, that doorway stiffens and narrows. Below 1 cm2 is severe.",
  },
  {
    key: "cause",
    from: 22,
    to: 42,
    title: "The usual cause starts years earlier",
    kicker: ">90% rheumatic",
    caption:
      "Untreated childhood strep throat can lead to rheumatic fever, then scarring of the valve.",
  },
  {
    key: "traffic",
    from: 42,
    to: 74,
    title: "Blood backs up behind the valve",
    kicker: "Pressure rises upstream",
    caption:
      "Left atrial pressure rises, the atrium stretches, lungs congest, and the right heart eventually struggles.",
  },
  {
    key: "exam",
    from: 74,
    to: 106,
    title: "The bedside clues are musical",
    kicker: "Loud S1 + opening snap + rumble",
    caption:
      "A shorter S2-to-snap interval means a tighter valve. Look for malar flush, then listen low and slow.",
  },
  {
    key: "echo",
    from: 106,
    to: 120,
    title: "Echo confirms the story",
    kicker: "Gold standard",
    caption:
      "Echocardiography shows the narrowed valve, the gradient, atrial size, and whether balloon therapy is possible.",
  },
  {
    key: "treat",
    from: 120,
    to: 152,
    title: "Treatment follows the pressure",
    kicker: "Slow, dry, anticoagulate, open",
    caption:
      "Beta-blocker, furosemide if congested, warfarin for AF, no DOACs in rheumatic MS, PTMC if flexible.",
  },
  {
    key: "recap",
    from: 152,
    to: 164,
    title: "Narrow valve. Rising pressure. Fibrillating atrium.",
    kicker: "The whole story clicks",
    caption:
      "Keep the left ventricle trap in mind: the LV usually stays normal because the blockage is before it.",
  },
];

const activeScene = (time: number) =>
  scenes.find((scene) => time >= scene.from && time < scene.to) ?? scenes[0];

const sec = (seconds: number) => seconds * fps;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const progress = (
  frame: number,
  start: number,
  end: number,
  easing: (input: number) => number = easeOut,
) =>
  interpolate(frame, [sec(start), sec(end)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

const lineDraw = (frame: number, start: number, end: number, length = 1000) =>
  length - progress(frame, start, end, easeInOut) * length;

const fadeStyle = (frame: number, start: number, end: number): CSSProperties => {
  const enter = progress(frame, start, start + 1.1);
  const exit = 1 - progress(frame, end - 0.8, end, Easing.in(Easing.cubic));
  const show = enter * exit;
  return {
    opacity: show,
    transform: `translateY(${interpolate(show, [0, 1], [28, 0])}px) scale(${interpolate(
      show,
      [0, 1],
      [0.98, 1],
    )})`,
  };
};

export const MitralStenosisExplainer = () => {
  const frame = useCurrentFrame();
  const { fps: currentFps } = useVideoConfig();
  const time = frame / currentFps;
  const scene = activeScene(time);

  return (
    <AbsoluteFill className="ms-video">
      <Audio
        src={staticFile("voiceover.mp3")}
        trimBefore={Math.round(introSkipSeconds * currentFps)}
        volume={(localFrame) =>
          interpolate(localFrame, [0, currentFps, durationInFrames - currentFps], [0, 1, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <PaperBackground frame={frame} />
      <TopBar frame={frame} scene={scene} />
      <ChapterRail frame={frame} time={time} />
      <SceneStage frame={frame} time={time} />
      <NarrationCard frame={frame} scene={scene} />
    </AbsoluteFill>
  );
};

const PaperBackground = ({ frame }: { frame: number }) => {
  const drift = Math.sin(frame / 90) * 10;
  return (
    <AbsoluteFill>
      <div className="ms-bg-wash" />
      <svg className="ms-bg-grid" viewBox="0 0 1920 1080" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <path
            key={`h-${index}`}
            d={`M0 ${80 + index * 58 + Math.sin(index) * 4} C 480 ${
              70 + index * 58 + drift
            }, 1220 ${92 + index * 58 - drift}, 1920 ${82 + index * 58}`}
          />
        ))}
        {Array.from({ length: 23 }).map((_, index) => (
          <path
            key={`v-${index}`}
            d={`M${80 + index * 82} 0 C ${72 + index * 82 + drift} 320, ${
              96 + index * 82 - drift
            } 740, ${82 + index * 82} 1080`}
          />
        ))}
      </svg>
      <div className="ms-vignette" />
    </AbsoluteFill>
  );
};

const TopBar = ({ frame, scene }: { frame: number; scene: Scene }) => {
  const chapterIndex = scenes.findIndex((item) => item.key === scene.key);
  const pulse = 1 + Math.sin(frame / 18) * 0.02;

  return (
    <div className="ms-top">
      <div className="ms-logo" style={{ transform: `scale(${pulse})` }}>
        <HeartGlyph frame={frame} small />
        <span>Mitral Stenosis</span>
      </div>
      <div className="ms-step">
        <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
        <b>{scene.kicker}</b>
      </div>
    </div>
  );
};

const ChapterRail = ({ frame, time }: { frame: number; time: number }) => {
  const total = scenes[scenes.length - 1].to;
  const fill = clamp(time / total);

  return (
    <div className="ms-rail">
      <div className="ms-rail-track">
        <div className="ms-rail-fill" style={{ width: `${fill * 100}%` }} />
      </div>
      {scenes.map((scene) => {
        const isActive = time >= scene.from && time < scene.to;
        const dot = isActive ? 1 + Math.sin(frame / 8) * 0.08 : 1;
        return (
          <div
            key={scene.key}
            className="ms-rail-dot"
            style={{
              left: `${(scene.from / total) * 100}%`,
              transform: `translate(-50%, -50%) scale(${dot})`,
              background: isActive ? palette.red : palette.paper,
            }}
          />
        );
      })}
    </div>
  );
};

const NarrationCard = ({ frame, scene }: { frame: number; scene: Scene }) => {
  const style = fadeStyle(frame, scene.from, scene.to);

  return (
    <div className="ms-caption" style={style}>
      <div className="ms-caption-kicker">{scene.kicker}</div>
      <h1>{scene.title}</h1>
      <p>{scene.caption}</p>
    </div>
  );
};

const SceneStage = ({ frame, time }: { frame: number; time: number }) => (
  <AbsoluteFill>
    <SceneLayer scene={scenes[0]} frame={frame}>
      <DoorwayScene frame={frame} />
    </SceneLayer>
    <SceneLayer scene={scenes[1]} frame={frame}>
      <CauseScene frame={frame} />
    </SceneLayer>
    <SceneLayer scene={scenes[2]} frame={frame}>
      <TrafficScene frame={frame} time={time} />
    </SceneLayer>
    <SceneLayer scene={scenes[3]} frame={frame}>
      <ExamScene frame={frame} />
    </SceneLayer>
    <SceneLayer scene={scenes[4]} frame={frame}>
      <EchoScene frame={frame} />
    </SceneLayer>
    <SceneLayer scene={scenes[5]} frame={frame}>
      <TreatmentScene frame={frame} />
    </SceneLayer>
    <SceneLayer scene={scenes[6]} frame={frame}>
      <RecapScene frame={frame} />
    </SceneLayer>
  </AbsoluteFill>
);

const SceneLayer = ({
  scene,
  frame,
  children,
}: {
  scene: Scene;
  frame: number;
  children: ReactNode;
}) => {
  const style = fadeStyle(frame, scene.from, scene.to);
  return (
    <div className="ms-scene" style={style}>
      {children}
    </div>
  );
};

const DoorwayScene = ({ frame }: { frame: number }) => {
  const normalOpen = progress(frame, 0.5, 4.2, easeInOut);
  const stenosed = progress(frame, 6, 13.5, easeInOut);
  const severity = progress(frame, 13, 19);
  const gap = interpolate(stenosed, [0, 1], [170, 44]);
  const blood = progress(frame, 7, 18, Easing.linear);

  return (
    <>
      <svg className="ms-main-diagram" viewBox="0 0 1120 720">
        <Chamber x={120} y={160} w={340} h={400} label="Left atrium" fill="#F9D8D5" />
        <Chamber x={660} y={160} w={340} h={400} label="Left ventricle" fill="#D7E9FF" />
        <path
          className="ms-blood-path"
          d="M210 360 C350 318, 480 305, 560 360 S780 407, 900 360"
          strokeDasharray="26 22"
          strokeDashoffset={-blood * 240}
        />
        <ValveLeaflet
          x={540}
          y={360}
          rotate={-42 + normalOpen * 24 + stenosed * 18}
          color={palette.red}
        />
        <ValveLeaflet
          x={580}
          y={360}
          rotate={42 - normalOpen * 24 - stenosed * 18}
          color={palette.red}
        />
        <rect
          x={560 - gap / 2}
          y={314}
          width={gap}
          height={92}
          rx={28}
          fill="rgba(255,249,239,0.72)"
          stroke={palette.ink}
          strokeWidth={5}
        />
        <text x={560} y={444} textAnchor="middle" className="ms-svg-small">
          valve opening
        </text>
        <AreaGauge x={126} y={76} label="4-6 cm2" active={1 - severity} />
        <AreaGauge x={740} y={600} label="<1 cm2 severe" active={severity} danger />
      </svg>
      <FloatingNote
        frame={frame}
        from={1}
        x={150}
        y={190}
        color={palette.green}
        text="Wide doorway: easy filling"
      />
      <FloatingNote
        frame={frame}
        from={9}
        x={1260}
        y={214}
        color={palette.red}
        text="Narrow doorway: flow bottleneck"
      />
    </>
  );
};

const CauseScene = ({ frame }: { frame: number }) => {
  const draw = progress(frame, 23, 34, easeInOut);
  const scar = progress(frame, 33, 40, easeInOut);

  return (
    <>
      <svg className="ms-main-diagram" viewBox="0 0 1120 720">
        <path
          className="ms-flow-line"
          d="M290 290 C350 190, 390 190, 420 220"
          strokeDasharray="1000"
          strokeDashoffset={lineDraw(frame, 24, 28)}
        />
        <path
          className="ms-flow-line"
          d="M590 220 C655 190, 700 205, 720 285"
          strokeDasharray="1000"
          strokeDashoffset={lineDraw(frame, 29, 33)}
        />
        <FlowNode x={120} y={215} title="Strep throat" detail="childhood" tone="yellow" />
        <FlowNode x={420} y={120} title="Rheumatic fever" detail="immune crossfire" tone="red" />
        <FlowNode x={720} y={215} title="Valve scarring" detail="years later" tone="plum" />
        <g transform="translate(420 410)">
          <HeartGlyphSvg scale={1.9} frame={frame} />
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2 + frame / 50;
            const r = 90 + Math.sin(frame / 12 + index) * 10;
            return (
              <circle
                key={index}
                cx={Math.cos(angle) * r}
                cy={Math.sin(angle) * r}
                r={8}
                fill={index % 2 ? palette.yellow : palette.red}
                opacity={draw}
              />
            );
          })}
        </g>
        <g opacity={scar} transform="translate(725 440)">
          <path d="M-95 -34 C-40 -80, 34 -75, 88 -25" className="ms-scar-line" />
          <path d="M-84 10 C-30 -28, 42 -34, 95 4" className="ms-scar-line" />
          <path d="M-58 48 C-18 20, 36 17, 66 46" className="ms-scar-line" />
        </g>
      </svg>
      <BigNumber frame={frame} from={26} value="9 in 10+" label="trace back to rheumatic fever" />
    </>
  );
};

const TrafficScene = ({ frame, time }: { frame: number; time: number }) => {
  const jam = progress(frame, 44, 58, easeInOut);
  const lungs = progress(frame, 52, 66, easeInOut);
  const rightHeart = progress(frame, 63, 72, easeInOut);
  const lvTrap = progress(frame, 68, 73, popEase);

  return (
    <>
      <svg className="ms-main-diagram" viewBox="0 0 1120 720">
        <LungPair x={96} y={170} active={lungs} />
        <HeartSystem x={460} y={165} frame={frame} jam={jam} rightHeart={rightHeart} />
        <PressureMeter x={420} y={560} value={jam} label="LA pressure" />
        <PressureMeter x={684} y={560} value={lungs} label="Lung pressure" />
        <PressureMeter x={948} y={560} value={rightHeart} label="RH workload" />
        <g opacity={lvTrap} transform="translate(760 430)">
          <rect x="-20" y="-26" width="240" height="86" rx="24" fill="#DDF6E8" stroke={palette.green} strokeWidth="5" />
          <text x="100" y="8" textAnchor="middle" className="ms-svg-label" fill={palette.green}>
            LV stays normal
          </text>
          <text x="100" y="36" textAnchor="middle" className="ms-svg-small">
            blockage is before it
          </text>
        </g>
      </svg>
      <TrafficDots frame={frame} jam={jam} />
      <FloatingNote
        frame={frame}
        from={time < 58 ? 44 : 58}
        x={1160}
        y={214}
        color={palette.red}
        text={time < 58 ? "Traffic jam at the valve" : "A stretched atrium loves AF"}
      />
    </>
  );
};

const ExamScene = ({ frame }: { frame: number }) => {
  const snap = progress(frame, 80, 96, Easing.linear);
  const severity = progress(frame, 92, 104, easeInOut);

  return (
    <>
      <svg className="ms-main-diagram" viewBox="0 0 1120 720">
        <Face x={105} y={96} flush={progress(frame, 75, 83)} />
        <Auscultation x={432} y={120} frame={frame} snap={snap} />
        <g transform="translate(430 560)">
          <text x="302" y="-52" textAnchor="middle" className="ms-svg-label">
            Severity clue
          </text>
          <line x1="0" y1="32" x2="610" y2="32" stroke={palette.ink} strokeWidth="7" strokeLinecap="round" />
          <SoundMarker x={80} label="S2" color={palette.blue} />
          <SoundMarker x={interpolate(severity, [0, 1], [430, 178])} label="snap" color={palette.red} />
          <text x="360" y="92" className="ms-svg-small">
            closer snap = tighter valve
          </text>
        </g>
      </svg>
      <FloatingNote frame={frame} from={82} x={1270} y={184} color={palette.violet} text="low rumbling mid-diastolic murmur" />
    </>
  );
};

const EchoScene = ({ frame }: { frame: number }) => {
  const sweep = progress(frame, 107, 119, Easing.linear);

  return (
    <svg className="ms-main-diagram" viewBox="0 0 1120 720">
      <g transform="translate(165 98)">
        <rect x="0" y="0" width="790" height="500" rx="42" fill="#122033" stroke={palette.ink} strokeWidth="8" />
        <rect x="36" y="36" width="718" height="428" rx="30" fill="#081522" stroke="#274766" strokeWidth="4" />
        <path
          d="M150 310 C270 160, 452 152, 584 318"
          fill="none"
          stroke={palette.cyan}
          strokeWidth="16"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          d="M254 316 C338 270, 428 268, 508 316"
          fill="none"
          stroke={palette.red}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={`M${90 + sweep * 610} 60 L${210 + sweep * 420} 445`}
          stroke="#D9FBFF"
          strokeWidth="5"
          opacity="0.75"
        />
        {Array.from({ length: 16 }).map((_, index) => (
          <path
            key={index}
            d={`M68 ${86 + index * 22} C 240 ${74 + index * 22 + Math.sin(frame / 14 + index) * 14}, 468 ${
              100 + index * 22
            }, 724 ${86 + index * 22}`}
            stroke="#264B63"
            strokeWidth="2"
            fill="none"
            opacity="0.55"
          />
        ))}
        <text x="58" y="82" fill="#D9FBFF" className="ms-monitor-text">
          ECHO: valve area + gradient + LA size
        </text>
      </g>
      <g transform="translate(700 520)">
        <rect x="0" y="0" width="285" height="102" rx="24" fill="#FFFFFF" stroke={palette.ink} strokeWidth="5" />
        <text x="142" y="42" textAnchor="middle" className="ms-svg-label" fill={palette.blueDeep}>
          Gold standard
        </text>
        <text x="142" y="74" textAnchor="middle" className="ms-svg-small">
          anatomy + severity
        </text>
      </g>
    </svg>
  );
};

const TreatmentScene = ({ frame }: { frame: number }) => {
  const balloon = progress(frame, 140, 151, easeInOut);

  return (
    <>
      <svg className="ms-main-diagram" viewBox="0 0 1120 720">
        <TreatmentCard x={72} y={120} delay={121} frame={frame} title="Beta-blocker" detail="slow heart rate" color={palette.blue} />
        <TreatmentCard x={360} y={120} delay={126} frame={frame} title="Furosemide" detail="clear fluid" color={palette.cyan} />
        <TreatmentCard x={648} y={120} delay={131} frame={frame} title="Warfarin" detail="AF = lifelong" color={palette.violet} />
        <TreatmentCard x={936} y={120} delay={136} frame={frame} title="No DOACs" detail="rheumatic MS" color={palette.red} crossed />
        <g transform="translate(285 445)">
          <path d="M0 52 H265" stroke={palette.ink} strokeWidth="8" strokeLinecap="round" />
          <rect x="245" y="14" width="110" height="76" rx="38" fill="#F9D8D5" stroke={palette.redDeep} strokeWidth="5" />
          <circle cx={300 + balloon * 115} cy="52" r={32 + balloon * 36} fill="#D9FBFF" stroke={palette.blue} strokeWidth="6" />
          <path
            d={`M365 52 C${426 + balloon * 90} ${10 + balloon * 8}, ${482 + balloon * 92} ${94 - balloon * 8}, ${
              540 + balloon * 114
            } 52`}
            fill="none"
            stroke={palette.redDeep}
            strokeWidth="9"
            strokeLinecap="round"
          />
          <text x="302" y="150" textAnchor="middle" className="ms-svg-label">
            PTMC balloon
          </text>
          <text x="302" y="184" textAnchor="middle" className="ms-svg-small">
            if the valve is soft and flexible
          </text>
        </g>
      </svg>
      <FloatingNote frame={frame} from={135} x={1240} y={720} color={palette.red} text="DOACs are a hard no in rheumatic MS" />
    </>
  );
};

const RecapScene = ({ frame }: { frame: number }) => {
  const draw = progress(frame, 153, 162, easeInOut);

  return (
    <svg className="ms-main-diagram" viewBox="0 0 1120 720">
      <g transform="translate(125 175)">
        <RecapNode x={0} y={0} title="Narrow valve" color={palette.red} active={draw} />
        <RecapNode x={315} y={0} title="Rising pressure" color={palette.yellow} active={draw} />
        <RecapNode x={630} y={0} title="Fibrillating atrium" color={palette.violet} active={draw} />
        <path className="ms-flow-line" d="M190 95 H302" strokeDasharray="1000" strokeDashoffset={1000 - draw * 1000} />
        <path className="ms-flow-line" d="M505 95 H617" strokeDasharray="1000" strokeDashoffset={1000 - draw * 1000} />
      </g>
      <g transform="translate(382 478)">
        <HeartGlyphSvg scale={2.25} frame={frame} />
        <path
          d="M-210 160 C-100 102, 96 102, 210 160"
          stroke={palette.green}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="1000"
          strokeDashoffset={1000 - draw * 1000}
        />
        <text x="0" y="224" textAnchor="middle" className="ms-svg-label" fill={palette.green}>
          story first, facts second
        </text>
      </g>
    </svg>
  );
};

const Chamber = ({
  x,
  y,
  w,
  h,
  label,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fill: string;
}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="130" fill={fill} stroke={palette.ink} strokeWidth="8" />
    <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" className="ms-svg-label">
      {label}
    </text>
  </g>
);

const ValveLeaflet = ({ x, y, rotate, color }: { x: number; y: number; rotate: number; color: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <path d="M-18 -132 C42 -94, 62 -30, 18 132 C-42 86, -62 20, -18 -132 Z" fill={color} stroke={palette.ink} strokeWidth="7" />
  </g>
);

const AreaGauge = ({
  x,
  y,
  label,
  active,
  danger = false,
}: {
  x: number;
  y: number;
  label: string;
  active: number;
  danger?: boolean;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width="260" height="58" rx="29" fill="#FFFFFF" stroke={palette.ink} strokeWidth="5" />
    <rect
      x="9"
      y="9"
      width={Math.max(22, 242 * active)}
      height="40"
      rx="20"
      fill={danger ? palette.red : palette.green}
      opacity="0.9"
    />
    <text x="130" y="38" textAnchor="middle" className="ms-svg-pill">
      {label}
    </text>
  </g>
);

const FloatingNote = ({
  frame,
  from,
  x,
  y,
  color,
  text,
}: {
  frame: number;
  from: number;
  x: number;
  y: number;
  color: string;
  text: string;
}) => {
  const show = progress(frame, from, from + 1.1, popEase);
  return (
    <div
      className="ms-floating-note"
      style={{
        left: x,
        top: y,
        borderColor: color,
        color,
        opacity: show,
        transform: `translateY(${interpolate(show, [0, 1], [28, 0])}px) rotate(-2deg)`,
      }}
    >
      {text}
    </div>
  );
};

const BigNumber = ({ frame, from, value, label }: { frame: number; from: number; value: string; label: string }) => {
  const show = progress(frame, from, from + 1.2, popEase);
  return (
    <div
      className="ms-big-number"
      style={{
        opacity: show,
        transform: `scale(${interpolate(show, [0, 1], [0.86, 1])}) rotate(2deg)`,
      }}
    >
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
};

const FlowNode = ({
  x,
  y,
  title,
  detail,
  tone,
}: {
  x: number;
  y: number;
  title: string;
  detail: string;
  tone: "yellow" | "red" | "plum";
}) => {
  const fill = tone === "yellow" ? "#FFF0B7" : tone === "red" ? "#F9D8D5" : "#ECDDF7";
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="230" height="150" rx="38" fill={fill} stroke={palette.ink} strokeWidth="7" />
      <text x="115" y="66" textAnchor="middle" className="ms-svg-node-title">
        {title}
      </text>
      <text x="115" y="104" textAnchor="middle" className="ms-svg-small">
        {detail}
      </text>
    </g>
  );
};

const HeartGlyph = ({ frame, small = false }: { frame: number; small?: boolean }) => (
  <svg width={small ? 48 : 84} height={small ? 48 : 84} viewBox="-80 -80 160 160" aria-hidden="true">
    <HeartGlyphSvg frame={frame} scale={small ? 0.52 : 1} />
  </svg>
);

const HeartGlyphSvg = ({ frame, scale = 1 }: { frame: number; scale?: number }) => {
  const beat = 1 + Math.max(0, Math.sin(frame / 11)) * 0.045;
  return (
    <g transform={`scale(${scale * beat})`}>
      <path
        d="M0 58 C-70 10, -70 -46, -28 -54 C-12 -58, -2 -48, 0 -35 C2 -48, 13 -58, 30 -54 C72 -44, 69 12, 0 58 Z"
        fill={palette.red}
        stroke={palette.ink}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M-20 -22 C-4 -4, -6 20, -20 38" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      <path d="M24 -20 C6 -4, 8 19, 22 36" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
    </g>
  );
};

const LungPair = ({ x, y, active }: { x: number; y: number; active: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M150 35 C45 70, 20 260, 95 330 C150 384, 230 292, 196 170 C178 103, 172 62, 150 35 Z" fill="#DDF6FF" stroke={palette.ink} strokeWidth="7" />
    <path d="M300 35 C405 70, 430 260, 355 330 C300 384, 220 292, 254 170 C272 103, 278 62, 300 35 Z" fill="#DDF6FF" stroke={palette.ink} strokeWidth="7" />
    <path d="M225 0 V170" stroke={palette.ink} strokeWidth="10" strokeLinecap="round" />
    {Array.from({ length: 10 }).map((_, index) => (
      <circle
        key={index}
        cx={80 + (index % 5) * 72}
        cy={158 + Math.floor(index / 5) * 72}
        r={12 + active * 10}
        fill={palette.blue}
        opacity={0.12 + active * 0.32}
      />
    ))}
  </g>
);

const HeartSystem = ({
  x,
  y,
  frame,
  jam,
  rightHeart,
}: {
  x: number;
  y: number;
  frame: number;
  jam: number;
  rightHeart: number;
}) => {
  const wobble = Math.sin(frame / 8) * jam * 5;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="90" width={220 + jam * 48} height={210 + jam * 30} rx="80" fill="#F9D8D5" stroke={palette.ink} strokeWidth="8" transform={`translate(${-jam * 24} ${-jam * 14 + wobble})`} />
      <rect x="245" y="112" width="205" height="195" rx="78" fill="#D7E9FF" stroke={palette.ink} strokeWidth="8" />
      <rect x="-145" y="146" width={120 + rightHeart * 44} height={160 + rightHeart * 32} rx="58" fill="#E8DDF5" stroke={palette.ink} strokeWidth="8" />
      <ValveLeaflet x={228} y={204} rotate={-12} color={palette.red} />
      <ValveLeaflet x={248} y={204} rotate={12} color={palette.red} />
      <text x="104" y="215" textAnchor="middle" className="ms-svg-small">
        LA stretches
      </text>
      <text x="350" y="215" textAnchor="middle" className="ms-svg-small">
        LV normal
      </text>
      <text x="-84" y="224" textAnchor="middle" className="ms-svg-small">
        RH strain
      </text>
    </g>
  );
};

const PressureMeter = ({ x, y, value, label }: { x: number; y: number; value: number; label: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width="218" height="90" rx="26" fill="#FFFFFF" stroke={palette.ink} strokeWidth="5" />
    <rect x="22" y="48" width="174" height="17" rx="9" fill="#F1E2D0" />
    <rect x="22" y="48" width={174 * value} height="17" rx="9" fill={palette.red} />
    <text x="109" y="32" textAnchor="middle" className="ms-svg-small">
      {label}
    </text>
  </g>
);

const TrafficDots = ({ frame, jam }: { frame: number; jam: number }) => (
  <div className="ms-traffic-dots">
    {Array.from({ length: 18 }).map((_, index) => {
      const lane = index % 3;
      const travel = ((frame * (0.7 - jam * 0.48) + index * 92) % 980) - 120;
      const x = 520 + travel * (1 - jam * 0.46);
      const stuck = 805 - index * 14;
      return (
        <span
          key={index}
          style={{
            left: interpolate(jam, [0, 1], [x, Math.max(570, stuck)]),
            top: 430 + lane * 28,
            background: lane === 1 ? palette.red : palette.yellow,
            transform: `scale(${1 + jam * 0.28})`,
          }}
        />
      );
    })}
  </div>
);

const Face = ({ x, y, flush }: { x: number; y: number; flush: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx="180" cy="200" r="142" fill="#FFE5C9" stroke={palette.ink} strokeWidth="8" />
    <circle cx="125" cy="210" r="38" fill={palette.plum} opacity={0.08 + flush * 0.42} />
    <circle cx="235" cy="210" r="38" fill={palette.plum} opacity={0.08 + flush * 0.42} />
    <circle cx="132" cy="170" r="10" fill={palette.ink} />
    <circle cx="228" cy="170" r="10" fill={palette.ink} />
    <path d="M140 260 C166 282, 204 282, 230 260" fill="none" stroke={palette.ink} strokeWidth="7" strokeLinecap="round" />
    <text x="180" y="340" textAnchor="middle" className="ms-svg-label">
      malar flush
    </text>
  </g>
);

const Auscultation = ({ x, y, frame, snap }: { x: number; y: number; frame: number; snap: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="0" width="520" height="330" rx="44" fill="#FFFFFF" stroke={palette.ink} strokeWidth="7" />
    <text x="260" y="62" textAnchor="middle" className="ms-svg-label">
      signature sound
    </text>
    <EcgWave x={55} y={162} width={410} frame={frame} />
    <SoundBubble x={80} y={242} label="loud S1" color={palette.blue} />
    <SoundBubble x={210 + snap * 65} y={242} label="snap" color={palette.red} />
    <SoundBubble x={360} y={242} label="rumble" color={palette.violet} />
  </g>
);

const EcgWave = ({ x, y, width, frame }: { x: number; y: number; width: number; frame: number }) => {
  const phase = (frame % 60) / 60;
  const d = Array.from({ length: 46 })
    .map((_, index) => {
      const px = x + (index / 45) * width;
      const spike = Math.max(0, 1 - Math.abs(((index / 45 + phase) % 0.28) - 0.14) / 0.035);
      const py = y - Math.sin(index * 0.8 + frame / 8) * 10 - spike * 72;
      return `${index === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(" ");
  return <path d={d} fill="none" stroke={palette.green} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />;
};

const SoundBubble = ({ x, y, label, color }: { x: number; y: number; label: string; color: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx="0" cy="0" r="44" fill={color} stroke={palette.ink} strokeWidth="5" />
    <text x="0" y="7" textAnchor="middle" className="ms-svg-bubble" fill="#fff">
      {label}
    </text>
  </g>
);

const SoundMarker = ({ x, label, color }: { x: number; label: string; color: string }) => (
  <g transform={`translate(${x} 32)`}>
    <line y1="-42" y2="42" stroke={color} strokeWidth="7" strokeLinecap="round" />
    <text y="-58" textAnchor="middle" className="ms-svg-small" fill={color}>
      {label}
    </text>
  </g>
);

const TreatmentCard = ({
  x,
  y,
  delay,
  frame,
  title,
  detail,
  color,
  crossed = false,
}: {
  x: number;
  y: number;
  delay: number;
  frame: number;
  title: string;
  detail: string;
  color: string;
  crossed?: boolean;
}) => {
  const show = progress(frame, delay, delay + 1.2, popEase);
  return (
    <g transform={`translate(${x} ${y}) scale(${interpolate(show, [0, 1], [0.86, 1])})`} opacity={show}>
      <rect x="0" y="0" width="212" height="182" rx="34" fill="#FFFFFF" stroke={palette.ink} strokeWidth="6" />
      <circle cx="106" cy="64" r="34" fill={color} opacity="0.92" />
      <text x="106" y="126" textAnchor="middle" className="ms-svg-card-title">
        {title}
      </text>
      <text x="106" y="156" textAnchor="middle" className="ms-svg-small">
        {detail}
      </text>
      {crossed && (
        <path d="M26 28 L186 154 M186 28 L26 154" stroke={palette.redDeep} strokeWidth="9" strokeLinecap="round" />
      )}
    </g>
  );
};

const RecapNode = ({
  x,
  y,
  title,
  color,
  active,
}: {
  x: number;
  y: number;
  title: string;
  color: string;
  active: number;
}) => (
  <g transform={`translate(${x} ${y}) scale(${interpolate(active, [0, 1], [0.92, 1])})`} opacity={active}>
    <rect width="190" height="190" rx="48" fill="#FFFFFF" stroke={palette.ink} strokeWidth="7" />
    <circle cx="95" cy="72" r="42" fill={color} opacity="0.9" />
    <text x="95" y="142" textAnchor="middle" className="ms-svg-label">
      {title}
    </text>
  </g>
);
