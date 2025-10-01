// import React, { useRef, useEffect, useState } from "react";

// export default function RealtimeBlur() {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const resultRef = useRef(null);
//   const wsRef = useRef(null);
//   const sendIntervalRef = useRef(null);

//   // refs để lưu giá trị mới nhất (tránh closure stuck)
//   const blurRef = useRef(35);
//   const fpsRef = useRef(5);
//   const widthRef = useRef(320);

//   const [running, setRunning] = useState(false);
//   const [status, setStatus] = useState("idle");
//   const [blurStrength, setBlurStrength] = useState(35);
//   const [fps, setFps] = useState(5);
//   const [targetWidth, setTargetWidth] = useState(320);

//   // luôn cập nhật refs khi state thay đổi
//   useEffect(() => { blurRef.current = blurStrength; }, [blurStrength]);
//   useEffect(() => { fpsRef.current = fps; }, [fps]);
//   useEffect(() => { widthRef.current = targetWidth; }, [targetWidth]);

//   useEffect(() => {
//     let mounted = true;
//     async function startCamera() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
//         if (!mounted) return;
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;
//           await videoRef.current.play();
//         }
//       } catch (err) {
//         console.error("Camera error", err);
//         setStatus("camera-error");
//       }
//     }
//     startCamera();
//     return () => {
//       mounted = false;
//       if (videoRef.current && videoRef.current.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach((t) => t.stop());
//       }
//       stopWS();
//     };
//   }, []);

//   // HÀM gửi frame: đọc giá trị từ refs (luôn lấy giá trị mới nhất)
//   const sendFrame = () => {
//     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
//     if (!video || !canvas || video.readyState < 2) return;

//     const targetW = Math.max(160, Math.min(640, widthRef.current));
//     const scale = targetW / Math.max(1, video.videoWidth || 320);
//     const targetH = Math.max(1, Math.round((video.videoHeight || 240) * scale));
//     canvas.width = targetW;
//     canvas.height = targetH;
//     const ctx = canvas.getContext("2d");
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//     // gửi frame binary
//     canvas.toBlob((blob) => {
//       if (!blob) return;
//       blob.arrayBuffer().then((buf) => {
//         try {
//           wsRef.current.send(buf);
//         } catch (err) {
//           console.error("send error", err);
//         }
//       });
//     }, "image/jpeg", 0.7);
//   };

//   // khởi tạo WS, start interval
//   const startWS = () => {
//     if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

//     setStatus("connecting");
//     const ws = new WebSocket("ws://localhost:8000/ws/frame");
//     ws.binaryType = "arraybuffer";

//     ws.onopen = () => {
//       console.log("ws open");
//       setStatus("ws-open");
//       setRunning(true);
//       // gửi cấu hình hiện tại ngay sau khi mở
//       sendConfigOverWS(ws);
//       restartInterval();
//     };

//     ws.onmessage = (ev) => {
//       if (typeof ev.data === "string") {
//         console.log("ws text:", ev.data);
//         return;
//       }
//       const blob = new Blob([ev.data], { type: "image/jpeg" });
//       const url = URL.createObjectURL(blob);
//       if (resultRef.current) resultRef.current.src = url;
//       setTimeout(() => URL.revokeObjectURL(url), 4000);
//     };

//     ws.onerror = (e) => {
//       console.error("ws error", e);
//       setStatus("ws-error");
//       setRunning(false);
//       stopInterval();
//     };

//     ws.onclose = () => {
//       console.log("ws closed");
//       setStatus("ws-closed");
//       setRunning(false);
//       stopInterval();
//     };

//     wsRef.current = ws;
//   };

//   // gửi cấu hình (blur) tới server bằng text JSON
//   const sendConfigOverWS = (ws = wsRef.current) => {
//     if (!ws || ws.readyState !== WebSocket.OPEN) return;
//     const cfg = { type: "set_config", blur: blurRef.current };
//     try {
//       ws.send(JSON.stringify(cfg));
//     } catch (e) {
//       console.error("sendConfig error", e);
//     }
//   };

//   // dừng interval gửi frame
//   const stopInterval = () => {
//     if (sendIntervalRef.current) {
//       clearInterval(sendIntervalRef.current);
//       sendIntervalRef.current = null;
//     }
//   };

