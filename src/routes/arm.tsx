import React, { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------
type Pose    = { x: number; y: number; z: number; pitch: number };
type ArmMode = "idle" | "joint" | "jog" | "trajectory";
type JogMode = "cartesian" | "relative";

const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000`;
const ARM_WS  = `${WS_BASE}/ws/connection/move`;

const IMG_STREAMS = [
  { key: "raw",    label: "Raw Camera",   url: `${WS_BASE}/ws/connection/img/raw`    },
  { key: "qr",     label: "QR Detection", url: `${WS_BASE}/ws/connection/img/qr`     },
  { key: "hazmat", label: "Hazmat",        url: `${WS_BASE}/ws/connection/img/hazmat` },
];

const ARM_MODES: ArmMode[] = ["idle", "joint", "jog", "trajectory"];
const JOG_MODES: JogMode[] = ["cartesian", "relative"];

const MODE_ACTIVE: Record<ArmMode, string> = {
  idle:       "bg-gray-500 text-white shadow-gray-900/40",
  joint:      "bg-blue-600 text-white shadow-blue-900/50",
  jog:        "bg-amber-500 text-white shadow-amber-900/50",
  trajectory: "bg-cyan-600 text-white shadow-cyan-900/50",
};
const MODE_TEXT: Record<ArmMode, string> = {
  idle: "text-gray-400", joint: "text-blue-400",
  jog: "text-amber-400", trajectory: "text-cyan-400",
};

const POSE_STEP: Record<keyof Pose, number> = { x: 0.01, y: 0.01, z: 0.01, pitch: 0.05 };
const POSE_UNIT: Record<keyof Pose, string> = { x: "m",  y: "m",  z: "m",  pitch: "rad" };
const JOG_SPEED       = 0.05;
const JOG_PITCH_SPEED = 0.1;

// ---------------------------------------------------------------
// HoldButton
// ---------------------------------------------------------------
function HoldButton({
  label, onPress, onRelease, className = "",
}: {
  label: React.ReactNode; onPress: () => void; onRelease: () => void; className?: string;
}) {
  return (
    <button
      className={`rounded-lg text-xs font-semibold transition select-none active:scale-95 ${className}`}
      onMouseDown={onPress}   onMouseUp={onRelease}
      onPointerDown={onPress} onPointerUp={onRelease}
      onMouseLeave={onRelease}
    >
      {label}
    </button>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${on ? "bg-green-400" : "bg-red-500"}`} />;
}

// ---------------------------------------------------------------
// Embedded Camera
// ---------------------------------------------------------------
function ArmCamera() {
  const [stream,    setStream]    = useState(IMG_STREAMS[0].key);
  const [frame,     setFrame]     = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [fps,       setFps]       = useState(0);
  const wsRef     = useRef<WebSocket | null>(null);
  const fpsRef    = useRef(0);
  const fpsTimer  = useRef<number | null>(null);
  const streamRef = useRef(stream);

  const connect = useCallback((key: string) => {
    wsRef.current?.close();
    const info = IMG_STREAMS.find((s) => s.key === key) ?? IMG_STREAMS[0];
    const ws   = new WebSocket(info.url);
    wsRef.current = ws;
    ws.onopen    = () => setConnected(true);
    ws.onclose   = () => { setConnected(false); setFrame(null); };
    ws.onerror   = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.data) { setFrame(`data:image/jpeg;base64,${msg.data}`); fpsRef.current++; }
      } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    connect(stream);
    fpsTimer.current = window.setInterval(() => { setFps(fpsRef.current); fpsRef.current = 0; }, 1000);
    return () => { wsRef.current?.close(); if (fpsTimer.current) clearInterval(fpsTimer.current); };
  }, []);

  const handleStream = (key: string) => {
    if (key === streamRef.current) return;
    streamRef.current = key;
    setStream(key);
    connect(key);
  };

  const info = IMG_STREAMS.find((s) => s.key === stream) ?? IMG_STREAMS[0];

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Dot on={connected} />
          <select
            value={stream}
            onChange={(e) => handleStream(e.target.value)}
            className="bg-gray-700 text-white text-xs rounded px-2 py-1 font-semibold outline-none"
          >
            {IMG_STREAMS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <span className="text-[10px] text-gray-500">{fps} FPS</span>
        </div>
      </div>
      <div className="flex-1 px-2 pb-2 min-h-0 overflow-hidden">
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
          {frame
            ? <img src={frame} alt="feed" className="max-w-full max-h-full object-contain" />
            : (
              <div className="text-gray-600 flex flex-col items-center gap-2 text-sm">
                <span className="text-3xl">📷</span>
                <span>{connected ? "Waiting for frames…" : "Disconnected"}</span>
              </div>
            )
          }
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] text-white font-semibold">
            {info.label}
          </div>
          {connected && fps > 0 && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] text-green-400 font-mono">
              {fps} FPS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// ArmPage
