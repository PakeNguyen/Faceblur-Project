# # Base image: Python 3.10 slim (nhẹ hơn so với full)
# FROM python:3.10-slim

# # Set working directory trong container
# WORKDIR /app

# # Copy requirements.txt trước để tận dụng cache Docker layer
# COPY requirements.txt .

# # Cài dependencies (gom hết trong requirements.txt)
# RUN pip install --no-cache-dir --upgrade pip \
#     && pip install --no-cache-dir -r requirements.txt

# # Copy toàn bộ source code backend vào container
# COPY ./app /app

# # Expose port 8000 cho FastAPI
# EXPOSE 8000

# # Run server khi container start
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Base image: Python 3.10 slim
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Cài các package hệ thống cần thiết cho opencv và các lib chung
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và cài Python deps
COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY ./app /app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
