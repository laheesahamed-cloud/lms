export default function AmbientGlow() {
  return (
    <>
      {/* Main blue glow */}
      <div className="pointer-events-none absolute top-[-160px] left-[8%] h-[520px] w-[720px] rounded-full bg-sky-500/10 blur-[160px]" />

      {/* Soft right blue glow */}
      <div className="pointer-events-none absolute top-[18%] right-[-160px] h-[420px] w-[460px] rounded-full bg-blue-500/8 blur-[150px]" />

      {/* Soft bottom glow */}
      <div className="pointer-events-none absolute bottom-[-150px] left-[28%] h-[360px] w-[520px] rounded-full bg-cyan-400/7 blur-[150px]" />
    </>
  );
}
