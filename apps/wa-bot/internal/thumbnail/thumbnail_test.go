package thumbnail

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func photo(t *testing.T, w, h int, encode func(*bytes.Buffer, image.Image) error) *bytes.Reader {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 0x80, 0xff})
		}
	}
	var buf bytes.Buffer
	if err := encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return bytes.NewReader(buf.Bytes())
}

func encodeJPEG(buf *bytes.Buffer, img image.Image) error { return jpeg.Encode(buf, img, nil) }
func encodePNG(buf *bytes.Buffer, img image.Image) error  { return png.Encode(buf, img) }

func size(t *testing.T, thumb []byte) image.Point {
	t.Helper()
	config, format, err := image.DecodeConfig(bytes.NewReader(thumb))
	if err != nil || format != "jpeg" {
		t.Fatalf("thumbnail is not a JPEG: %v %q", err, format)
	}
	return image.Pt(config.Width, config.Height)
}

func TestShrinksALandscapePhotoToTheLongSide(t *testing.T) {
	thumb, err := Make(photo(t, 1600, 1200, encodeJPEG))
	if err != nil {
		t.Fatal(err)
	}
	if got := size(t, thumb); got != image.Pt(320, 240) {
		t.Fatalf("size %v, want 320x240", got)
	}
}

func TestShrinksAPortraitPNGToAJPEG(t *testing.T) {
	thumb, err := Make(photo(t, 600, 1000, encodePNG))
	if err != nil {
		t.Fatal(err)
	}
	if got := size(t, thumb); got != image.Pt(192, 320) {
		t.Fatalf("size %v, want 192x320", got)
	}
}

func TestKeepsASmallPhotoAtItsSize(t *testing.T) {
	thumb, err := Make(photo(t, 200, 100, encodeJPEG))
	if err != nil {
		t.Fatal(err)
	}
	if got := size(t, thumb); got != image.Pt(200, 100) {
		t.Fatalf("size %v, want 200x100", got)
	}
}

func TestRefusesWhatIsNotAnImage(t *testing.T) {
	if _, err := Make(bytes.NewReader([]byte("%PDF-1.7"))); err == nil {
		t.Fatal("made a thumbnail of a PDF")
	}
}
