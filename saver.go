package main

import (
	"log"
	//"bytes"
	"image"
	//"image/color"
	//"io"
	//"encoding/json"
	"fmt"
	//"image/draw"
	"image/png"
	"os"
	"path/filepath"
	//"errors"
	"strconv"
)

// practically a goroutine that linearizes write and load access

type Saver struct {
	dim    image.Rectangle
	save   chan SaveStruct
	load   chan LoadStruct
	delete chan LoadStruct

	back chan image.Image
}

type SaveStruct struct {
	dir   string
	fname int
	// make sure this is already a copy!
	im *image.RGBA
}

type LoadStruct struct {
	dir   string
	fname int
}

func newSaver(rect image.Rectangle) *Saver {
	s := &Saver{
		rect,
		make(chan SaveStruct),
		make(chan LoadStruct),
		make(chan LoadStruct),
		make(chan image.Image),
	}
	go s.saveRoutine()
	return s
}

func (s *Saver) saveRoutine() {

	last := SaveStruct{
		"",
		-1,
		image.NewRGBA(s.dim),
	}

	for {
		select {
		case sa := <-s.save:

			last = sa

			// save last to disk
			err := os.MkdirAll(last.dir, 0777)
			if err != nil {
				fmt.Println(err)
			}

			pa := filepath.Join(last.dir, strconv.Itoa(last.fname))
			fmt.Println("saving to ", pa)
			file, err := os.Create(pa)
			if err != nil {
				log.Fatal(err)
			}

			err = png.Encode(file, last.im)
			if err != nil {
				log.Fatal(err)
			}

			file.Close()

		case lo := <-s.load:

			if lo.dir == last.dir && lo.fname == last.fname {
				s.back <- last.im
				fmt.Println("from mem")
			} else {

				file, err := os.Open(filepath.Join(lo.dir, strconv.Itoa(lo.fname)))
				if err != nil {
					fmt.Println(err)
					return
				}

				l, err := png.Decode(file)
				if err != nil {
					fmt.Println(err)
					return
				}

				s.back <- l
				fmt.Println("from disk")
			}
		case de := <-s.delete:
			os.Remove(filepath.Join(de.dir, strconv.Itoa(de.fname)))
		}
	}

}
