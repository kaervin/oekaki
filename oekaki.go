// Oekaki (Japanese: お絵描き, o- (formal prefix) + e "picture" + kaki "to draw") is a Japanese term
// used to describe the act of drawing a picture.

package main

import (
	"crypto/subtle"
	"fmt"
	"github.com/gorilla/websocket"
	"html/template"
	"image"
	"image/color"
	"image/draw"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"time"
)

var admin_name = "admin_name"
var admin_password = "admin_password"

type Manager struct {

	// signals that a Room has been empty for some time and can be used for new Clients
	empty chan *Room

	// signals that a room is not empty and can't be used for new Clients
	unempty chan *Room

	// a channel we send on if we wish to create a new Room
	// the sender then waits on the back chan, which will receive the name of the room or "" if there is no place left
	new chan RoomStruct

	// tell the manager to close a room
	close chan string

	// all our rooms. Mutexed so that we can savely read and write from our http handlers
	Rooms roommap

	// empty rooms, free to be used
	// struct{} is just an empty value signaling that *Room exists
	EmptyRooms map[*Room]bool
}

type roommap struct {
	sync.RWMutex
	m map[string]*Room
}

type RoomStruct struct {
	width, height, lnum int
	name                string
	perm                bool
	back                chan string
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// after client connects we will wait for an identifying message, which will either be a key, or "new", meaning we should provide a key
var src = rand.NewSource(time.Now().UnixNano())

func (m *Manager) wsHandler(w http.ResponseWriter, r *http.Request) {

	fmt.Println("connecting to ws...")

	name := r.URL.Path[len("/ws/oekaki/"):]

	m.Rooms.RLock()
	room := m.Rooms.m[name]
	m.Rooms.RUnlock()

	if room == nil {
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err.Error())
		return
	}

	fmt.Println("upgraded ws.")

	brdcast := make(chan Broadcast, 1024)

	client := &Client{0, brdcast, room.unregister, make(chan []byte, 1024), conn}

	go client.writePump()
	go client.readPump()

	brdc := <-brdcast

	if string(brdc.bytes) == "new" {

		rnd := src.Int63()
		json := "{ \"id\": \"" + strconv.FormatInt(int64(rnd), 10) + "\" }"
		client.send <- []byte(json)
		client.id = rnd
	} else {
		id, err := strconv.ParseInt(string(brdc.bytes), 10, 64)
		if err != nil {
			fmt.Println(string(brdc.bytes))
			fmt.Println(err)
			return
		}
		client.id = id
	}

	client.broadcast = room.broadcast

	room.register <- client
}

// HTTP Handlers

func (m *Manager) oekakiHandler(w http.ResponseWriter, r *http.Request) {

	name := r.URL.Path[len("/oekaki/"):]

	m.Rooms.RLock()
	n := m.Rooms.m[name]
	m.Rooms.RUnlock()

	if n == nil {
		return
	}

	http.ServeFile(w, r, "templates/oekakicanvas.html")
}

func (m *Manager) historyHandler(w http.ResponseWriter, r *http.Request) {

	name := r.URL.Path[len("/history/"):]

	m.Rooms.RLock()
	n := m.Rooms.m[name]
	m.Rooms.RUnlock()

	if n == nil {
		return
	}

	fmt.Fprint(w, n.c.his)
}

func stuffHandler(w http.ResponseWriter, r *http.Request) {

	file := r.URL.Path[len("/"):]
	http.ServeFile(w, r, file)
}

