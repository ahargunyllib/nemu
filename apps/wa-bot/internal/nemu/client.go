// Package nemu calls the Nemu Service's wa-bot endpoints (packages/api/src/modules/wa-bot).
package nemu

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/bot"
)

type Client struct {
	// BaseURL is the Nemu Service, such as https://nemu-api.ahargunyllib.dev.
	BaseURL string
	// Secret is WA_BOT_SECRET, the same value the Worker has.
	Secret string
	HTTP   *http.Client
}

func New(baseURL, secret string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Secret:  secret,
		HTTP:    &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *Client) IsRegistered(ctx context.Context, phone string) (bool, error) {
	body, err := json.Marshal(map[string]string{"phone": phone})
	if err != nil {
		return false, err
	}
	var answer struct {
		Registered bool `json:"registered"`
	}
	err = c.post(ctx, "/wa-bot/sender", "application/json", bytes.NewReader(body), &answer)
	return answer.Registered, err
}

func (c *Client) HandOver(ctx context.Context, phone, messageID, path string) (bot.Outcome, error) {
	photo, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer photo.Close()

	var form bytes.Buffer
	writer := multipart.NewWriter(&form)
	if err := writer.WriteField("phone", phone); err != nil {
		return "", err
	}
	if err := writer.WriteField("messageId", messageID); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("photo", "photo")
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, photo); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	var answer struct {
		Status bot.Outcome `json:"status"`
	}
	if err := c.post(ctx, "/wa-bot/photos", writer.FormDataContentType(), &form, &answer); err != nil {
		return "", err
	}
	switch answer.Status {
	case bot.Queued, bot.UnknownSender, bot.NotAnImage, bot.TooLarge:
		return answer.Status, nil
	default:
		return "", fmt.Errorf("unexpected hand-off status %q", answer.Status)
	}
}

func (c *Client) post(ctx context.Context, path, contentType string, body io.Reader, answer any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api-reference"+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+c.Secret)
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("POST %s: %s: %s", path, res.Status, detail)
	}
	return json.NewDecoder(res.Body).Decode(answer)
}
