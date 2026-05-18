import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Tooltip, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------
const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000`;
const LAB_WS  = `${WS_BASE}/ws/connection/lab`;

const IMG_STREAMS = [
  { key: "raw",    label: "Raw Camera",   url: `${WS_BASE}/ws/connection/img/raw`    },
  { key: "qr",     label: "QR Detection", url: `${WS_BASE}/ws/connection/img/qr`     },
  { key: "hazmat", label: "Hazmat",        url: `${WS_BASE}/ws/connection/img/hazmat` },
];

const MAX_POINTS = 60;

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
type NumSeries = { values: number[]; current: number };

// ---------------------------------------------------------------
// MiniChart — para temperatura y humedad
// ---------------------------------------------------------------
function MiniChart({
  values, color, bgColor,
}: { values: number[]; color: string; bgColor: string }) {
  const labels = values.map((_, i) => {
    const s = values.length - 1 - i;
    return s === 0 ? "now" : i % 10 === 0 ? `-${s}s` : "";
  });

  return (
    <div style={{ height: 90 }}>
      <Line
        data={{
          labels,
          datasets: [{
            data: values,
            borderColor: color,
            backgroundColor: bgColor,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.35,
            fill: true,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { ticks: { color: "#4b5563", font: { size: 8 } }, grid: { color: "rgba(75,85,99,0.15)" } },
          },
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// NumCard — temperatura o humedad
// ---------------------------------------------------------------
function NumCard({
  label, emoji, value, unit, color, bgColor, barColor,
  series, min, max,
}: {
  label: string; emoji: string; value: number; unit: string;
  color: string; bgColor: string; barColor: string;
  series: number[]; min: number; max: number;
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="text-sm font-bold">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-3xl font-mono font-bold" style={{ color }}>
            {value.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500 ml-1">{unit}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 font-mono -mt-2">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>

      {/* Sparkline */}
      <MiniChart values={series} color={color} bgColor={bgColor} />
    </div>
  );
}

// ---------------------------------------------------------------
// BoolCard — gas o campo magnético
// ---------------------------------------------------------------
function BoolCard({
  label, emoji, detected,
  activeColor, activeBg, activeBorder,
  activeLabel, inactiveLabel,
}: {
  label: string; emoji: string; detected: boolean;
  activeColor: string; activeBg: string; activeBorder: string;
  activeLabel: string; inactiveLabel: string;
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300
      ${detected ? `${activeBg} ${activeBorder} shadow-lg` : "bg-gray-800 border-gray-700"}`}
    >
      <span className={`text-4xl transition-all duration-300 ${detected ? "scale-110" : "opacity-30 scale-90"}`}>
        {emoji}
      </span>

      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
        <p className={`text-lg font-bold transition-colors duration-300 ${detected ? activeColor : "text-gray-600"}`}>
          {detected ? activeLabel : inactiveLabel}
        </p>
      </div>

      {/* Pulso animado cuando activo */}
      {detected && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: activeBorder.replace("border-", "").replace("-500", ""),
                animation: `sensor-pulse 1s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes sensor-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50%       { opacity: 1;   transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------
// Embedded Camera
// ---------------------------------------------------------------
function SensorCamera() {
  const [stream,    setStream]    = useState(IMG_STREAMS[0].key);
  const [frame,     setFrame]     = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [fps,       setFps]       = useState(0);
  const wsRef     = useRef<WebSocket | null>(null);
  const fpsRef    = useRef(0);
  const fpsTimer  = useRef<number | null>(null);
  const streamRef = useRef(stream);

  const connect = (key: string) => {
    wsRef.current?.close();
    const info = IMG_STREAMS.find((s) => s.key === key)!;
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
  };

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
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
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
                <span>{connected ? "Waiting…" : "Disconnected"}</span>
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
// Main: SensorsPage
// ---------------------------------------------------------------
const SensorsPage: React.FC = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [conn,     setConn]     = useState(false);
  const [temp,     setTemp]     = useState<NumSeries>({ values: [], current: 0 });
  const [hum,      setHum]      = useState<NumSeries>({ values: [], current: 0 });
  const [gas,      setGas]      = useState(false);
  const [campoMag, setCampoMag] = useState(false);

  const pushSeries = (setter: React.Dispatch<React.SetStateAction<NumSeries>>, val: number) =>
    setter((prev) => {
      const next = [...prev.values, val];
      if (next.length > MAX_POINTS) next.shift();
      return { values: next, current: val };
    });

  useEffect(() => {
    const ws = new WebSocket(LAB_WS);
    wsRef.current = ws;
    ws.onopen    = () => setConn(true);
    ws.onclose   = () => setConn(false);
    ws.onerror   = () => setConn(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "sensor_data" && msg.data) {
          const { temperatura, humedad, gas: g, campo_mag } = msg.data;
          if (temperatura != null) pushSeries(setTemp, temperatura);
          if (humedad     != null) pushSeries(setHum,  humedad);
          if (g           != null) setGas(!!g);
          if (campo_mag   != null) setCampoMag(!!campo_mag);
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Sensors</h2>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${conn ? "bg-green-400" : "bg-red-500"}`} />
            <span className="text-xs text-gray-400">{conn ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
        {conn && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"
              style={{ animation: "sensor-pulse 1.5s ease-in-out infinite" }} />
            Live
          </div>
        )}
      </div>

      {/* Main grid: datos | cámara */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 min-h-0 overflow-hidden">

        {/* ===== LEFT: numéricos + booleans ===== */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">

          {/* Temperatura + Humedad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumCard
              label="Temperatura" emoji="🌡️"
              value={temp.current} unit="°C"
              color="#f97316" bgColor="rgba(249,115,22,0.12)" barColor="#f97316"
              series={temp.values} min={-10} max={60}
            />
            <NumCard
              label="Humedad" emoji="💧"
              value={hum.current} unit="%"
              color="#38bdf8" bgColor="rgba(56,189,248,0.12)" barColor="#38bdf8"
              series={hum.values} min={0} max={100}
            />
          </div>

          {/* Gas + Campo magnético */}
          <div className="grid grid-cols-2 gap-3">
            <BoolCard
              label="Gas" emoji="💨"
              detected={gas}
              activeColor="text-red-400"
              activeBg="bg-red-900/30"
              activeBorder="border-red-500"
              activeLabel="DETECTED"
              inactiveLabel="CLEAR"
            />
            <BoolCard
              label="Campo Magnético" emoji="🧲"
              detected={campoMag}
              activeColor="text-green-400"
              activeBg="bg-green-900/30"
              activeBorder="border-green-500"
              activeLabel="DETECTED"
              inactiveLabel="NONE"
            />
          </div>

          {/* Tabla de lecturas */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
              Last Readings
            </h3>
            <div className="space-y-2 text-xs font-mono">
              {[
                { label: "Temperatura", value: `${temp.current.toFixed(2)} °C`, color: "#f97316" },
                { label: "Humedad",     value: `${hum.current.toFixed(2)} %`,   color: "#38bdf8" },
                { label: "Gas",         value: gas      ? "DETECTED" : "CLEAR",    color: gas      ? "#f87171" : "#6b7280" },
                { label: "Campo Mag",   value: campoMag ? "DETECTED" : "NONE",     color: campoMag ? "#4ade80" : "#6b7280" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center bg-gray-900/50 rounded-lg px-3 py-2">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== RIGHT: cámara ===== */}
        <SensorCamera />
      </div>
    </div>
  );
};

export default SensorsPage;