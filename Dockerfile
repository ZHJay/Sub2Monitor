# syntax=docker/dockerfile:1.7

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o sub2monitor ./cmd/server

# Stage 3: Runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=backend-builder /app/sub2monitor .
COPY --from=backend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8090
CMD ["./sub2monitor"]
