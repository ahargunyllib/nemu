package nemu

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/bot"
)

const secret = "a-long-shared-secret-for-the-wa-bot"

// fakeNemu stands in for packages/api's waBotRouter behind the OpenAPI handler.
func fakeNemu(t *testing.T, handle func(w http.ResponseWriter, r *http.Request)) *Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.Header.Get("Authorization") != "Bearer "+secret {
			http.Error(w, `{"code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
			return
		}
		handle(w, r)
	}))
	t.Cleanup(server.Close)
	return New(server.URL+"/", secret)
}

func TestIsRegisteredAsksTheSenderEndpoint(t *testing.T) {
	client := fakeNemu(t, func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Phone string }
		_ = json.NewDecoder(r.Body).Decode(&body)
		if r.URL.Path != "/api-reference/wa-bot/sender" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]bool{"registered": body.Phone == "6281200000099"})
	})

	known, err := client.IsRegistered(context.Background(), "6281200000099")
	if err != nil || !known {
		t.Fatalf("teacher: %v, %v", known, err)
	}
	known, err = client.IsRegistered(context.Background(), "6289999999999")
	if err != nil || known {
		t.Fatalf("stranger: %v, %v", known, err)
	}
}

func TestHandOverPostsThePhotoAsMultipart(t *testing.T) {
	photo := []byte{0xff, 0xd8, 0xff, 0xd9}
	path := filepath.Join(t.TempDir(), "photo-1")
	if err := os.WriteFile(path, photo, 0o600); err != nil {
		t.Fatal(err)
	}
	var got map[string]string
	client := fakeNemu(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api-reference/wa-bot/photos" {
			http.NotFound(w, r)
			return
		}
		file, _, err := r.FormFile("photo")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		body, _ := io.ReadAll(file)
		got = map[string]string{
			"phone":     r.FormValue("phone"),
			"messageId": r.FormValue("messageId"),
			"photo":     string(body),
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued", "jobId": "abc"})
	})

	outcome, err := client.HandOver(context.Background(), "6281200000099", "3EB0A", path)
	if err != nil || outcome != bot.Queued {
		t.Fatalf("HandOver = %q, %v", outcome, err)
	}
	want := map[string]string{"phone": "6281200000099", "messageId": "3EB0A", "photo": string(photo)}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("posted %v, want %v", got, want)
	}
}

// handOverParts hands over a photo with these bytes and returns the form parts the service got.
func handOverParts(t *testing.T, photo []byte) map[string][]byte {
	t.Helper()
	path := filepath.Join(t.TempDir(), "photo-1")
	if err := os.WriteFile(path, photo, 0o600); err != nil {
		t.Fatal(err)
	}
	parts := map[string][]byte{}
	client := fakeNemu(t, func(w http.ResponseWriter, r *http.Request) {
		reader, err := r.MultipartReader()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		for part, err := reader.NextPart(); err == nil; part, err = reader.NextPart() {
			parts[part.FormName()], _ = io.ReadAll(part)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued", "jobId": "abc"})
	})
	if outcome, err := client.HandOver(context.Background(), "6281200000099", "3EB0A", path); err != nil || outcome != bot.Queued {
		t.Fatalf("HandOver = %q, %v", outcome, err)
	}
	return parts
}

func TestHandOverAddsAThumbnailForTheCard(t *testing.T) {
	var photo bytes.Buffer
	if err := jpeg.Encode(&photo, image.NewGray(image.Rect(0, 0, 1280, 960)), nil); err != nil {
		t.Fatal(err)
	}
	parts := handOverParts(t, photo.Bytes())

	if !bytes.Equal(parts["photo"], photo.Bytes()) {
		t.Fatal("the photo was not posted as it is")
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(parts["thumbnail"]))
	if err != nil {
		t.Fatalf("no JPEG thumbnail: %v", err)
	}
	if config.Width != 320 || config.Height != 240 {
		t.Fatalf("thumbnail %dx%d, want 320x240", config.Width, config.Height)
	}
}

func TestHandOverWithoutAThumbnailWhenThePhotoCantBeDecoded(t *testing.T) {
	parts := handOverParts(t, []byte("RIFF....WEBPVP8 not decodable here"))

	if _, ok := parts["thumbnail"]; ok {
		t.Fatal("posted a thumbnail for a photo Go can't decode")
	}
	if string(parts["messageId"]) != "3EB0A" {
		t.Fatalf("form parts: %q", parts)
	}
}

func TestAWrongSecretIsAnError(t *testing.T) {
	client := fakeNemu(t, func(w http.ResponseWriter, r *http.Request) {})
	client.Secret = "wrong"

	if _, err := client.IsRegistered(context.Background(), "6281200000099"); err == nil {
		t.Fatal("a 401 was read as an unregistered sender")
	}
}