//   // restart interval dựa trên fpsRef (gọi khi start hoặc fps thay đổi)
//   const restartInterval = () => {
//     stopInterval();
//     const intervalMs = Math.max(40, Math.round(1000 / Math.max(1, fpsRef.current)));
//     sendIntervalRef.current = setInterval(() => {
//       sendFrame();
//     }, intervalMs);
//   };

//   const stopWS = () => {
//     stopInterval();
//     if (wsRef.current) {
//       try { wsRef.current.close(); } catch {}
//       wsRef.current = null;
//     }
//     setRunning(false);
//     setStatus("idle");
//   };

//   // khi user thay đổi blur slider: cập nhật state/ref và gửi config đến server
//   const onChangeBlur = (v) => {
//     setBlurStrength(v);
//     blurRef.current = v;
//     sendConfigOverWS();
//   };

//   // khi thay fps: cập nhật state/ref và nếu đang chạy thì restart interval
//   const onChangeFps = (v) => {
//     setFps(v);
//     fpsRef.current = v;
//     if (running) restartInterval();
//   };

//   // khi thay target width: cập nhật và send (client dùng để resize before send)
//   const onChangeWidth = (v) => {
//     setTargetWidth(v);
//     widthRef.current = v;
//   };

//   return (
//     <div className="max-w-4xl mx-auto p-4">
//       <div className="flex items-center justify-between mb-4">
//         <h2 className="text-2xl font-semibold">Realtime Face Blur</h2>
//         <div className="flex items-center gap-3">
//           <div className="text-sm">Status:</div>
//           <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100">{status}</div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div className="bg-white rounded-lg shadow p-3">
//           <div className="text-sm mb-2 font-medium">Local camera (raw)</div>
//           <div className="w-full bg-black flex items-center justify-center" style={{ height: 240 }}>
//             <video ref={videoRef} className="max-w-full max-h-full" playsInline muted />
//           </div>
//         </div>

//         <div className="bg-white rounded-lg shadow p-3">
//           <div className="text-sm mb-2 font-medium">Processed (from server)</div>
//           <div className="w-full bg-gray-800 flex items-center justify-center" style={{ height: 240 }}>
//             <img ref={resultRef} className="max-w-full max-h-full" alt="processed" />
//           </div>
//         </div>
//       </div>

//       <div className="mt-4 bg-white rounded-lg shadow p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
//         <div className="flex gap-3 items-center">
//           {!running ? (
//             <button onClick={startWS} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Start</button>
//           ) : (
//             <button onClick={stopWS} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Stop</button>
//           )}
//         </div>

//         <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
//           <label className="text-xs">Blur strength: <span className="font-medium">{blurStrength}</span>
//             <input
//               type="range"
//               min="3"
//               max="101"
//               step="2"
//               value={blurStrength}
//               onChange={(e) => onChangeBlur(Number(e.target.value))}
//               className="w-full mt-1"
//             />
//           </label>

//           <label className="text-xs">FPS: <span className="font-medium">{fps}</span>
//             <input
//               type="range"
//               min="1"
//               max="15"
//               value={fps}
//               onChange={(e) => onChangeFps(Number(e.target.value))}
//               className="w-full mt-1"
//             />
//           </label>

//           <label className="text-xs">Send width: <span className="font-medium">{targetWidth}px</span>
//             <input
//               type="range"
//               min="160"
//               max="640"
//               step="16"
//               value={targetWidth}
//               onChange={(e) => onChangeWidth(Number(e.target.value))}
//               className="w-full mt-1"
//             />
//           </label>
//         </div>
//       </div>

//       <canvas ref={canvasRef} style={{ display: 'none' }} />
//     </div>
//   );
// }

import React, { useRef, useEffect, useState } from "react";

