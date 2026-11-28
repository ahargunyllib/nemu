// Package thumbnail makes the small copy of a grade-book photo that the extension's
// "Foto dari WhatsApp" card shows before the teacher presses Mulai (#278). It is made here, at
// hand-off, because the bot already holds the full photo and Go decodes it natively; the Worker
// would need a paid image service or a slow pure-JS decoder to do the same.
package thumbnail

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // Photos sent as documents may be PNG.
	"io"
)

// LongSide is the thumbnail's longest edge in pixels: sharp at twice the card's size.
const LongSide = 320

// maxPixels refuses images too big to decode safely (a small file can claim huge dimensions).
const maxPixels = 50_000_000

const quality = 75

// ErrTooLarge is returned for an image whose dimensions exceed maxPixels.
var ErrTooLarge = errors.New("thumbnail: image too large to decode")

// Make returns a JPEG no longer than LongSide on either edge. Formats Go can't decode (WebP)
// return an error; the caller then hands the photo over without a thumbnail.
func Make(photo io.ReadSeeker) ([]byte, error) {
	config, _, err := image.DecodeConfig(photo)
	if err != nil {
		return nil, err
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width*config.Height > maxPixels {
		return nil, ErrTooLarge
	}
	if _, err := photo.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	src, _, err := image.Decode(photo)
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, shrink(src, LongSide), &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// shrink scales src down so its long side is at most longSide, averaging each block of source
// pixels (a box filter), which keeps thin handwriting from aliasing away.
func shrink(src image.Image, longSide int) image.Image {
	bounds := src.Bounds()
	sw, sh := bounds.Dx(), bounds.Dy()
	dw, dh := sw, sh
	if sw >= sh && sw > longSide {
		dw, dh = longSide, max(1, sh*longSide/sw)
	} else if sh > sw && sh > longSide {
		dw, dh = max(1, sw*longSide/sh), longSide
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		y0, y1 := y*sh/dh, max((y+1)*sh/dh, y*sh/dh+1)
		for x := 0; x < dw; x++ {
			x0, x1 := x*sw/dw, max((x+1)*sw/dw, x*sw/dw+1)
			var r, g, b, n uint64
			for sy := y0; sy < y1; sy++ {
				for sx := x0; sx < x1; sx++ {
					pr, pg, pb, _ := src.At(bounds.Min.X+sx, bounds.Min.Y+sy).RGBA()
					r, g, b, n = r+uint64(pr), g+uint64(pg), b+uint64(pb), n+1
				}
			}
			dst.SetRGBA(x, y, color.RGBA{uint8(r / n >> 8), uint8(g / n >> 8), uint8(b / n >> 8), 0xff})
		}
	}
	return dst
}
