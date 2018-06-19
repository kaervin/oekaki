package main

import (
	"bytes"
	"image"
	"log"
	//"image/color"
	//"io"
	"encoding/json"
	"fmt"
	"image/draw"
	"image/png"
	"os"
	//"path/filepath"
	"errors"
	"math/rand"
	//"strconv"
	"html"
	"time"
)

// Room maintains the set of active clients and broadcasts messages to the
// clients.
type Room struct {
	// name is also the path to its images
	Name string

	// Registered clients.
	clients map[*Client]bool

	// names that are taken, for looking up if a name can be used
	names map[string]int64

	// names that clients have, for looking up clients names
	idnames map[int64]string

	// the connections (represented via *Client) that have a specific identifier
	conns map[int64]map[*Client]bool

	bans map[int64]bool

	// Inbound messages from the clients.
	broadcast chan Broadcast

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// tell this routine to close down
	close chan struct{}

	adminid int64

	c *Canvas

	empty chan *Room

	unempty chan *Room

	timer *time.Timer

	permanent bool
}

func newRoom(name string, width, height, lnum int, perm bool, empty chan *Room, unempty chan *Room) *Room {

	return &Room{
		Name:       name,
		broadcast:  make(chan Broadcast, 1),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		names:      make(map[string]int64),
		idnames:    make(map[int64]string),
		conns:      make(map[int64]map[*Client]bool),
		bans:       make(map[int64]bool),
		close:      make(chan struct{}),
		adminid:    -1,
		c:          NewCanvas(name, 50000, lnum, image.Rect(0, 0, width, height)),
		empty:      empty,
		unempty:    unempty,
		timer:      time.NewTimer(time.Minute), // the initial time to register
		permanent:  perm,
	}
}

// Broadcast is the type of inbound messages
type Broadcast struct {
	client *Client
	bytes  []byte
}

// some simple arithmetic functions

func abs(x int) int {
	if x < 0 {
		return (x * -1)
	}
	return x
}

