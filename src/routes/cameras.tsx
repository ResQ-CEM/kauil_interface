import React, { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------
const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000`;

const IMG_STREAMS = [
  { key: "raw",    label: "Raw Camera",   url: `${WS_BASE}/ws/connection/img/raw`    },
  { key: "qr",     label: "QR Detection", url: `${WS_BASE}/ws/connection/img/qr`     },
  { key: "hazmat", label: "Hazmat",        url: `${WS_BASE}/ws/connection/img/hazmat` },
];

type CamPanel = { id: number; stream: string };

// ---------------------------------------------------------------
// CameraView
// ---------------------------------------------------------------
function CameraView({
  panel, onRemove, onChangeStream,
}: {
  panel: CamPanel;
  onRemove: () => void;
  onChangeStream: (s: string) => void;
}) {
  const [frame,     setFrame]     = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [fps,       setFps]       = useState(0);
  const wsRef    = useRef<WebSocket | null>(null);
  const fpsRef   = useRef(0);
  const fpsTimer = useRef<number | null>(null);
  const streamRef = useRef(panel.stream);

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
    connect(panel.stream);
    fpsTimer.current = window.setInterval(() => { setFps(fpsRef.current); fpsRef.current = 0; }, 1000);
    return () => {
      wsRef.current?.close();
      if (fpsTimer.current) clearInterval(fpsTimer.current);
    };
  }, []);

  useEffect(() => {
    if (panel.stream !== streamRef.current) {
      streamRef.current = panel.stream;
      connect(panel.stream);
    }
  }, [panel.stream, connect]);

  const info = IMG_STREAMS.find((s) => s.key === panel.stream) ?? IMG_STREAMS[0];

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
          <select
            value={panel.stream}
            onChange={(e) => onChangeStream(e.target.value)}
            className="bg-gray-700 text-white text-xs rounded px-2 py-1 font-semibold outline-none"
          >
            {IMG_STREAMS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-500">{fps} FPS</span>
        </div>
        <button
          onClick={onRemove}
          className="bg-red-600/80 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition"
          title="Remove"
        >✕</button>
      </div>

      {/* Feed */}
      <div className="flex-1 px-2 pb-2 min-h-0 overflow-hidden">
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
          {frame
            ? <img src={frame} alt={info.label} className="max-w-full max-h-full object-contain" />
            : (
              <div className="text-gray-600 flex flex-col items-center gap-2 text-sm">
                <span className="text-3xl">📷</span>
                <span>{connected ? "Waiting for frames…" : "Disconnected"}</span>
              </div>
            )
          }
          {/* Stream label badge */}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] text-white font-semibold">
            {info.label}
          </div>
          {/* FPS badge */}
          {connected && (
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
// Main: CamerasPage
// ---------------------------------------------------------------
const CamerasPage: React.FC = () => {
  const [panels,     setPanels]  = useState<CamPanel[]>([]);
  const [nextId,     setNextId]  = useState(1);

  const addPanel = () => {
    // Prefer a stream not yet open
    const used = new Set(panels.map((p) => p.stream));
    const free = IMG_STREAMS.find((s) => !used.has(s.key));
    setPanels((prev) => [...prev, { id: nextId, stream: free?.key ?? IMG_STREAMS[0].key }]);
    setNextId((n) => n + 1);
  };

  const removePanel     = (id: number) => setPanels((p) => p.filter((x) => x.id !== id));
  const updateStream    = (id: number, stream: string) =>
    setPanels((p) => p.map((x) => (x.id === id ? { ...x, stream } : x)));

  const getGridCols = () => {
    const n = panels.length;
    if (n <= 1) return "grid-cols-1";
    if (n <= 2) return "grid-cols-1 md:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  };

  const getPanelHeight = () => {
    const n = panels.length;
    if (n <= 2) return "calc(100vh - 130px)";
    return "calc(50vh - 75px)";
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Cameras</h2>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
            {IMG_STREAMS.length} streams
          </span>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
            {panels.length} active
          </span>
        </div>
        <button
          onClick={addPanel}
          disabled={panels.length >= IMG_STREAMS.length}
          className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition flex items-center gap-1
            ${panels.length >= IMG_STREAMS.length
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-cyan-600 hover:bg-cyan-500 text-white"}`}
        >+ Add Camera</button>
      </div>

      {/* Streams available */}
      <div className="flex gap-2 mb-3 flex-shrink-0">
        {IMG_STREAMS.map((s) => {
          const active = panels.some((p) => p.stream === s.key);
          return (
            <div key={s.key}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition
                ${active
                  ? "bg-cyan-900/40 border-cyan-600 text-cyan-400"
                  : "bg-gray-800 border-gray-700 text-gray-500"}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-cyan-400" : "bg-gray-600"}`} />
              {s.label}
            </div>
          );
        })}
      </div>

      {/* Grid / empty state */}
      {panels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4
          bg-gray-800/50 rounded-2xl border border-dashed border-gray-700">
          <span className="text-5xl">📷</span>
          <p className="text-lg font-semibold">No cameras added</p>
          <p className="text-sm text-gray-600">
            {IMG_STREAMS.length} streams available — Raw, QR Detection, Hazmat
          </p>
          <button
            onClick={addPanel}
            className="text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 px-6 py-2 rounded-xl transition"
          >+ Add Camera</button>
        </div>
      ) : (
        <div className={`flex-1 grid ${getGridCols()} gap-3 min-h-0 overflow-auto`}>
          {panels.map((panel) => (
            <div key={panel.id} style={{ height: getPanelHeight(), minHeight: 200 }}>
              <CameraView
                panel={panel}
                onRemove={() => removePanel(panel.id)}
                onChangeStream={(s) => updateStream(panel.id, s)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CamerasPage;