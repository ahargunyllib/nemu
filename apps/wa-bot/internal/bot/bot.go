// Package bot turns grade-book photos sent to the Nemu WhatsApp number into photo jobs (F1-01).
//
// It only knows WhatsApp and the Nemu Service through the WhatsApp and Nemu interfaces, so its
// rules are tested with fakes: unknown numbers are ignored before anything is downloaded, a
// message is handed over once, the photo leaves the disk right after the hand-off, and the bot
// behaves like a person reading their phone (one message at a time, with pauses).
package bot

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"os"
	"sync"
	"time"
)

// Photo is an incoming image message from a one-to-one chat.
type Photo struct {
	MessageID string
	// Phone is the sender's number in international digits, such as 6281200000099.
	Phone string
	// Ref is the adapter's own handle on the message, passed back to WhatsApp unchanged.
	Ref any
}

// WhatsApp is the linked WhatsApp account.
type WhatsApp interface {
	MarkRead(ctx context.Context, photo Photo) error
	SetTyping(ctx context.Context, photo Photo, typing bool) error
	// Download writes the photo at full quality to dst.
	Download(ctx context.Context, photo Photo, dst *os.File) error
	Reply(ctx context.Context, photo Photo, text string) error
}

// Outcome is the Nemu Service's answer to a hand-off.
type Outcome string

const (
	Queued        Outcome = "queued"
	UnknownSender Outcome = "unknown_sender"
	NotAnImage    Outcome = "not_an_image"
	TooLarge      Outcome = "too_large"
)

// Nemu is the Nemu Service's wa-bot endpoints.
type Nemu interface {
	IsRegistered(ctx context.Context, phone string) (bool, error)
	HandOver(ctx context.Context, phone, messageID, path string) (Outcome, error)
}

// Pause waits for a random time between min and max, or until ctx ends.
type Pause func(ctx context.Context, min, max time.Duration) error

// RandomPause is the Pause the bot runs with.
func RandomPause(ctx context.Context, min, max time.Duration) error {
	wait := min + rand.N(max-min+1)
	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// Replies, in the Indonesian the teacher reads.
const (
	ReplyQueued     = "Fotonya sudah diterima Nemu. Buka AlurSekolah di laptop, fotonya muncul di sana."
	ReplyTooLarge   = "Fotonya lebih dari 8 MB. Coba kirim ulang sebagai foto biasa, ya."
	ReplyNotAnImage = "Nemu hanya bisa membaca foto JPG, PNG, atau WebP. Coba kirim ulang sebagai foto, ya."
	ReplyFailed     = "Maaf, fotonya belum bisa diterima Nemu. Coba kirim sekali lagi, ya."
)

const (
	queueSize = 64
	// How many recent message ids the bot remembers to drop redeliveries.
	seenSize = 1000
)

type Config struct {
	WhatsApp WhatsApp
	Nemu     Nemu
	// PhotoDir holds a photo only between its download and its hand-off.
	PhotoDir string
	Pause    Pause
	Log      *slog.Logger
}

type Bot struct {
	cfg   Config
	queue chan Photo

	mu       sync.Mutex
	seen     map[string]bool
	seenList []string
}

func New(cfg Config) *Bot {
	if cfg.Pause == nil {
		cfg.Pause = RandomPause
	}
	if cfg.Log == nil {
		cfg.Log = slog.Default()
	}
	return &Bot{cfg: cfg, queue: make(chan Photo, queueSize), seen: map[string]bool{}}
}

// Receive queues a photo for Run. It never blocks, so the WhatsApp event loop keeps going, and
// returns false when the message id was already received (a redelivery) or the queue is full.
func (b *Bot) Receive(photo Photo) bool {
	if !b.remember(photo.MessageID) {
		return false
	}
	select {
	case b.queue <- photo:
		return true
	default:
		b.forget(photo.MessageID)
		b.cfg.Log.Warn("queue full, photo dropped", "messageId", photo.MessageID)
		return false
	}
}

// Run handles queued photos one at a time until ctx ends.
func (b *Bot) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case photo := <-b.queue:
			b.Handle(ctx, photo)
		}
	}
}

// Handle processes one photo. Exported for tests; the bot calls it from Run.
func (b *Bot) Handle(ctx context.Context, photo Photo) {
	log := b.cfg.Log.With("messageId", photo.MessageID)
	registered, err := b.cfg.Nemu.IsRegistered(ctx, photo.Phone)
	if err != nil {
		b.forget(photo.MessageID)
		log.Error("sender check failed", "error", err)
		return
	}
	if !registered {
		// Unknown numbers get no read receipt, no reply, and nothing is downloaded (F1-01).
		log.Info("ignored a photo from an unregistered number")
		return
	}

	// Pick up the phone and open the chat.
	if b.cfg.Pause(ctx, 2*time.Second, 6*time.Second) != nil {
		b.forget(photo.MessageID)
		return
	}
	if err := b.cfg.WhatsApp.MarkRead(ctx, photo); err != nil {
		log.Warn("read receipt failed", "error", err)
	}

	outcome, err := b.handOver(ctx, photo)
	if err != nil {
		b.forget(photo.MessageID)
		log.Error("hand-off failed", "error", err)
	} else {
		log.Info("photo handed over", "outcome", string(outcome))
	}

	reply := replyFor(outcome, err)
	if reply == "" {
		return
	}
	if err := b.cfg.WhatsApp.SetTyping(ctx, photo, true); err != nil {
		log.Warn("typing indicator failed", "error", err)
	}
	_ = b.cfg.Pause(ctx, 2*time.Second, 5*time.Second)
	if err := b.cfg.WhatsApp.SetTyping(ctx, photo, false); err != nil {
		log.Warn("typing indicator failed", "error", err)
	}
	if err := b.cfg.WhatsApp.Reply(ctx, photo, reply); err != nil {
		log.Error("reply failed", "error", err)
	}
	// A breath before the next chat, as one person answering one message at a time.
	_ = b.cfg.Pause(ctx, 1*time.Second, 3*time.Second)
}

// handOver downloads the photo into PhotoDir, posts it to the Nemu Service, and deletes it (F1-12).
func (b *Bot) handOver(ctx context.Context, photo Photo) (Outcome, error) {
	file, err := os.CreateTemp(b.cfg.PhotoDir, "photo-*")
	if err != nil {
		return "", err
	}
	path := file.Name()
	defer os.Remove(path)

	err = b.cfg.WhatsApp.Download(ctx, photo, file)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return "", errors.Join(errors.New("download"), err)
	}
	outcome, err := b.cfg.Nemu.HandOver(ctx, photo.Phone, photo.MessageID, path)
	if removeErr := os.Remove(path); removeErr != nil {
		b.cfg.Log.Error("could not delete the photo", "error", removeErr)
	}
	return outcome, err
}

func replyFor(outcome Outcome, err error) string {
	if err != nil {
		return ReplyFailed
	}
	switch outcome {
	case Queued:
		return ReplyQueued
	case TooLarge:
		return ReplyTooLarge
	case NotAnImage:
		return ReplyNotAnImage
	default:
		// Unregistered between the check and the hand-off: stay silent, as for any unknown number.
		return ""
	}
}

func (b *Bot) remember(id string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.seen[id] {
		return false
	}
	b.seen[id] = true
	b.seenList = append(b.seenList, id)
	if len(b.seenList) > seenSize {
		delete(b.seen, b.seenList[0])
		b.seenList = b.seenList[1:]
	}
	return true
}

// forget lets a redelivery of a message that failed be tried again.
func (b *Bot) forget(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.seen, id)
}
