package bot

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

const teacherPhone = "6281200000099"

var photoBytes = []byte{0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x01, 0xff, 0xd9}

// world records every step the bot takes, in order, across the fake WhatsApp and Nemu Service.
type world struct {
	t          *testing.T
	steps      []string
	registered map[string]bool
	senderErr  error
	handOver   func(path string) (Outcome, error)
	handedOver [][]byte
}

func (w *world) MarkRead(context.Context, Photo) error {
	w.steps = append(w.steps, "read")
	return nil
}

func (w *world) SetTyping(_ context.Context, _ Photo, typing bool) error {
	if typing {
		w.steps = append(w.steps, "typing")
	} else {
		w.steps = append(w.steps, "stop typing")
	}
	return nil
}

func (w *world) Download(_ context.Context, _ Photo, dst *os.File) error {
	w.steps = append(w.steps, "download")
	_, err := dst.Write(photoBytes)
	return err
}

func (w *world) Reply(_ context.Context, _ Photo, text string) error {
	w.steps = append(w.steps, "reply: "+text)
	return nil
}

func (w *world) IsRegistered(_ context.Context, phone string) (bool, error) {
	w.steps = append(w.steps, "is registered?")
	return w.registered[phone], w.senderErr
}

func (w *world) HandOver(_ context.Context, phone, messageID, path string) (Outcome, error) {
	w.steps = append(w.steps, "hand over")
	file, err := os.Open(path)
	if err != nil {
		w.t.Fatalf("the photo isn't on disk at hand-off: %v", err)
	}
	defer file.Close()
	body, _ := io.ReadAll(file)
	w.handedOver = append(w.handedOver, body)
	if w.handOver != nil {
		return w.handOver(path)
	}
	return Queued, nil
}

func newWorld(t *testing.T) (*world, *Bot, string) {
	t.Helper()
	w := &world{t: t, registered: map[string]bool{teacherPhone: true}}
	dir := t.TempDir()
	b := New(Config{
		WhatsApp: w,
		Nemu:     w,
		PhotoDir: dir,
		Pause: func(context.Context, time.Duration, time.Duration) error {
			w.steps = append(w.steps, "pause")
			return nil
		},
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	return w, b, dir
}

func assertNoPhotoOnDisk(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("photos left on disk: %v", entries)
	}
}

func TestUnknownNumberIsIgnoredBeforeAnythingIsDownloaded(t *testing.T) {
	w, b, dir := newWorld(t)

	b.Handle(context.Background(), Photo{MessageID: "3EB0A", Phone: "6289999999999"})

	if want := []string{"is registered?"}; !reflect.DeepEqual(w.steps, want) {
		t.Fatalf("steps = %q, want only %q (no read receipt, download, or reply)", w.steps, want)
	}
	assertNoPhotoOnDisk(t, dir)
}

func TestTeacherPhotoIsReadDownloadedHandedOverDeletedAndAnswered(t *testing.T) {
	w, b, dir := newWorld(t)

	b.Handle(context.Background(), Photo{MessageID: "3EB0B", Phone: teacherPhone})

	want := []string{
		"is registered?",
		"pause",
		"read",
		"download",
		"hand over",
		"typing",
		"pause",
		"stop typing",
		"reply: " + ReplyQueued,
		"pause",
	}
	if !reflect.DeepEqual(w.steps, want) {
		t.Fatalf("steps =\n%q\nwant\n%q", w.steps, want)
	}
	if len(w.handedOver) != 1 || !reflect.DeepEqual(w.handedOver[0], photoBytes) {
		t.Fatalf("handed over %v, want the downloaded photo", w.handedOver)
	}
	assertNoPhotoOnDisk(t, dir)
}

func TestSameMessageTwiceIsOneHandOver(t *testing.T) {
	w, b, _ := newWorld(t)
	ctx, cancel := context.WithCancel(context.Background())
	photo := Photo{MessageID: "3EB0C", Phone: teacherPhone}

	first, again := b.Receive(photo), b.Receive(photo)
	if !first || again {
		t.Fatalf("Receive = %v, %v; want the redelivery dropped", first, again)
	}
	b.Handle(ctx, <-b.queue)
	if b.Receive(photo) {
		t.Fatal("a message already handed over was queued again")
	}
	cancel()
	if len(w.handedOver) != 1 {
		t.Fatalf("handed over %d times, want 1", len(w.handedOver))
	}
}

func TestFailedHandOverApologisesDeletesThePhotoAndAllowsARetry(t *testing.T) {
	w, b, dir := newWorld(t)
	w.handOver = func(string) (Outcome, error) { return "", errors.New("Nemu Service unreachable") }
	photo := Photo{MessageID: "3EB0D", Phone: teacherPhone}

	b.Receive(photo)
	b.Handle(context.Background(), <-b.queue)

	if last := w.steps[len(w.steps)-2]; last != "reply: "+ReplyFailed {
		t.Fatalf("reply = %q, want the apology", last)
	}
	assertNoPhotoOnDisk(t, dir)
	if !b.Receive(photo) {
		t.Fatal("the teacher's resend of a failed message was dropped")
	}
}

func TestSenderCheckFailureDoesNothing(t *testing.T) {
	w, b, dir := newWorld(t)
	w.senderErr = errors.New("timeout")

	b.Handle(context.Background(), Photo{MessageID: "3EB0E", Phone: teacherPhone})

	if want := []string{"is registered?"}; !reflect.DeepEqual(w.steps, want) {
		t.Fatalf("steps = %q, want %q", w.steps, want)
	}
	assertNoPhotoOnDisk(t, dir)
}

func TestEachRefusalGetsItsOwnAnswer(t *testing.T) {
	for outcome, reply := range map[Outcome]string{
		TooLarge:      ReplyTooLarge,
		NotAnImage:    ReplyNotAnImage,
		UnknownSender: "",
	} {
		w, b, _ := newWorld(t)
		w.handOver = func(string) (Outcome, error) { return outcome, nil }

		b.Handle(context.Background(), Photo{MessageID: "3EB0F", Phone: teacherPhone})

		var replies []string
		for _, step := range w.steps {
			if text, ok := strings.CutPrefix(step, "reply: "); ok {
				replies = append(replies, text)
			}
		}
		if (reply == "" && len(replies) != 0) || (reply != "" && !reflect.DeepEqual(replies, []string{reply})) {
			t.Errorf("%s: replies = %q, want %q", outcome, replies, reply)
		}
	}
}

func TestRunHandlesOneMessageAtATime(t *testing.T) {
	w, b, _ := newWorld(t)
	inFlight, most := 0, 0
	done := make(chan struct{}, 2)
	w.handOver = func(string) (Outcome, error) {
		inFlight++
		most = max(most, inFlight)
		time.Sleep(10 * time.Millisecond)
		inFlight--
		done <- struct{}{}
		return Queued, nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	b.Receive(Photo{MessageID: "3EB0G", Phone: teacherPhone})
	b.Receive(Photo{MessageID: "3EB0H", Phone: teacherPhone})

	go b.Run(ctx)
	<-done
	<-done

	if most != 1 {
		t.Fatalf("%d photos were handled at once, want 1", most)
	}
}
