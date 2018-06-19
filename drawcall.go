package main

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	//"strconv"
	"time"
)

// DrawCall is the interface on which this whole thing is build on
// Basically we receive DrawCalls for specific tasks, such as drawing a line, or undoing the last action
// we apply it (in applyMessage) and store it in a slice (Canvas History)
// when something needs to be undone, we can reconstruct the canvas into a state where the action did not happen
// This process is faster thanks to storing the state of the canvas every so often,
// since we then can just reconstruct from the saved state

type DrawCall interface {
	// applyCanvas applied the DrawCall to the Canvas, generally in the form of drawing to the inMemory Image (applyLayer) and saving to History
	// Some DrawCalls, like Undo, take a different form though
	// it returns what should be sent to the clients
	applyCanvas(*Canvas) []byte
	// applyLayer draws the DrawCall to the Layer lay(), but does nothing if the potentially affected area is not inside the Rectangle
	applyLayer([]image.RGBA, image.Rectangle)
	// affects the area affected by this drawcall in the appropriate layer
	// the area is represented as a rectangle
	affect([]image.Rectangle)

	// user functionality so that we can differentiate DrawCalls by Users (mainly for Undo)
	user() int64
	setuser(int64)

	lay() int
}

// a simple Line drawing
type Line struct {
	X0, Y0, X1, Y1, Size, Layer int
	R, G, B, A                  uint8
	uid                         int64
}

// A point in history, which tells us untill when to undo
type UndoPoint struct {
	uid int64
}

// Just an Undo message, but also what we set undone DrawCalls to
type Undo struct {
	uid int64
}

// our saved State, from which we can rebuild the Canvas
type SavedImage struct {
	rect image.Rectangle
	path string
	nr   int
	lnum int
}

// Just a simple Cursor Update for some user
type Cursor struct {
	X, Y int
}

type Fill struct {
	X, Y, Layer int
	All         bool
	R, G, B, A  uint8
	mask        *image.Alpha
	uid         int64
}

// The interface functions of the various DrawCalls will now follow

func (l *Line) applyCanvas(c *Canvas) []byte {

	l.applyLayer(c.Rgbas, c.rect)
	c.append(l)

	return nil
}

func (l *Line) applyLayer(rgbas []image.RGBA, rect image.Rectangle) {

	rgba := &rgbas[l.lay()]

	// check if line is inside rect
	minx := min(l.X0, l.X1)
	maxx := max(l.X0, l.X1)
	miny := min(l.Y0, l.Y1)
	maxy := max(l.Y0, l.Y1)

	aff := image.Rect(minx-14, miny-14, maxx+16, maxy+16)

	if !aff.Overlaps(rect) {
		return
	}

	plotLine(rgba, l.X0, l.Y0, l.X1, l.Y1, l.Size, color.RGBA{l.R, l.G, l.B, l.A})
}

func (l *Line) affect(rects []image.Rectangle) {

	minx := min(l.X0, l.X1)
	maxx := max(l.X0, l.X1)

	miny := min(l.Y0, l.Y1)
	maxy := max(l.Y0, l.Y1)

	rect := image.Rect(minx-14, miny-14, maxx+16, maxy+16)

	if rects[l.Layer] != image.ZR {
		rects[l.Layer] = rects[l.Layer].Union(rect)
	} else {
		rects[l.Layer] = rect
	}
}

func (l *Line) user() int64 {
	return l.uid
}

func (l *Line) setuser(uid int64) {
	l.uid = uid
}

func (l *Line) lay() int {
	return l.Layer
}

func (l *Line) String() string {
	return fmt.Sprint("Line: ", *l, "\n")
}

func (u *UndoPoint) applyCanvas(c *Canvas) []byte {
	c.append(u)
	return nil
}

func (u *UndoPoint) applyLayer(rgbas []image.RGBA, rect image.Rectangle) {
}

func (u *UndoPoint) affect(rects []image.Rectangle) {
}

func (u *UndoPoint) user() int64 {
	return u.uid
}

func (u *UndoPoint) setuser(uid int64) {
	u.uid = uid
}

func (u *UndoPoint) lay() int {
	return -1
}

func (u *UndoPoint) String() string {
	return fmt.Sprint("UndoPoint: ", *u, "\n")
}