// from https://stackoverflow.com/questions/21936332/idiomatic-way-of-requiring-http-basic-auth-in-go/39591234#39591234
func BasicAuth(handler http.HandlerFunc, username, password, realm string) http.HandlerFunc {

	return func(w http.ResponseWriter, r *http.Request) {

		user, pass, ok := r.BasicAuth()

		if !ok || subtle.ConstantTimeCompare([]byte(user), []byte(username)) != 1 || subtle.ConstantTimeCompare([]byte(pass), []byte(password)) != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="`+realm+`"`)
			w.WriteHeader(401)
			w.Write([]byte("Unauthorised.\n"))
			return
		}

		handler(w, r)
	}
}

func (m *Manager) createOekaki(w http.ResponseWriter, r *http.Request) {

	if r.Method == "POST" {

		err := r.ParseForm()
		if err != nil {
			fmt.Println(err)
			return
		}

		pw := r.PostForm["width"]
		ph := r.PostForm["height"]
		pn := r.PostForm["nlay"]

		if len(pw) == 0 || len(ph) == 0 || len(pn) == 0 {
			fmt.Println("A parameter was missing from the form when creating Oekaki")
		}

		width64, _ := strconv.ParseInt(pw[0], 10, 32)
		height64, _ := strconv.ParseInt(ph[0], 10, 32)
		nlay64, _ := strconv.ParseInt(pn[0], 10, 32)

		width := int(width64)
		height := int(height64)
		nlay := int(nlay64)

		width = min(2000, width)
		height = min(2000, height)
		nlay = min(4, nlay)

		width = max(500, width)
		height = max(500, height)
		nlay = max(1, nlay)

		back := make(chan string)
		m.new <- RoomStruct{width, height, nlay, "", false, back}
		name := <-back

		if name == "" {
			fmt.Fprint(w, "Sorry my dude, but we're full. Try again later.")
			return
		}

		http.Redirect(w, r, "/oekaki/"+name, http.StatusFound)
	}
}

func (m *Manager) createOekakiAdmin(w http.ResponseWriter, r *http.Request) {

	if r.Method == "POST" {

		err := r.ParseForm()
		if err != nil {
			fmt.Println(err)
			return
		}

		pw := r.PostForm["width"]
		ph := r.PostForm["height"]
		pn := r.PostForm["nlay"]
		pname := r.PostForm["name"]
		pperm := r.PostForm["perm"]

		if len(pw) == 0 || len(ph) == 0 || len(pn) == 0 || len(pname) == 0 {
			fmt.Println("A parameter was missing from the form when creating Oekaki")
		}

		width64, _ := strconv.ParseInt(pw[0], 10, 32)
		height64, _ := strconv.ParseInt(ph[0], 10, 32)
		nlay64, _ := strconv.ParseInt(pn[0], 10, 32)

		width := int(width64)
		height := int(height64)
		nlay := int(nlay64)

		width = min(2000, width)
		height = min(2000, height)
		nlay = min(3, nlay)

		width = max(500, width)
		height = max(500, height)
		nlay = max(1, nlay)

		perm := false

		if len(pperm) == 1 {
			fmt.Println("pperm length is one")
			perm = true
		}

		back := make(chan string)
		m.new <- RoomStruct{width, height, nlay, pname[0], perm, back}
		name := <-back

		if name == "" {
			fmt.Fprint(w, "Sorry my dude, but we're full. Try again later.")
			return
		}

		http.Redirect(w, r, "/oekaki/"+name, http.StatusFound)
	}
}

func (m *Manager) managerRoutine() {

	for {
	Next:
		select {
		case er := <-m.empty:
			m.EmptyRooms[er] = true

		case er := <-m.unempty:
			delete(m.EmptyRooms, er)

		case cl := <- m.close:

			m.Rooms.Lock()
			if r, ok := m.Rooms.m[cl]; ok {
				r.close <- struct{}{}
				delete(m.EmptyRooms, r)
				delete(m.Rooms.m, cl)
			}
			m.Rooms.Unlock()

		case rs := <-m.new:

			m.Rooms.RLock()
			l := len(m.Rooms.m)
			m.Rooms.RUnlock()

			if l >= 10 {

				// try to find a room that has been empty for a while
				if len(m.EmptyRooms) == 0 {
					rs.back <- ""
					goto Next
				}

				// and now get some value from the map
				var emp *Room = nil
				for k, _ := range m.EmptyRooms {
					emp = k
					break
				}

				emp.close <- struct{}{}
				delete(m.EmptyRooms, emp)
				m.Rooms.Lock()
				delete(m.Rooms.m, emp.Name)
				m.Rooms.Unlock()
			}

			var name string

			// if we have provided a name
			if rs.name != "" {
				m.Rooms.RLock()
				n := m.Rooms.m[rs.name]
				m.Rooms.RUnlock()

				if n != nil {
					rs.back <- ""
					goto Next
				}

				name = rs.name

			} else {
				// generate a unique name
				for i := 4; ; i++ {
					name = RandStringBytes(i)

					m.Rooms.RLock()
					n := m.Rooms.m[name]
					m.Rooms.RUnlock()

					if n == nil {
						break
					}
				}
			}

			room := newRoom(name, rs.width, rs.height, rs.lnum, rs.perm, m.empty, m.unempty)
			m.Rooms.Lock()
			m.Rooms.m[name] = room
			m.Rooms.Unlock()
			go room.run()

			rs.back <- name
		}
	}

}

// A Dab is a single circle placed along the line at a specific frequency
// With this function a Dab of specific size can be created
// TODO: a simple optimization would be to make the dabs *image.Alpha dimensions depend on the size
var dabs []image.Alpha

func createDab(size int) *image.Alpha {

	dab := image.NewAlpha(image.Rect(0, 0, 30, 30))

	draw.Draw(dab, dab.Bounds(), image.Transparent, image.ZP, draw.Src)

	// three special cases for the smalles circles

	if size == 1 {
		dab.Set(15, 15, color.Alpha{255})
		return dab
	}

	if size == 2 {
		dab.Set(14, 14, color.Alpha{255})
		dab.Set(15, 15, color.Alpha{255})
		dab.Set(14, 15, color.Alpha{255})
		dab.Set(15, 14, color.Alpha{255})
		return dab
	}

	if size == 3 {
		for x := 14; x <= 16; x++ {
			for y := 14; y <= 16; y++ {
				dab.Set(x, y, color.Alpha{255})
			}
		}
		return dab
	}

	// and for larger ones a general case

	for x := 0; x < 30; x++ {
		for y := 0; y < 30; y++ {

			xx, yy, rr := float64(x)-14.5, float64(y)-14.5, float64(size-1)

			if xx*xx+yy*yy < rr*rr {
				dab.Set(x, y, color.Alpha{255})
			}
		}
	}
	return dab
}

func init() {

	// create the dabs of different sizes
	dabs = make([]image.Alpha, 0, 10)

	for i := 0; i < 10; i++ {
		dab := createDab(i + 1)
		dabs = append(dabs, *dab)
	}

}

var templates *template.Template = nil

func main() {

	templates = template.Must(
		template.ParseFiles("templates/admin.html", "templates/start.html"))

	fmt.Println("おはよう")
	signalchan := make(chan os.Signal, 1)
	signal.Notify(signalchan, os.Interrupt)

	c := roommap{
		sync.RWMutex{},
		make(map[string]*Room),
	}

	man := Manager{
		make(chan *Room),
		make(chan *Room),
		make(chan RoomStruct),
		make(chan string),
		c,
		make(map[*Room]bool),
	}

	go man.managerRoutine()

	go func() {
		http.HandleFunc("/admin/",
			BasicAuth(func(w http.ResponseWriter, r *http.Request) {

				man.Rooms.RLock()

				p := struct {
					Rooms map[string]*Room
					EmptyRooms map[*Room]bool
				} {
					man.Rooms.m,
					man.EmptyRooms,
				}

				err := templates.ExecuteTemplate(w, "admin.html", p)
				if err != nil {
					fmt.Println(err)
				}
				man.Rooms.RUnlock()
			}, admin_name, admin_password, "admin page"))

		http.HandleFunc("/delete/",
			BasicAuth(func(w http.ResponseWriter, r *http.Request) {

				name := r.URL.Path[len("/delete/"):]


				man.Rooms.Lock()

				if rm, ok := man.Rooms.m[name]; ok {
					rm.close <- struct{}{}
					delete(man.EmptyRooms, rm)
					delete(man.Rooms.m, name)
					fmt.Fprint(w, "deleted: ", name)

				} else {
					fmt.Fprint(w, "no room named: ", name)
				}
				man.Rooms.Unlock()
			}, admin_name, admin_password, "admin page"))

		http.HandleFunc("/reparse/",
			BasicAuth(func(w http.ResponseWriter, r *http.Request) {

				t, err := template.ParseFiles("templates/admin.html", "templates/start.html")

				if err != nil {
					fmt.Fprint(w, "parsing failed: ", err)
					return
				}

				templates = t
				fmt.Fprint(w, "reparsed templates")

			}, admin_name, admin_password, "admin page"))

		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {

			man.Rooms.RLock()
			l := len(man.Rooms.m)
			man.Rooms.RUnlock()

			available := (10-l)+len(man.EmptyRooms)

			err := templates.ExecuteTemplate(w, "start.html", available)
			if err != nil {
				fmt.Println(err)
			}

		})

		http.HandleFunc("/stuff/", stuffHandler)

		http.HandleFunc("/create/", man.createOekaki)

		http.HandleFunc("/admincreate/", BasicAuth(man.createOekakiAdmin, admin_name, admin_password, "admin page"))

		http.HandleFunc("/oekaki/", man.oekakiHandler)

		http.HandleFunc("/ws/", man.wsHandler)

		http.HandleFunc("/history/", BasicAuth(man.historyHandler, admin_name, admin_password, "admin page"))

		http.ListenAndServe(":80", nil)
	}()

	<-signalchan
	fmt.Println("\nおやすみ")

}
