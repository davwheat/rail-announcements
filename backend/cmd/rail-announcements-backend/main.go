package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"rail-announcements-backend/internal/api"
	"rail-announcements-backend/internal/audio"
	"rail-announcements-backend/internal/config"
	"rail-announcements-backend/internal/feed"
	"rail-announcements-backend/internal/helppoint"
	"rail-announcements-backend/internal/logging"
	"rail-announcements-backend/internal/stream"
)

func main() {
	configPath := flag.String("config", "", "path to config.toml")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		panic(err)
	}
	log := logging.New(cfg.EnableDebugLogs)

	library, err := audio.NewLibrary(cfg.Audio.Directory, cfg.Audio.FFmpeg, cfg.Audio.CacheMB<<20)
	if err != nil {
		log.FatalE("Audio library", err)
	}
	hub, err := feed.NewHub(cfg.Feed.DarwinBrowserURL, log)
	if err != nil {
		log.FatalE("Feed", err)
	}

	board, err := helppoint.NewBoard(cfg.Feed.DarwinBrowserURL)
	if err != nil {
		log.FatalE("Departure boards", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	streams := stream.NewManager(ctx, hub, stream.Voices{Library: library}, log, stream.Options{
		FFmpeg:          cfg.Audio.FFmpeg,
		BitrateKbps:     cfg.Stream.BitrateKbps,
		SegmentDuration: cfg.Stream.SegmentDuration,
		Window:          cfg.Stream.PlaylistWindow,
		IdleTimeout:     cfg.Stream.IdleTimeout,
		MaxStreams:      cfg.Stream.MaxStreams,
	})

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.API.Port),
		Handler:           api.New(streams, library, board, cfg.API.AllowedOrigins, log).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(shutdown)
	}()

	log.Infof("Listening on %s, speaking for %s, audio from %s", server.Addr, cfg.Feed.DarwinBrowserURL, cfg.Audio.Directory)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.FatalE("HTTP server", err)
	}
}