// applyCanvas for Undo, rewrites all the DrawCalls for a specific User before the last UndoPoint
// and then rebuild the Canvas with this information
func (u *Undo) applyCanvas(c *Canvas) []byte {

	// TODO: could add a drawcall which shows the first appearance of the user
	// This way we have a better stop condition for the undo-loop when the user hasn't drawn anything
	// But we could also ensure in Javascript that a User won't press Undo before drawing
	// or both

	start := time.Now()

	urect := make([]image.Rectangle, 4, 4)
	for i := 0; i < len(urect); i++ {
		urect[i] = image.ZR
	}

	// index of smallest affected DrawCall (Undopoint)
	// this way we also know if there was something that potentially needs deleting
	mindx := -c.cap

	for i := 0; i > -c.cap; i-- {

		dc := c.relAt(i)
		if dc == nil {
			continue
		}

		if dc.user() == u.user() {

			switch dc.(type) {
			case *UndoPoint:
				c.relSet(i, &Undo{})
				mindx = i
				goto Found
			default:
				dc.affect(urect)
				c.relSet(i, &Undo{})
			}
		}
	}

Found:

	// see which layer was affected
	aff := -1

	for i := 0; i < c.lnum; i++ {
		if urect[i].Empty() {
			continue
		}
		aff = i
	}

	if aff == -1 {
		return nil
	}

	pt := time.Since(start)
	fmt.Println("find time: ", pt)
	start2 := time.Now()

	// delete the SavedImages
	if mindx != c.cap {
		for i := 0; i > mindx; i-- {

			dc := c.relAt(i)
			if dc == nil {
				continue
			}

			switch si := dc.(type) {
			case *SavedImage:
				if dc.lay() != aff {
					continue
				}
				c.sav.delete <- LoadStruct{
					si.path,
					si.lnum,
				}
				c.relSet(i, &Undo{})
			}
		}
	}

	pt = time.Since(start2)
	fmt.Println("del time: ", pt)
	start3 := time.Now()

	fmt.Println("we are rebuilding layer: ", aff)
	fmt.Println("urect ", urect[aff])
	err := c.rebuildRect(aff, urect[aff])

	if err != nil {
		fmt.Println(err)
		return nil
	}

	pt = time.Since(start3)
	fmt.Println("rebuild time: ", pt)
	start4 := time.Now()

	r := c.Rgbas
	var outm OutMessage

	outm.Cu = RgbaToClearUpdate(urect[aff], &r[aff], true, aff)

	pt = time.Since(start4)
	fmt.Println("clearupdate time: ", pt)
	start5 := time.Now()

	outj, err := json.Marshal(outm)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	pt = time.Since(start5)
	fmt.Println("json time: ", pt)

	pt = time.Since(start)
	fmt.Println("Undo time: ", pt)
	return outj
}

func (u *Undo) applyLayer(rgbas []image.RGBA, rect image.Rectangle) {
}

func (u *Undo) affect(rects []image.Rectangle) {
}

func (u *Undo) user() int64 {
	return u.uid
}

func (u *Undo) setuser(uid int64) {
	u.uid = uid
}

func (u *Undo) lay() int {
	return -1
}

func (u *Undo) String() string {
	return fmt.Sprint("Undo: ", *u, "\n")
}

// saves the in lnum specified layer to disk
func (s *SavedImage) applyCanvas(c *Canvas) []byte {

	// TODO: find a good way to not generate a new image every save and relieve the garbage collector of stress
	ni := image.NewRGBA(c.Rgbas[s.lnum].Bounds())
	copy(ni.Pix, c.Rgbas[s.lnum].Pix)

	c.sav.save <- SaveStruct{
		s.path,
		s.lnum,
		ni,
	}

	c.append(s)
	return nil
}

func (s *SavedImage) applyLayer(rgbas []image.RGBA, rect image.Rectangle) {
}

// TODO: think about what this really needs to affect
func (s *SavedImage) affect(rects []image.Rectangle) {
}

func (s *SavedImage) user() int64 {
	return 0
}

func (s *SavedImage) setuser(uid int64) {
}

func (s *SavedImage) lay() int {
	return s.lnum
}

func (s *SavedImage) String() string {
	return fmt.Sprint("SavedImage\n")
}

// applyCanvas for fill, fill an area, and then send the changed Pixels to everyone as a png
func (f *Fill) applyCanvas(c *Canvas) []byte {

	rect := c.Rgbas[f.Layer].Bounds().Intersect(image.Rect(f.X-100, f.Y-100, f.X+100, f.Y+100))

	// comb is the image we are working with to detect if we should overwrite a pixel or not
	var comb *image.RGBA

	if f.All {
		comb = image.NewRGBA(rect)
		for i := 0; i < len(c.Rgbas); i++ {
			draw.Draw(comb, comb.Bounds(), &c.Rgbas[i], comb.Bounds().Min, draw.Over)
		}
	} else {
		comb = &c.Rgbas[f.Layer]
	}

	mask := FillImage(comb, rect, image.Point{f.X, f.Y}, color.RGBA{f.R, f.G, f.B, f.A})

	src := &image.Uniform{color.RGBA{f.R, f.G, f.B, f.A}}

	dest := image.NewRGBA(rect)

	// now draw the color src onto dest via the alpha mask
	draw.DrawMask(dest, rect , src, image.ZP, mask, mask.Bounds().Min, draw.Over)

	draw.Draw(&c.Rgbas[f.Layer], dest.Bounds(), dest, dest.Bounds().Min, draw.Over)

	var outm OutMessage

	outm.Cu = RgbaToClearUpdate(rect, dest, false, f.Layer)

	outj, err := json.Marshal(outm)
	if err != nil {
		fmt.Println(err)
	}

	f.mask = mask

	c.append(&UndoPoint{f.uid})
	c.append(f)

	return outj
}