// ---------------------------------------------------------------
const ArmPage: React.FC = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [conn,    setConn]    = useState(false);
  const [pose,    setPose]    = useState<Pose>({ x: 0, y: 0, z: 0, pitch: 0 });
  const [target,  setTarget]  = useState<Pose>({ x: 0.15, y: 0.0, z: 0.35, pitch: 0.0 });
  const [armMode, setArmMode] = useState<ArmMode>("idle");
  const [jogMode, setJogMode] = useState<JogMode>("cartesian");

  const jogInterval = useRef<number | null>(null);
  const jogVel      = useRef({ vx: 0, vy: 0, vz: 0, vpitch: 0 });

  // --- WebSocket ---
  useEffect(() => {
    const ws = new WebSocket(ARM_WS);
    wsRef.current = ws;
    ws.onopen    = () => setConn(true);
    ws.onclose   = () => setConn(false);
    ws.onerror   = () => setConn(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "pose" && msg.data) {
          const { x, y, z, pitch } = msg.data;
          setPose({
            x:     +Number(x).toFixed(4),
            y:     +Number(y).toFixed(4),
            z:     +Number(z).toFixed(4),
            pitch: +Number(pitch).toFixed(4),
          });
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  const send = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  // --- Modes ---
  const handleSetMode = (m: ArmMode) => { setArmMode(m); send({ type: "set_mode", data: m }); };
  const handleJogMode = (m: JogMode) => { setJogMode(m); send({ type: "jog_mode", data: m }); };

  // --- Target ---
  const sendTarget    = () => send({ type: "arm_target", data: target });
  const adjustTarget  = (k: keyof Pose, sign: 1 | -1) =>
    setTarget((p) => ({ ...p, [k]: +(p[k] + sign * POSE_STEP[k]).toFixed(4) }));

  // --- Jog ---
  const startJog = (axis: keyof typeof jogVel.current, value: number) => {
    jogVel.current[axis] = value;
    if (!jogInterval.current) {
      jogInterval.current = window.setInterval(
        () => send({ type: "cmd_vel", data: { ...jogVel.current } }), 100,
      );
    }
  };
  const stopJog = (axis: keyof typeof jogVel.current) => {
    jogVel.current[axis] = 0;
    if (Object.values(jogVel.current).every((v) => v === 0) && jogInterval.current) {
      clearInterval(jogInterval.current);
      jogInterval.current = null;
      send({ type: "cmd_vel", data: { vx: 0, vy: 0, vz: 0, vpitch: 0 } });
    }
  };
  useEffect(() => () => { if (jogInterval.current) clearInterval(jogInterval.current); }, []);

  const jogEnabled = armMode === "jog";

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <div className="flex flex-col h-full w-full overflow-hidden gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Arm Control</h2>
          <Dot on={conn} />
          <span className="text-xs text-gray-400">{conn ? "Connected" : "Disconnected"}</span>
        </div>
        <div className="flex gap-1.5">
          {ARM_MODES.map((m) => (
            <button key={m} onClick={() => handleSetMode(m)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition shadow-lg
                ${armMode === m ? MODE_ACTIVE[m] : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* ── Main grid: Camera | Controls ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-3 min-h-0 overflow-hidden">

        {/* Camera */}
        <ArmCamera />

        {/* Right column */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">

          {/* Current Pose */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Current Pose</h3>
              <span className={`text-[10px] font-bold uppercase ${MODE_TEXT[armMode]}`}>{armMode}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["x","y","z","pitch"] as (keyof Pose)[]).map((k) => (
                <div key={k} className="bg-gray-900/60 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-500 uppercase">{k}</span>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-cyan-400">{pose[k].toFixed(4)}</span>
                    <span className="text-[9px] text-gray-600 ml-1">{POSE_UNIT[k]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target Pose */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Target Pose</h3>
              {armMode !== "trajectory" && (
                <span className="text-[10px] text-gray-600">requires trajectory mode</span>
              )}
            </div>
            <div className="space-y-2 mb-3">
              {(["x","y","z","pitch"] as (keyof Pose)[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="text-[11px] font-mono text-gray-400 uppercase w-10 flex-shrink-0">{k}</label>
                  <input
                    type="number" step={POSE_STEP[k]} value={target[k]}
                    onChange={(e) => setTarget((p) => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 bg-gray-700 text-white px-2 py-1.5 rounded-lg text-xs font-mono
                      border border-gray-600 focus:border-cyan-500 outline-none"
                  />
                  <button onClick={() => adjustTarget(k,  1)}
                    className="bg-gray-600 hover:bg-gray-500 text-white w-6 h-7 rounded text-xs transition">▲</button>
                  <button onClick={() => adjustTarget(k, -1)}
                    className="bg-gray-600 hover:bg-gray-500 text-white w-6 h-7 rounded text-xs transition">▼</button>
                </div>
              ))}
            </div>
            <button onClick={sendTarget} disabled={armMode !== "trajectory"}
              className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition
                ${armMode === "trajectory"
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
            >
              {armMode === "trajectory" ? "Send Target →" : "Set mode to Trajectory"}
            </button>
          </div>

          {/* Jog */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Jog</h3>
              <div className="flex gap-1">
                {JOG_MODES.map((m) => (
                  <button key={m} onClick={() => handleJogMode(m)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition
                      ${jogMode === m ? "bg-amber-500 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
                  >{m}</button>
                ))}
              </div>
            </div>

            <div className={`transition-opacity duration-200 ${jogEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
              {/* XY */}
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1.5">X / Y</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <div />
                <HoldButton label="Y +" className="py-3 bg-blue-700 hover:bg-blue-600 text-white"
                  onPress={() => startJog("vy",  JOG_SPEED)} onRelease={() => stopJog("vy")} />
                <div />
                <HoldButton label="X −" className="py-3 bg-gray-600 hover:bg-gray-500 text-white"
                  onPress={() => startJog("vx", -JOG_SPEED)} onRelease={() => stopJog("vx")} />
                <div className="flex items-center justify-center text-[9px] text-gray-600 font-mono bg-gray-900/50 rounded-lg">XY</div>
                <HoldButton label="X +" className="py-3 bg-gray-600 hover:bg-gray-500 text-white"
                  onPress={() => startJog("vx",  JOG_SPEED)} onRelease={() => stopJog("vx")} />
                <div />
                <HoldButton label="Y −" className="py-3 bg-blue-700 hover:bg-blue-600 text-white"
                  onPress={() => startJog("vy", -JOG_SPEED)} onRelease={() => stopJog("vy")} />
                <div />
              </div>

              {/* Z */}
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1.5">Z</p>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <HoldButton label="Z ▲" className="py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white"
                  onPress={() => startJog("vz",  JOG_SPEED)} onRelease={() => stopJog("vz")} />
                <HoldButton label="Z ▼" className="py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white"
                  onPress={() => startJog("vz", -JOG_SPEED)} onRelease={() => stopJog("vz")} />
              </div>

              {/* Pitch */}
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1.5">Pitch</p>
              <div className="grid grid-cols-2 gap-1.5">
                <HoldButton label="Pitch +" className="py-2.5 bg-purple-700 hover:bg-purple-600 text-white"
                  onPress={() => startJog("vpitch",  JOG_PITCH_SPEED)} onRelease={() => stopJog("vpitch")} />
                <HoldButton label="Pitch −" className="py-2.5 bg-purple-700 hover:bg-purple-600 text-white"
                  onPress={() => startJog("vpitch", -JOG_PITCH_SPEED)} onRelease={() => stopJog("vpitch")} />
              </div>
            </div>

            {!jogEnabled && (
              <p className="text-[10px] text-center text-gray-600 mt-2">
                Switch to <span className="text-amber-500 font-bold">Jog</span> mode to enable
              </p>
            )}
          </div>

          {/* Gripper */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Gripper</h3>
            <div className="grid grid-cols-2 gap-2">
              <HoldButton label="Open"
                className="py-3 bg-cyan-700 hover:bg-cyan-600 text-white"
                onPress={() => send({ type: "gripper", data:  1.0 })}
                onRelease={() => send({ type: "gripper", data:  0.0 })} />
              <HoldButton label="Close"
                className="py-3 bg-gray-600 hover:bg-gray-500 text-white"
                onPress={() => send({ type: "gripper", data: -1.0 })}
                onRelease={() => send({ type: "gripper", data:  0.0 })} />
            </div>
          </div>

          {/* Status footer */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 px-4 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
              <span className="text-gray-500">Arm mode</span>
              <span className={`font-bold uppercase ${MODE_TEXT[armMode]}`}>{armMode}</span>
              <span className="text-gray-500">Jog mode</span>
              <span className="text-amber-300 font-bold uppercase">{jogMode}</span>
              <span className="text-gray-500">Pose X / Y</span>
              <span className="text-cyan-400">{pose.x.toFixed(3)} / {pose.y.toFixed(3)} m</span>
              <span className="text-gray-500">Pose Z / Pitch</span>
              <span className="text-cyan-400">{pose.z.toFixed(3)} m / {pose.pitch.toFixed(3)} rad</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ArmPage;