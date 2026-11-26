package nemu

import (
	"context"
	"encoding/json"
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

func TestAWrongSecretIsAnError(t *testing.T) {
	client := fakeNemu(t, func(w http.ResponseWriter, r *http.Request) {})
	client.Secret = "wrong"

	if _, err := client.IsRegistered(context.Background(), "6281200000099"); err == nil {
		t.Fatal("a 401 was read as an unregistered sender")
	}
}