func (f *Fill) applyLayer(rgbas []image.RGBA, rect image.Rectangle) {

	mbnds := f.mask.Bounds()

	if !mbnds.Overlaps(rect) {
		return
	}

	src := &image.Uniform{color.RGBA{f.R, f.G, f.B, f.A}}

	dest := image.NewRGBA(mbnds)

	// now draw the color src onto dest via the alpha mask
	draw.DrawMask(dest, mbnds , src, image.ZP, f.mask, mbnds.Min, draw.Over)

	draw.Draw(&rgbas[f.lay()], mbnds, dest, mbnds.Min, draw.Over)

}

func (f *Fill) affect(rects []image.Rectangle) {
	rect := image.Rect(f.X-100, f.Y-100, f.X+100, f.Y+100)

	if rects[f.Layer] != image.ZR {
		rects[f.Layer] = rects[f.Layer].Union(rect)
	} else {
		rects[f.Layer] = rect
	}
}

func (f *Fill) user() int64 {
	return f.uid
}

func (f *Fill) setuser(uid int64) {
	f.uid = uid
}

func (f *Fill) lay() int {
	return f.Layer
}

// simple Bresenham line drawing with css scaling in mind
// here http://members.chello.at/easyfilter/bresenham.html are more algos for future reference
// TODO: usual case isn't that one line gets applied, but multiple, maybe we can use this for optimization at some point
// TODO2: The usual case isn't also that singular Dab gets applied.
// Just repeating the 15th colum and row (at least for a circle) along the axis at every point could be a good optimization, since we set a lot less pixels this way
// the question is, if this makes the whole thing much faster, or if there are other things that should be optimized first
func plotLine(r *image.RGBA, x0, y0, x1, y1, size int, col color.Color) {

	size = min(max(1, size), 10)

	var dx = abs(x1 - x0)
	var sx, sy, e2 int
	if x0 < x1 {
		sx = 1
	} else {
		sx = -1
	}

	var dy = -abs(y1 - y0)
	if y0 < y1 {
		sy = 1
	} else {
		sy = -1
	}

	var err = dx + dy

	for {

		if (col == color.RGBA{0, 0, 0, 0}) {
			Erase(r, &dabs[size-1], image.Point{x0 - 15, y0 - 15})
		} else {
			draw.DrawMask(r, image.Rect(x0-15, y0-15, x0+15, y0+15), &image.Uniform{col}, image.ZP, &dabs[size-1], image.ZP, draw.Over)
		}

		if x0 == x1 && y0 == y1 {
			break
		}
		e2 = 2 * err
		if e2 >= dy {
			err += dy
			x0 += sx
		}
		if e2 <= dx {
			err += dx
			y0 += sy
		}
	}

}

// erase where the mask is opaque
// also never use with nil mask
func Erase(dst *image.RGBA, mask *image.Alpha, p image.Point) {

	x0, x1 := p.X, min(p.X+mask.Rect.Max.X, dst.Rect.Max.X)
	y0, y1 := p.Y, min(p.Y+mask.Rect.Max.Y, dst.Rect.Max.Y)

	my := 0
	for y := y0; y < y1; y, my = y+1, my+1 {
		mx := 0
		for x := x0; x < x1; x, mx = x+1, mx+1 {

			ma := mask.AlphaAt(mx, my).A

			switch {
			case ma == 0:
				// No-op.
			case ma == 255:
				dst.SetRGBA(x, y, color.RGBA{0, 0, 0, 0})
			default:
				// ignore the rest
			}
		}
	}
}

// A function for filling in an area of a single color
// returns what we have filled as an image; Doing it this way assures, that even if the History changes, the filled content stays the same
// This also means that we have to watch out for memory used by DrawCall history more
// compressing and/or storing on disk could be a potentially good idea, but would increase the time needed for an undo greatly (which is already the most taxing of actions)
// TODO: think about it some more
func FillImage(img *image.RGBA, r image.Rectangle, p image.Point, col color.RGBA) *image.Alpha {

	dest := image.NewAlpha(r)

	cat := img.RGBAAt(p.X, p.Y)

	next := make([]image.Point, 0, 100)

	next = append(next, p)

	for {

		if len(next) == 0 {
			break
		}

		cur := next[len(next)-1]
		next = next[0 : len(next)-1]

		catp := img.RGBAAt(cur.X, cur.Y)
		if catp != cat || !cur.In(r) || dest.AlphaAt(cur.X, cur.Y).A != 0 {
			continue
		}

		dest.Set(cur.X, cur.Y, color.Opaque)

		next = append(next, image.Point{cur.X, cur.Y + 1})
		next = append(next, image.Point{cur.X - 1, cur.Y})
		next = append(next, image.Point{cur.X, cur.Y - 1})
		next = append(next, image.Point{cur.X + 1, cur.Y})

	}
	return dest
}