func max(a, b int) int {
	if a < b {
		return b
	}
	return a
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// the json message we can receive
type InMessage struct {
	PLine      *Line      `json:"PLine,omitempty"`
	UndoPoint  *UndoPoint `json:"UndoPoint,omitempty"`
	Undo       *Undo      `json:"Undo,omitempty"`
	User       string     `json:"User,omitempty"`
	NameChange string     `json:"NameChange,omitempty"`
	Cursor     *Cursor    `json:"Cursor,omitempty"`
	Fill       *Fill      `json:"Fill,omitempty"`
	Text       string     `json:"Text,omitempty"`
	Ban        string     `json:"Ban,omitempty"`
	Unban      string     `json:"Unban,omitempty"`
}

// the json message/type we can send out
type OutMessage struct {
	Cs *CanvasSize  `json:"canvasSize,omitempty"`
	Cu *ClearUpdate `json:"clearUpdate,omitempty"`

	// A "secret" (not really) string which identifies users across sessions
	// This way even after refreshing you can still undo your changes
	Ud string `json:"userIdent,omitempty"`

	//PLine *Line `json:"Line,omitempty"`
	Cursor *Cursor `json:"Cursor,omitempty"`
	User   string  `json:"User,omitempty"`
}

// practically an init message for the Client
type CanvasSize struct {
	X, Y, N int
}

// a Png canvas update for the cloent
type ClearUpdate struct {
	// placing point
	X, Y int
	// png Data
	Png []byte
	// should the area be cleared beforehand
	Clear bool

	Layer int
}


func (r *Room) unregist(c *Client) {

	if _, ok := r.clients[c]; ok {
		delete(r.clients, c)
		close(c.send)
	}

	cs, ok := r.conns[c.id]

	if ok {
		delete(cs, c)
	}

	// if no one with that id is there anymore, then tell everyone to unregister him
	if len(cs) == 0 {
		for cl := range r.clients {
			select {
			case cl.send <- []byte("{ \"unregister\": \"" + r.idnames[c.id] + "\" }"):
			default:
				fmt.Println("user ", cl.id, "disconnected in default case of client := <-r.unregister:")
				close(cl.send)
				delete(r.clients, cl)
			}
		}
	}

	if len(r.clients) == 0 && !r.permanent {
		r.timer.Reset(time.Minute * 10)
	}
}

// applyMessage parses the message/json to the corresponding type, and then applies it
// afterwards changes the json message in b to include the User
// the returned bool tells the calling function if the message should also get send to the client who sent the message
func (r *Room) applyMessage(b *[]byte, uid int64, c *Client) ([]byte, []byte, error, bool) {

	var m InMessage
	err := json.Unmarshal(*b, &m)
	if err != nil {
		fmt.Println(err)
		return nil, nil, err, false
	}

	if uid == r.adminid && m.User != "" && m.Undo != nil {
		id, ok := r.names[m.User]

		if !ok {
			return nil, nil, errors.New("Can't find user" + m.User), false
		}

		m.Undo.setuser(id)
		outj := m.Undo.applyCanvas(r.c)
		return *b, outj, nil, false
	}

	if uid == r.adminid && m.Ban != "" {

		id := r.names[m.Ban]
		if id != 0 {
			if cs, ok := r.conns[id]; ok {
				for c := range cs {
					delete(r.clients, c)
					close(c.send)
				}
			}

			r.bans[id] = true
		}
	}

	if uid == r.adminid && m.Unban != "" {

		if m.Unban == "all" {
			r.bans = make(map[int64]bool)
		} else {
			id := r.names[m.Unban]
			if id != 0 {
				delete(r.bans, id)
			}
		}
	}

	if m.Cursor != nil {

		name := r.idnames[uid]

		out := OutMessage{
			User:   name,
			Cursor: m.Cursor,
		}

		jb, err := json.Marshal(out)
		if err != nil {
			return nil, nil, err, false
		}
		return jb, nil, nil, false
	}

	if m.PLine != nil {

		if m.PLine.Size > 10 || m.PLine.Size < 0 {
			return nil, nil, errors.New("Pline Size is not valid"), false
		}

		if m.PLine.Layer >= r.c.lnum || m.PLine.Layer < 0 {
			return nil, nil, errors.New("Pline Layer is not valid"), false
		}

		m.PLine.setuser(uid)
		m.PLine.applyCanvas(r.c)

		m.User = r.idnames[uid]

		jb, err := json.Marshal(m)
		if err != nil {
			return nil, nil, err, false
		}
		return jb, nil, nil, true
	}

	if m.Fill != nil {

		if m.Fill.Layer >= r.c.lnum || m.Fill.Layer < 0 {
			return nil, nil, errors.New("Fill Layer is not valid"), false
		}

		m.Fill.setuser(uid)
		outj := m.Fill.applyCanvas(r.c)

		m.User = r.idnames[uid]
		return nil, outj, nil, true
	}

	if m.UndoPoint != nil {
		m.UndoPoint.setuser(uid)
		m.UndoPoint.applyCanvas(r.c)
		return nil, nil, nil, true
	}

	if m.Undo != nil {
		m.Undo.setuser(uid)
		outj := m.Undo.applyCanvas(r.c)

		m.User = r.idnames[uid]

		jb, err := json.Marshal(m)
		if err != nil {
			return nil, nil, err, false
		}
		return jb, outj, nil, true
	}

	if m.Text != "" {
		if len(m.Text) > 300 {
			return nil, nil, errors.New("Message is too long"), false
		}
		m.Text = html.EscapeString(m.Text)
		m.User = r.idnames[uid]

		jb, err := json.Marshal(m)
		if err != nil {
			return nil, nil, err, false
		}
		return jb, nil, nil, true
	}

	if m.NameChange != "" {
		if len(m.NameChange) > 5 {
			return nil, nil, errors.New("name: " + m.NameChange + " is not a valid name, 5 characters is the limit"), false
		}
		if id, ok := r.names[m.NameChange]; ok && id != uid {
			return nil, nil, errors.New("name: " + m.NameChange + " is already in use"), false
		}

		lastname := r.idnames[uid]

		r.names[m.NameChange] = uid
		r.idnames[uid] = m.NameChange

		return []byte("{ \"NameChange\": { \"from\": \"" + lastname + "\", \"to\": \"" + m.NameChange + "\" } }"), nil, nil, true
	}
	// TODO: this shouldn't fall through in
	return *b, nil, nil, true
}

// takes a rectangle from the supplied RGBA, converts it to png and sends a Update
func RgbaToClearUpdate(r image.Rectangle, rgba *image.RGBA, clr bool, layer int) *ClearUpdate {

	var b bytes.Buffer

	dest := image.NewRGBA(r)

	draw.Draw(dest, r, rgba, r.Min, draw.Src)

	enc := png.Encoder{png.BestSpeed, nil}

	fmt.Println("RgbaToClearUpdate")
	err := enc.Encode(&b, dest)
	if err != nil {
		log.Fatal(err)
		return nil
	}

	return &ClearUpdate{r.Min.X, r.Min.Y, b.Bytes(), clr, layer}
}

// from: https://stackoverflow.com/questions/22892120/how-to-generate-a-random-string-of-a-fixed-length-in-golang
// a simple way to generate a random string
const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func RandStringBytes(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return string(b)
}

// TODO: just closing when a client doesn't receive anymore seems kind of stupid and will lead to bugs
// increasing the buffer size for the  send channel is a possibilty to mitigate this, but I don't know if it will completely fix it
// the question is: whats the alternative?
func (room *Room) run() {

	if room.permanent {
		room.timer.Stop()
	}

	for {
Next:
		select {
		case <- room.timer.C:
			room.empty <- room

		case <-room.close:
			for cl := range room.clients {
				close(cl.send)
			}
			os.RemoveAll(room.Name)
			return

		case client := <-room.register:

			// give the canvas size so that the client can create the appropriate Canvas
			var outm OutMessage
			outm.Cs = &CanvasSize{room.c.rect.Dx(), room.c.rect.Dy(), room.c.lnum}

			outj, err := json.Marshal(outm)
			if err != nil {
				fmt.Println(err)
			}
			client.send <- outj

			outm.Cs = nil

			// figure out if the client will be the admin
			if room.adminid == -1 {
				room.adminid = client.id
			}
			// and if he is, tell him that
			if room.adminid == client.id {
				client.send <- []byte("{ \"admin\": true }")
			} else {
			// if he isn't the admin, check if hes banned
				if _, ok := room.bans[client.id]; ok {
					client.send <- []byte("{\"error\": \"You are banned from this Room!\" }")
					close(client.send)
					goto Next
				}
			}

			var nname string

			// if we don't already have a name for this id, then generate one
			if n, ok := room.idnames[client.id]; ok {
				nname = n
			} else {

				// generate a unique name
				for i := 3; ; i++ {

					nname = RandStringBytes(i)

					if room.names[nname] == 0 {
						room.names[nname] = client.id
						break
					}
				}
			}

			room.idnames[client.id] = nname

			client.send <- []byte("{ \"yourname\": \"" + nname + "\"}")

			r := room.c.Rgbas
			for i := 0; i < len(r); i++ {
				if r[i].Bounds().Empty() {
					continue
				}
				outm.Cu = RgbaToClearUpdate(r[i].Bounds(), &r[i], true, i)
				outj, err := json.Marshal(outm)
				if err != nil {
					fmt.Println(err)
				}
				client.send <- outj
			}

			outm.Cu = nil

			for cl := range room.clients {
				client.send <- []byte("{ \"register\": \"" + room.idnames[cl.id] + "\" }")
				select {
				case cl.send <- []byte("{ \"register\": \"" + nname + "\" }"):
				default:
					fmt.Println("user ", cl.id, "disconnected in default case of client := <-room.register:")
					close(cl.send)
					delete(room.clients, cl)
				}
			}

			room.clients[client] = true
			if room.conns[client.id] == nil {
				room.conns[client.id] = make(map[*Client]bool)
			} 
			room.conns[client.id][client] = true

			room.timer.Stop()
			room.unempty <- room


		case client := <-room.unregister:
			fmt.Println("received unregister from", client.id)
			room.unregist(client)

		case message := <-room.broadcast:
			js, outj, err, ss := room.applyMessage(&message.bytes, message.client.id, message.client)
			if err != nil {
				message.client.send <- []byte("{\"error\": \"" + err.Error() + "\" }")
				break
			}

			if js != nil {
				for client := range room.clients {

					if !ss && message.client == client {
						continue
					}
					select {
					case client.send <- js:
					default:
						fmt.Println("user ", client.id, "disconnected in default case of message := <-room.broadcast")
						close(client.send)
						delete(room.clients, client)
					}
				}
			}

			if outj != nil {
				for client := range room.clients {
					select {
					case client.send <- outj:
					default:
						fmt.Println("user ", client.id, "disconnected in default case of message := <-room.broadcast")
						close(client.send)
						delete(room.clients, client)
					}
				}
			}

		}
	}
}
