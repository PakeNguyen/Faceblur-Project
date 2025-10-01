# 1. Build React app
FROM node:18-alpine AS build

WORKDIR /app

# Copy package.json và package-lock.json trước (tối ưu cache)
COPY package*.json ./

# Cài dependencies
RUN npm install

# Copy toàn bộ source code
COPY . .

# Build ra production static files
RUN npm run build

# 2. Dùng Nginx để serve
FROM nginx:alpine

# Copy build từ stage trước vào thư mục serve của Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copy file cấu hình nginx (tùy chọn, nếu bạn muốn proxy API)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