export default function RealtimeBlur() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const resultRef = useRef(null);
  const wsRef = useRef(null);
  const sendIntervalRef = useRef(null);

  // refs để lưu giá trị mới nhất (tránh closure stuck)
  const blurRef = useRef(35);
  const fpsRef = useRef(5);
  const widthRef = useRef(320);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("idle");
  const [blurStrength, setBlurStrength] = useState(35);
  const [fps, setFps] = useState(5);
  const [targetWidth, setTargetWidth] = useState(320);

  // [CHANGED] Lấy URL WebSocket từ ENV để deploy production (Vercel/Netlify)
  // set REACT_APP_WS_URL = wss://your-backend.onrender.com/ws/frame
  // Local dev: fallback ws://localhost:8000/ws/frame
  const WS_URL =
    process.env.REACT_APP_WS_URL ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://localhost:8000/ws/frame`;

  useEffect(() => {
    blurRef.current = blurStrength;
  }, [blurStrength]);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  useEffect(() => {
    widthRef.current = targetWidth;
  }, [targetWidth]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (!mounted) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // some browsers require autoplay attribute; keep play attempt
          try {
            await videoRef.current.play();
          } catch (e) {
            // ignore play errors (autoplay policy)
          }
        }
      } catch (err) {
        console.error("Camera error", err);
        setStatus("camera-error");
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((t) => t.stop());
      }
      stopWS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const targetW = Math.max(160, Math.min(640, widthRef.current));
    const scale = targetW / Math.max(1, video.videoWidth || 320);
    const targetH = Math.max(1, Math.round((video.videoHeight || 240) * scale));

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buf) => {
          try {
            wsRef.current.send(buf);
          } catch (err) {
            console.error("send error", err);
          }
        });
      },
      "image/jpeg",
      0.7
    );
  };

  const startWS = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setStatus("connecting");
    const ws = new WebSocket(WS_URL); // [CHANGED] dùng env URL
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      console.log("ws open");
      setStatus("ws-open");
      setRunning(true);
      sendConfigOverWS(ws);
      restartInterval();
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        console.log("ws text:", ev.data);
        return;
      }
      const blob = new Blob([ev.data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      if (resultRef.current) resultRef.current.src = url;
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };

    ws.onerror = (e) => {
      console.error("ws error", e);
      setStatus("ws-error");
      setRunning(false);
      stopInterval();
    };

    ws.onclose = () => {
      console.log("ws closed");
      setStatus("ws-closed");
      setRunning(false);
      stopInterval();
    };

    wsRef.current = ws;
  };

  const sendConfigOverWS = (ws = wsRef.current) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const cfg = { type: "set_config", blur: blurRef.current };
    try {
      ws.send(JSON.stringify(cfg));
    } catch (e) {
      console.error("sendConfig error", e);
    }
  };

  const stopInterval = () => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
  };

  const restartInterval = () => {
    stopInterval();
    const intervalMs = Math.max(40, Math.round(1000 / Math.max(1, fpsRef.current)));
    sendIntervalRef.current = setInterval(() => {
      sendFrame();
    }, intervalMs);
  };

  const stopWS = () => {
    stopInterval();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setRunning(false);
    setStatus("idle");
  };

  const onChangeBlur = (v) => {
    setBlurStrength(v);
    blurRef.current = v;
    sendConfigOverWS();
  };

  const onChangeFps = (v) => {
    setFps(v);
    fpsRef.current = v;
    if (running) restartInterval();
  };

  const onChangeWidth = (v) => {
    setTargetWidth(v);
    widthRef.current = v;
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Realtime Face Blur</h2>
        <div className="flex items-center gap-3">
          <div className="text-sm">Status:</div>
          <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100">{status}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-sm mb-2 font-medium">Local camera (raw)</div>
          <div className="w-full bg-black flex items-center justify-center" style={{ height: 240 }}>
            <video ref={videoRef} className="max-w-full max-h-full" playsInline muted autoPlay />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3">
          <div className="text-sm mb-2 font-medium">Processed (from server)</div>
          <div className="w-full bg-gray-800 flex items-center justify-center" style={{ height: 240 }}>
            <img ref={resultRef} className="max-w-full max-h-full" alt="processed" />
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-lg shadow p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex gap-3 items-center">
          {!running ? (
            <button onClick={startWS} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Start</button>
          ) : (
            <button onClick={stopWS} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Stop</button>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
          <label className="text-xs">
            Blur strength: <span className="font-medium">{blurStrength}</span>
            <input
              type="range"
              min="3"
              max="101"
              step="2"
              value={blurStrength}
              onChange={(e) => onChangeBlur(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>

          <label className="text-xs">
            FPS: <span className="font-medium">{fps}</span>
            <input
              type="range"
              min="1"
              max="15"
              value={fps}
              onChange={(e) => onChangeFps(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>

          <label className="text-xs">
            Send width: <span className="font-medium">{targetWidth}px</span>
            <input
              type="range"
              min="160"
              max="640"
              step="16"
              value={targetWidth}
              onChange={(e) => onChangeWidth(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
