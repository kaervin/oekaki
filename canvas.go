package main

import (
	"fmt"
	"image"
	//"errors"
	"image/draw"
	"strconv"
)

type Canvas struct {
	name string

	// this is the canvas image. It contains what is currently on the layer
	Rgbas []image.RGBA
	// this is the "back" image, meaning it is the image of confirmed (not undoable) drawcalls
	// it is there so that we always have a state from which we can rebuild our stuff
	// (without writing new images to disk too often)
	// uses up memory, but it can't be helped
	Back []image.RGBA
	lnum int // == len(Rgbas) just for convenience of writing
	rect image.Rectangle

	// History stuff
	cap     int        // number of elements
	next    int        // cur position in Ring
	his     []DrawCall // used as a circular buffer
	history []DrawCall // just so that I can see the errors that I want. Is to be removed
	nops    []int      // number of operations that have acted upon a layer

	sav *Saver
}

func NewCanvas(name string, cap, lnum int, rect image.Rectangle) *Canvas {

	rgbas := make([]image.RGBA, 0, lnum)
	back := make([]image.RGBA, 0, lnum)

	for i := 0; i < lnum; i++ {
		rgbas = append(rgbas, *image.NewRGBA(rect))
		back = append(back, *image.NewRGBA(rect))

	}

	his := make([]DrawCall, cap, cap)

	return &Canvas{
		name,
		rgbas,
		back,
		lnum,
		rect,
		cap,
		0,
		his,
		make([]DrawCall, 0, cap),
		make([]int, lnum, lnum),
		newSaver(rect),
	}
}

func (c *Canvas) append(d DrawCall) {

	// here we are caching every so often by saving the contents of the affected layer
	if d.lay() != -1 {
		c.nops[d.lay()]++

		c.nops[d.lay()] = c.nops[d.lay()] % c.cap

		if (c.nops[d.lay()] % 4000) == 0 {
			svd := SavedImage{c.rect, c.name + "/" + strconv.Itoa(c.nops[d.lay()]), 0, d.lay()}
			svd.applyCanvas(c)
		}
	}

	dc := c.relAt(1)

	switch si := dc.(type) {
	case nil:
		break
	case *SavedImage:

		c.sav.delete <- LoadStruct{
			si.path,
			si.lnum,
		}
	default:

		dc.applyLayer(c.Back, c.rect)
	}

	c.his[c.next] = d
	c.next = (c.next + 1) % c.cap

}

// at relative to the current drawcall
func (c *Canvas) relAt(i int) DrawCall {

	var x = (c.next - 1 + i + 2*c.cap) % c.cap
	return c.his[x]
}

// set relative to the current drawcall
func (c *Canvas) relSet(i int, d DrawCall) {

	var x = (c.next - 1 + i + 2*c.cap) % c.cap
	c.his[x] = d
}

// the int is for identifying which layer this is, and consequently from where we have to load a savedImage
func (c *Canvas) rebuildRect(lnum int, rect image.Rectangle) error {

	fmt.Println("rebuildRect start")
	if rect.Empty() {
		return nil
	}

	fmt.Println("find first savedImage")
	// find first savedImage
	svd := -c.cap

	for i := 0; i > -c.cap; i-- {

		dc := c.relAt(i)
		if dc == nil {
			continue
		}

		switch si := dc.(type) {
		case *SavedImage:
			fmt.Println("there is:", si.path, " ,", si.lnum)
			if si.lnum != lnum {
				continue
			}
			fmt.Println("creating rgba from: ", i)
			svd = i

			c.sav.load <- LoadStruct{
				si.path,
				si.lnum,
			}

			ba := <-c.sav.back
			draw.Draw(&c.Rgbas[lnum], rect, ba, rect.Min, draw.Src)

			goto Found
		}

	}

Found:

	if svd == -c.cap {
		draw.Draw(&c.Rgbas[lnum], rect, &c.Back[lnum], rect.Min, draw.Src)
	}

	for i := svd + 1; i <= 0; i++ {

		dc := c.relAt(i)
		if dc == nil {
			continue
		}

		if dc.lay() == lnum {
			dc.applyLayer(c.Rgbas, rect)
		}
	}

	return nil
}
