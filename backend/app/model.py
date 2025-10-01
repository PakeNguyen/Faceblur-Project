# import cv2
# import numpy as np
# from ultralytics import YOLO

# # Đường dẫn tới file model YOLOv8 đã huấn luyện để detect khuôn mặt
# MODEL_PATH = r"C:\Hoc_May\All_Project\PROJECT_2025\6_8_2025\FaceBlurMobileCam\backend\app\yolov8s-face-lindevs.pt"

# # Load model YOLOv8 (nếu có GPU và cài CUDA, Ultralytics sẽ tự dùng GPU)
# model = YOLO(MODEL_PATH)

# def blur_faces_on_frame_bytes(frame_bytes: bytes, blur_strength: int = 35) -> bytes:
#     """
#     Nhận vào:
#         frame_bytes: dữ liệu ảnh (JPEG/PNG) dạng bytes từ client
#         blur_strength: độ mạnh làm mờ (Gaussian blur), mặc định 35
#     Trả về:
#         bytes ảnh JPEG đã làm mờ vùng khuôn mặt
#     """
#     # 1. Giải mã bytes ảnh thành mảng NumPy (màu BGR cho OpenCV)
#     np_arr = np.frombuffer(frame_bytes, np.uint8)
#     img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)  # BGR
    
#     if img is None:
#         raise RuntimeError("Cannot decode image")

#     # 2. Chạy model YOLO để detect khuôn mặt
#     # model(img) trả về list các đối tượng Results (mỗi ảnh 1 kết quả)
#     results = model(img)

#     # 3. Duyệt qua từng ảnh kết quả (ở đây thường chỉ có 1 ảnh)
#     for r in results:
#         # Lấy toạ độ bounding box dạng xyxy (x1,y1,x2,y2)
#         boxes = getattr(r.boxes, "xyxy", None)  # None nếu không có thuộc tính này
#         if boxes is None:
#             continue

#         # 4. Chuyển từ Tensor sang NumPy (vì OpenCV xử lý tốt với NumPy hơn)
#         try:
#             # TH1: boxes là Tensor → đưa về CPU rồi convert sang NumPy
#             xyxy = boxes.cpu().numpy()
#         except:
#             # TH2: boxes là NumPy hoặc object khác → convert nếu có .numpy()
#             xyxy = boxes.numpy() if hasattr(boxes, "numpy") else boxes

#         # 5. Duyệt qua từng bounding box trong ảnh
#         for box in xyxy:
#             # Lấy toạ độ và ép kiểu int
#             x1, y1, x2, y2 = map(int, box[0:4])

#             # Giới hạn toạ độ để không vượt ra ngoài ảnh (clamp)
#             x1 = max(0, x1)
#             y1 = max(0, y1)
#             x2 = min(img.shape[1] - 1, x2)  # img.shape[1] = width
#             y2 = min(img.shape[0] - 1, y2)  # img.shape[0] = height

#             # Cắt vùng khuôn mặt từ ảnh gốc
#             face = img[y1:y2, x1:x2]

#             # Nếu vùng crop rỗng (không có pixel) → bỏ qua
#             if face.size == 0:
#                 continue

#             # Tính kernel size: luôn số lẻ ≥ 3
#             k = max((blur_strength // 2) * 2 + 1, 3)

#             # Làm mờ Gaussian
#             face_blur = cv2.GaussianBlur(face, (k, k), 0)

#             # Gán lại vùng khuôn mặt đã làm mờ vào ảnh gốc
#             img[y1:y2, x1:x2] = face_blur

#     # 6. Mã hoá ảnh thành JPEG (chất lượng 85%)
#     success, encoded = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
#     if not success:
#         raise RuntimeError("Encode failed")

#     # Trả về bytes của ảnh JPEG
#     return encoded.tobytes()


import os  # [CHANGED] dùng ENV cho đường dẫn model
import cv2
import numpy as np
from ultralytics import YOLO

# ===== Model path =====
# [CHANGED] Không dùng đường dẫn tuyệt đối Windows; dùng ENV hoặc default tương đối.
# - Đặt file model vào: backend/app/models/face.pt
# - Hoặc set ENV MODEL_PATH="models/your-model.pt"
MODEL_PATH = os.getenv("MODEL_PATH", "models/face.pt")  # [CHANGED]

# ===== Load model =====
# Ultralytics sẽ tự dùng GPU nếu torch có CUDA.
# Bạn có thể ép device bằng: YOLO(MODEL_PATH).to('cuda') nhưng API khuyến nghị
# truyền device khi predict.
model = YOLO(MODEL_PATH)


def blur_faces_on_frame_bytes(frame_bytes: bytes, blur_strength: int = 35) -> bytes:
    """
    Nhận vào:
      - frame_bytes: dữ liệu ảnh (JPEG/PNG) dạng bytes từ client
      - blur_strength: độ mạnh làm mờ (Gaussian blur), mặc định 35
    Trả về:
      - bytes ảnh JPEG đã làm mờ vùng khuôn mặt
    """
    # 1) Decode bytes -> OpenCV BGR
    np_arr = np.frombuffer(frame_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)  # BGR
    if img is None:
        raise RuntimeError("Cannot decode image")

    # 2) YOLO inference (có thể truyền device qua env nếu cần)
    # [CHANGED] Cho phép chỉnh conf qua ENV (tuỳ chọn), mặc định 0.35
    conf = float(os.getenv("YOLO_CONF", "0.35"))  # [CHANGED]

    try:
        results = model(img, conf=conf)
    except Exception as e:
        # gói lỗi rõ ràng để bên caller biết xử lý
        raise RuntimeError(f"YOLO inference failed: {e}") from e

    # 3) Duyệt boxes và blur
    for r in results:
        # r.boxes.xyxy là tensor hoặc array; bảo đảm lấy ra được numpy array
        boxes = getattr(r.boxes, "xyxy", None)
        if boxes is None:
            continue
        try:
            xyxy = boxes.cpu().numpy()  # OK với torch Tensor
        except Exception:
            # nếu boxes đã là numpy array
            xyxy = boxes.numpy() if hasattr(boxes, "numpy") else boxes
        if xyxy is None:
            continue

        for box in xyxy:
            x1, y1, x2, y2 = map(int, box[0:4])

            # Clamp
            h, w = img.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w - 1, x2)
            y2 = min(h - 1, y2)

            # Skip invalid crops
            if x2 <= x1 or y2 <= y1:
                continue

            # Crop face
            face = img[y1:y2, x1:x2]
            if face.size == 0:
                continue

            # Kernel lẻ >= 3
            k = max((blur_strength // 2) * 2 + 1, 3)
            face_blur = cv2.GaussianBlur(face, (k, k), 0)
            img[y1:y2, x1:x2] = face_blur

    # 4) Encode JPEG
    # [CHANGED] Cho phép kiểm soát chất lượng qua ENV (mặc định 80 cho nhẹ băng thông)
    jpeg_q = int(os.getenv("JPEG_QUALITY", "80"))  # [CHANGED]
    success, encoded = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q])
    if not success:
        raise RuntimeError("Encode failed")
    return encoded.tobytes()
