# # main.py
# import asyncio
# import json
# import traceback
# from fastapi import FastAPI, WebSocket, WebSocketDisconnect
# from fastapi.middleware.cors import CORSMiddleware

# # chỉnh import theo vị trí file model.py của bạn
# from model import blur_faces_on_frame_bytes

# import uvicorn

# app = FastAPI(title="YOLOv8 Realtime Face Blur")

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # dev: cho mọi nơi; production: giới hạn domain
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# @app.websocket("/ws/frame")
# async def websocket_frame(ws: WebSocket):
#     """
#     WebSocket handler:
#     - Nhận binary frames (bytes) -> blur theo `current_blur` -> trả bytes
#     - Nhận text messages (JSON): {"type":"set_config","blur":35} hoặc {"type":"ping"}
#     - Mỗi connection giữ biến current_blur riêng (per-connection)
#     """
#     await ws.accept()
#     # per-connection state
#     current_blur = 35

#     try:
#         while True:
#             msg = await ws.receive()  # msg dạng dict, có thể chứa "bytes" hoặc "text" hoặc "type"
#             # ---------- binary frame ----------
#             frame_bytes = msg.get("bytes")
#             if frame_bytes is not None:
#                 try:
#                     # gọi hàm xử lý trong threadpool để tránh block event loop
#                     processed = await asyncio.to_thread(blur_faces_on_frame_bytes, frame_bytes, int(current_blur))
#                     await ws.send_bytes(processed)
#                 except Exception as e:
#                     # log server-side, gửi thông báo ngắn cho client
#                     print("Error processing frame:", e)
#                     print(traceback.format_exc())
#                     try:
#                         await ws.send_text("ERROR: processing failed")
#                     except Exception:
#                         pass
#                 continue

#             # ---------- text message ----------
#             text = msg.get("text")
#             if text is not None:
#                 # try parse JSON, but also accept simple legacy commands
#                 try:
#                     payload = json.loads(text)
#                     if isinstance(payload, dict):
#                         t = payload.get("type")
#                         if t == "set_config":
#                             # update per-connection blur
#                             b = payload.get("blur")
#                             if b is not None:
#                                 try:
#                                     current_blur = int(b)
#                                     await ws.send_text("OK")
#                                 except Exception:
#                                     await ws.send_text("ERROR: bad blur value")
#                             else:
#                                 await ws.send_text("ERROR: missing blur")
#                         elif t == "ping":
#                             # reply pong with timestamp
#                             await ws.send_text(json.dumps({"type": "pong", "t": payload.get("t")}))
#                         else:
#                             await ws.send_text("UNKNOWN_CMD")
#                     else:
#                         await ws.send_text("ERROR: invalid payload")
#                 except json.JSONDecodeError:
#                     # fallback: simple legacy text handling
#                     if text.startswith("SET_BLUR:"):
#                         try:
#                             current_blur = int(text.split(":", 1)[1])
#                             await ws.send_text("OK")
#                         except Exception:
#                             await ws.send_text("ERROR: bad SET_BLUR value")
#                     elif text == "ping":
#                         await ws.send_text("pong")
#                     else:
#                         await ws.send_text("Unknown text")
#                 continue

#             # ---------- other event types (disconnect, etc.) ----------
#             # Some frameworks may send {"type": "websocket.disconnect"} etc.
#             # We simply ignore and loop until exception/WebSocketDisconnect is raised.
#     except WebSocketDisconnect:
#         print("Client disconnected")
#     except Exception as e:
#         print("WS unexpected error:", e)
#         print(traceback.format_exc())
#     finally:
#         try:
#             await ws.close()
#         except Exception:
#             pass


# if __name__ == "__main__":
#     # chạy dev server:
#     uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)


import asyncio
import json
import traceback
import os  # [CHANGED] dùng ENV cho cấu hình
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from model import blur_faces_on_frame_bytes

from dotenv import load_dotenv; load_dotenv()


app = FastAPI(title="YOLOv8 Realtime Face Blur")

# ===== CORS =====
# [CHANGED]: Đọc ALLOWED_ORIGINS từ ENV (phân tách bằng dấu phẩy).
# Production: set ALLOWED_ORIGINS="https://your-frontend.vercel.app,https://another-domain.com"
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://localhost:3000"
).split(",")
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # [CHANGED] thay vì "*" khi lên production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/frame")
async def websocket_frame(ws: WebSocket):
    """
    WebSocket handler:
    - Nhận binary frames (bytes) -> blur theo `current_blur` -> trả bytes
    - Nhận text messages (JSON): {"type":"set_config","blur":35} hoặc {"type":"ping"}
    - Mỗi connection giữ biến current_blur riêng (per-connection)
    """
    await ws.accept()
    # per-connection state
    current_blur = 35
    try:
        while True:
            msg = await ws.receive()  # msg dạng dict, có thể chứa "bytes" hoặc "text" hoặc "type"

            # ---------- binary frame ----------
            frame_bytes = msg.get("bytes")
            if frame_bytes is not None:
                try:
                    # gọi hàm xử lý trong threadpool để tránh block event loop
                    processed = await asyncio.to_thread(
                        blur_faces_on_frame_bytes, frame_bytes, int(current_blur)
                    )
                    await ws.send_bytes(processed)
                except Exception as e:
                    # log server-side, gửi thông báo ngắn cho client
                    print("Error processing frame:", e)
                    print(traceback.format_exc())
                    try:
                        await ws.send_text("ERROR: processing failed")
                    except Exception:
                        pass
                    continue

            # ---------- text message ----------
            text = msg.get("text")
            if text is not None:
                # try parse JSON, but also accept simple legacy commands
                try:
                    payload = json.loads(text)
                    if isinstance(payload, dict):
                        t = payload.get("type")
                        if t == "set_config":
                            # update per-connection blur
                            b = payload.get("blur")
                            if b is not None:
                                try:
                                    current_blur = int(b)
                                    await ws.send_text("OK")
                                except Exception:
                                    await ws.send_text("ERROR: bad blur value")
                            else:
                                await ws.send_text("ERROR: missing blur")

                        elif t == "ping":
                            # reply pong with timestamp
                            await ws.send_text(
                                json.dumps({"type": "pong", "t": payload.get("t")})
                            )
                        else:
                            await ws.send_text("UNKNOWN_CMD")
                    else:
                        await ws.send_text("ERROR: invalid payload")

                except json.JSONDecodeError:
                    # fallback: simple legacy text handling
                    if text.startswith("SET_BLUR:"):
                        try:
                            current_blur = int(text.split(":", 1)[1])
                            await ws.send_text("OK")
                        except Exception:
                            await ws.send_text("ERROR: bad SET_BLUR value")
                    elif text == "ping":
                        await ws.send_text("pong")
                    else:
                        await ws.send_text("Unknown text")
                continue

    # ---------- other event types (disconnect, etc.) ----------
    # Some frameworks may send {"type": "websocket.disconnect"} etc.
    # We simply ignore and loop until exception/WebSocketDisconnect is raised.
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print("WS unexpected error:", e)
        print(traceback.format_exc())
    finally:
        try:
            await ws.close()
        except Exception:
            pass


if __name__ == "__main__":
    # [CHANGED] host 0.0.0.0 để nhận kết nối từ Internet/Render/Fly
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
