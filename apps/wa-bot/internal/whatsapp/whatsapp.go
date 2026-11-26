// Package whatsapp links the Nemu number with whatsmeow and implements bot.WhatsApp.
//
// whatsmeow is an unofficial client: the team chose it over the Cloud API on purpose. Everything
// here is thin glue; the rules live in package bot.
package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite" // the "sqlite" driver, pure Go

	"github.com/ahargunyllib/nemu/apps/wa-bot/internal/bot"
)

type Client struct {
	wa  *whatsmeow.Client
	log *slog.Logger
}

// Open loads (or creates) the session stored in the SQLite file at sessionPath.
func Open(ctx context.Context, sessionPath string, log *slog.Logger) (*Client, error) {
	address := "file:" + sessionPath + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(10000)"
	container, err := sqlstore.New(ctx, "sqlite", address, waLog.Stdout("store", "WARN", false))
	if err != nil {
		return nil, fmt.Errorf("open session store: %w", err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, fmt.Errorf("load device: %w", err)
	}
	return &Client{wa: whatsmeow.NewClient(device, waLog.Stdout("whatsapp", "WARN", false)), log: log}, nil
}

// Connect links the number on the first run, printing QR codes to stdout until one is scanned,
// and reconnects with the stored session after that. Photos go to receive; logout ends the bot.
func (c *Client) Connect(ctx context.Context, receive func(bot.Photo) bool, loggedOut func()) error {
	c.wa.AddEventHandler(func(event any) {
		switch evt := event.(type) {
		case *events.Message:
			if photo, ok := c.photoFrom(ctx, evt); ok && !receive(photo) {
				c.log.Info("dropped a redelivered message", "messageId", photo.MessageID)
			}
		case *events.Connected:
			// Online, as the phone app is when it's open; typing indicators need it.
			if err := c.wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
				c.log.Warn("presence failed", "error", err)
			}
			c.log.Info("connected to WhatsApp")
		case *events.LoggedOut:
			c.log.Error("the number was unlinked from WhatsApp; restart the bot to link it again")
			loggedOut()
		}
	})

	if c.wa.Store.ID != nil {
		return c.wa.Connect()
	}
	codes, err := c.wa.GetQRChannel(ctx)
	if err != nil {
		return err
	}
	if err := c.wa.Connect(); err != nil {
		return err
	}
	for item := range codes {
		switch item.Event {
		case whatsmeow.QRChannelEventCode:
			c.log.Info("link the Nemu number: WhatsApp › Perangkat tertaut › Tautkan perangkat, then scan this QR code", "expiresIn", item.Timeout.String())
			qrterminal.GenerateHalfBlock(item.Code, qrterminal.L, os.Stdout)
		case whatsmeow.QRChannelSuccess.Event:
			c.log.Info("number linked")
			return nil
		default:
			return fmt.Errorf("linking stopped: %s %v", item.Event, item.Error)
		}
	}
	return errors.New("linking stopped before a QR code was scanned")
}

func (c *Client) Disconnect() { c.wa.Disconnect() }

// photoFrom keeps images (and images sent as documents, which keep full quality) from one-to-one
// chats, and resolves the sender's phone number.
func (c *Client) photoFrom(ctx context.Context, evt *events.Message) (bot.Photo, bool) {
	info := evt.Info
	if info.IsFromMe || info.IsGroup || info.Chat.Server == types.BroadcastServer {
		return bot.Photo{}, false
	}
	if downloadable(evt) == nil {
		return bot.Photo{}, false
	}
	phone, err := c.phoneOf(ctx, info.MessageSource)
	if err != nil {
		c.log.Warn("could not resolve the sender's number", "messageId", info.ID, "error", err)
		return bot.Photo{}, false
	}
	return bot.Photo{MessageID: info.ID, Phone: phone, Ref: evt}, true
}

func downloadable(evt *events.Message) whatsmeow.DownloadableMessage {
	if image := evt.Message.GetImageMessage(); image != nil {
		return image
	}
	if doc := evt.Message.GetDocumentMessage(); doc != nil && strings.HasPrefix(doc.GetMimetype(), "image/") {
		return doc
	}
	return nil
}

// phoneOf returns the sender's number. WhatsApp increasingly addresses people by a hidden id
// (LID) instead of their number, so it falls back to the alternative address and the LID map.
func (c *Client) phoneOf(ctx context.Context, source types.MessageSource) (string, error) {
	for _, jid := range []types.JID{source.Sender, source.SenderAlt} {
		if jid.Server == types.DefaultUserServer {
			return jid.User, nil
		}
	}
	if source.Sender.Server == types.HiddenUserServer {
		pn, err := c.wa.Store.LIDs.GetPNForLID(ctx, source.Sender.ToNonAD())
		if err != nil {
			return "", err
		}
		if !pn.IsEmpty() {
			return pn.User, nil
		}
	}
	return "", fmt.Errorf("no phone number for %s", source.Sender.Server)
}

func message(photo bot.Photo) *events.Message {
	return photo.Ref.(*events.Message)
}

func (c *Client) MarkRead(ctx context.Context, photo bot.Photo) error {
	evt := message(photo)
	return c.wa.MarkRead(ctx, []types.MessageID{evt.Info.ID}, time.Now(), evt.Info.Chat, evt.Info.Sender)
}

func (c *Client) SetTyping(ctx context.Context, photo bot.Photo, typing bool) error {
	state := types.ChatPresencePaused
	if typing {
		state = types.ChatPresenceComposing
	}
	return c.wa.SendChatPresence(ctx, message(photo).Info.Chat, state, types.ChatPresenceMediaText)
}

func (c *Client) Download(ctx context.Context, photo bot.Photo, dst *os.File) error {
	return c.wa.DownloadToFile(ctx, downloadable(message(photo)), dst)
}

func (c *Client) Reply(ctx context.Context, photo bot.Photo, text string) error {
	_, err := c.wa.SendMessage(ctx, message(photo).Info.Chat, &waE2E.Message{Conversation: proto.String(text)})
	return err
}
