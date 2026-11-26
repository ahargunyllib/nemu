// wa-bot receives grade-book photos sent to the Nemu WhatsApp number and hands them to the Nemu
// Service's photo inbox (F1-01, issue #203). Deploy and linking: infra/README.md.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/bot"
	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/nemu"
	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/whatsapp"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("wa-bot stopped", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	serverURL := mustEnv(log, "NEMU_SERVER_URL")
	secret := mustEnv(log, "WA_BOT_SECRET")
	dataDir := envOr("WA_BOT_DATA_DIR", "/data")
	photoDir := filepath.Join(os.TempDir(), "wa-bot-photos")

	// A photo left behind by a crash is deleted before anything else (F1-12).
	if err := os.RemoveAll(photoDir); err != nil {
		return err
	}
	if err := os.MkdirAll(photoDir, 0o700); err != nil {
		return err
	}
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	wa, err := whatsapp.Open(ctx, filepath.Join(dataDir, "session.db"), log)
	if err != nil {
		return err
	}
	b := bot.New(bot.Config{
		WhatsApp: wa,
		Nemu:     nemu.New(serverURL, secret),
		PhotoDir: photoDir,
		Log:      log,
	})
	go b.Run(ctx)

	loggedOut := make(chan struct{}, 1)
	if err := wa.Connect(ctx, b.Receive, func() { loggedOut <- struct{}{} }); err != nil {
		return err
	}
	defer wa.Disconnect()
	log.Info("waiting for photos")

	select {
	case <-ctx.Done():
		return nil
	case <-loggedOut:
		// Exit so Compose restarts the bot, which then prints a new QR code.
		os.Exit(1)
		return nil
	}
}

func mustEnv(log *slog.Logger, name string) string {
	value := os.Getenv(name)
	if value == "" {
		log.Error("missing configuration: set " + name + " (infra/.env)")
		os.Exit(1)
	}
	return value
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
