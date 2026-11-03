# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/rail-announcements-backend ./cmd/rail-announcements-backend

FROM alpine:3.20
# ffmpeg decodes the clips and encodes the streams.
RUN apk add --no-cache ffmpeg ca-certificates && adduser -D -H -u 10001 app
WORKDIR /app
COPY --from=build /out/rail-announcements-backend /app/rail-announcements-backend
# The audio is not part of the image. Mount the repository's audio directory
# read-only at /audio, which is where the default Audio.Directory, ../audio,
# leads from /app.
USER app
EXPOSE 8090
ENTRYPOINT ["/app/rail-announcements-backend"]
