
// Oekaki (Japanese: お絵描き, o- (formal prefix) + e "picture" + kaki "to draw") is a Japanese term
// used to describe the act of drawing a picture.


function createOekaki(width, height, num_layers) {


// Creation of the fundamental DOM Elements

// the parent element of this whole thing
// will be returned from createOekaki
var oekaki = document.createElement("div");
oekaki.style = "-webkit-touch-callout: none; -webkit-user-select: none; -khtml-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none;"


// the cborder contains the layers and is used to figure out where a user has clicked on the canvas, etc.
var cborder = document.createElement("div");
cborder.style = "display:inline-block; background: rgb(70, 65, 130); box-shadow: rgb(70, 65, 130) 8px 8px; position: fixed;";
cborder.style.width = (width + 4) + "px"
cborder.style.height = (height + 4) + "px"
cborder.style.top = Math.round((document.documentElement.clientHeight - height) / 2) + "px";
cborder.style.left = Math.round((document.documentElement.clientWidth - width) / 2) + "px";
cborder.onselectstart = function () { return false; }


// layers and their contexts, as well as their miniatures are stored in and accessed from the following arrays
var layers = [];
var contexts = [];
var mini = [];
var mini_cntx = [];

var layer_tool = document.createElement('div');

for (var i = 0; i < num_layers; i++) {
  layers[i] = document.createElement("canvas");
  layers[i].style = "position: absolute;"
  layers[i].style.top = "2px"
  layers[i].style.left = "2px"
  layers[i].width = width
  layers[i].height = height
  contexts[i] = layers[i].getContext("2d");
  cborder.appendChild(layers[i]);

  mini[i] = document.createElement("canvas");
  mini[i].style = "border: 5px solid rgb(236, 236, 236)";
  mini[i].num = i;
  mini[i].onclick = function() {
    console.log(this.num);
    for (var i = 0; i < num_layers; i++) {
      if (i != this.num) {
        mini[i].style.border = "5px solid rgb(236, 236, 236)"
      } else {
        mini[i].style.border = "5px solid pink"
      }
    }

    active_layer = this.num;
  }
  mini[i].onmouseover = function() {
    console.log(this.num);
    for (var i = 0; i < num_layers; i++) {
      if (i != this.num) {
        layers[i].style.opacity = 0.2;
      }
    }
  }
  mini[i].onmouseout = function() {
    console.log(this.num);
    for (var i = 0; i < num_layers; i++) {
      if (i != this.num) {
        layers[i].style.opacity = 1.0;
      }
    }
  }
  mini[i].width = 100;
  mini[i].height = 100;
  mini_cntx[i] = mini[i].getContext("2d");
  layer_tool.appendChild(mini[i]);  
}
layers[0].style.background = "white";
mini[0].style.border = "5px solid pink";


// ccolor and csize are Brush properties
// ccolor can either be a color, or "erase", which tells us that we should draw a transparent value 
var ccolor = { 'string': 'rgb(0,0,0)' }
var csize = 1;

// zoom tells us the CSS zoom factor of the canvas, and is needed for calculating the true position of events
var zoom = 1;

function pixelDistance(fromX, fromY, toX, toY) {
  var vX = toX - fromX
  var vY = toY - fromY
  return Math.sqrt( Math.pow(vX,2) + Math.pow(vY,2) )
}

// Dabs (parts which make up a line) and their fitting Cursors of a specific size/color are created and stored in the following code 
function createDab(size) {
  dabcanv = document.createElement('canvas');
  dabcanv.width = 20;
  dabcanv.height = 20;
  dabcntx = dabcanv.getContext('2d');

  if (size == 1) {
  	dabcntx.fillRect(10, 10 , 1, 1);
   	return dabcanv
  }
  if (size == 2) {
  	dabcntx.fillRect(9, 9 , 2, 2);
   	return dabcanv
  }
  if (size == 3) {
  	dabcntx.fillRect(9, 9 , 3, 3);
   	return dabcanv
  }

  var px = 9.5;
  var py = 9.5;

  for (var x = 0; x < 20; x++) {
    for (var y = 0; y < 20; y++) {

      xx = x - px
      yy = y - py
      rr = (size)-1

      if (xx*xx+yy*yy <= rr*rr) {
        dabcntx.fillRect(x, y , 1, 1);
      }

    }
  }
  return dabcanv
}

function createCursor(size) {
  curscanv = document.createElement('canvas');
  curscanv.width = 20;
  curscanv.height = 20;
  curscntx = curscanv.getContext('2d');

  curscntx.fillStyle='rgba(0,0,0,0.8)';


  if (size == 1) {
  	curscntx.fillRect(9, 9 , 3, 3);
    curscntx.globalCompositeOperation='destination-out';
  	curscntx.fillRect(10,10,1,1);
   	return curscanv
  }
  if (size == 2) {
	curscntx.fillRect(8, 8 , 4, 4);
  	curscntx.globalCompositeOperation='destination-out';
    curscntx.fillStyle='black';
  	curscntx.fillRect(9, 9, 2, 2);
   	return curscanv
  }
  if (size == 3) {
  	curscntx.fillRect(8, 8, 5, 5);  	  	
  	curscntx.globalCompositeOperation='destination-out';
    curscntx.fillStyle='black';
  	curscntx.fillRect(9, 9, 3, 3);
   	return curscanv
  }


  for (var x = 0; x < 20; x++) {
    for (var y = 0; y < 20; y++) {

      xx = x-9.5
      yy = y-9.5
      rr = (size)
      ri = rr-1

      if (xx*xx+yy*yy < rr*rr && xx*xx+yy*yy >= ri*ri  ) {
        curscntx.fillRect(x, y , 1, 1);
      }

    }
  }
  return curscanv
}

var dabs = []
for (var i = 0; i < 12; i++) {
  dabs.push(createDab(i+1));
}

var cursorcanvs = []
for (var i = 0; i < 10; i++) {
  var curs = createCursor(i+1);
  cursorcanvs.push(curs);
}

// create the cross that will be the CSS cursor (actual mouse position of OS)

var crosscanv = document.createElement('canvas')
crosscanv.width = 30
crosscanv.height = 30

var crosscntx = crosscanv.getContext('2d')

crosscntx.fillRect(0, 14 , 7, 1);
crosscntx.fillRect(14, 0 , 1, 7);

crosscntx.fillRect(14, 23 , 1, 5);
crosscntx.fillRect(23, 14 , 5, 1);

crosscntx.fillStyle='white';

crosscntx.fillRect(0, 15 , 7, 1);
crosscntx.fillRect(15, 0 , 1, 7);

crosscntx.fillRect(15, 23 , 1, 5);
crosscntx.fillRect(23, 15 , 5, 1);

var crossurl = crosscanv.toDataURL();
var crossstring = 'url(\"' + crossurl + '\") 15 15, crosshair';

cborder.style.cursor = crossstring;


var mouseCursor = document.createElement('div')
mouseCursor.style = "z-index: 10; position: absolute; pointer-events: none;"
mouseCursor.appendChild(cursorcanvs[0])
cborder.appendChild(mouseCursor)



// Here we create the Tool Menu and its buttons

// lastcolor is for remembering the color we had before switching to the "erase" color
var lastcolor = ccolor;


// MutexSelection is an easy way of creating Buttons whichs "pressed states" are mutually exclusive
function mutexSelection(parent, child) {
  if (parent.selected !== undefined) {
    parent.selected.classList.remove("selected");
  }
  child.classList.add("selected");
  parent.selected = child
}

var brushMenu = document.createElement("div");
brushMenu.style = "width:190px; display:flex; flex-wrap:wrap;";
brushMenu.classList.add("lightb");

// "butt" is our custom button
var drawButton = document.createElement("butt");
drawButton.innerHTML = "draw";
drawButton.onclick = function() {
  setTool("draw")
}

var eraseButton = document.createElement("butt");
eraseButton.innerHTML = "erase";
eraseButton.onclick = function() {
  setTool("erase")
}

var clpickButton = document.createElement("butt");
clpickButton.innerHTML = "pick";
clpickButton.onclick = function() {
  setTool("pick")
}

var fillButton = document.createElement("butt");
fillButton.innerHTML = "fill";
fillButton.onclick = function() {
  setTool("fill")
}


// The contextMenu is a div containing the specific Menu of a Tool
// The current one is set via SetContextMenu
var contextMenu = document.createElement('div')

function SetContextMenu(node) {
  if ( contextMenu.current !== undefined ) {
    contextMenu.removeChild(contextMenu.current)
  }
  contextMenu.appendChild(node)
  contextMenu.current = node
}


// drawing and erasing context menu

var drawContextMenu = document.createElement('div')
drawContextMenu.style = "width:190px; display:flex;"

var sizeSlider = document.createElement("input");
sizeSlider.style = "width: 143px; margin: 3px 5px 0px 5px;"
sizeSlider.type = "range";
sizeSlider.min = 1;
sizeSlider.max = 10;
sizeSlider.value = 1;
sizeSlider.oninput = function() {
  updateBrush(Math.round(this.value), ccolor)
}

var BrushPreview = document.createElement('div')

var BrushPreviewBackCanvas = document.createElement('canvas')
BrushPreviewBackCanvas.style = "margin: 5px; border: 2px solid rgb(70, 65, 130); position: absolute;"
BrushPreviewBackCanvas.style.background = "white"
var BrushPreviewBackContext = BrushPreviewBackCanvas.getContext('2d')
BrushPreviewBackCanvas.width = 20
BrushPreviewBackCanvas.height = 20

var BrushPreviewCanvas = document.createElement('canvas')
BrushPreviewCanvas.style = "margin: 5px; border: 2px solid rgb(70, 65, 130); position: absolute;"
var BrushPreviewContext = BrushPreviewCanvas.getContext('2d')
BrushPreviewCanvas.width = 20
BrushPreviewCanvas.height = 20


// updateBrush is the function, which needs to be called if the Brush properties should be changed
function updateBrush(size, color) {

  csize = size
  ccolor = color

  if (modus == "erase") {
    // first color the Background and then "cut a dab in it"
    BrushPreviewBackContext.globalCompositeOperation = 'source-over';
    BrushPreviewBackContext.fillStyle = lastcolor.string;
    BrushPreviewBackContext.fillRect(0, 0, 20, 20);
    BrushPreviewBackContext.globalCompositeOperation = 'destination-out';
    BrushPreviewBackContext.drawImage(dabs[csize-1], 0, 0)

    BrushPreviewContext.globalCompositeOperation = 'destination-out';
    BrushPreviewContext.fillRect(0, 0, 20, 20);

  } else {
    // first color the Background and then "cut a larger than the dab hole in it"
    BrushPreviewBackContext.globalCompositeOperation = 'source-over';
    BrushPreviewBackContext.fillStyle = ccolor.string;
    BrushPreviewBackContext.fillRect(0, 0, 20, 20);
    BrushPreviewBackContext.globalCompositeOperation = 'destination-out';
    BrushPreviewBackContext.drawImage(dabs[csize+1], 0, 0)

    BrushPreviewContext.globalCompositeOperation = 'source-over';
    BrushPreviewContext.fillStyle = ccolor.string;
    BrushPreviewContext.fillRect(0, 0, 20, 20);
    BrushPreviewContext.globalCompositeOperation = 'destination-in';
    BrushPreviewContext.drawImage(dabs[csize-1], 0, 0)
  }

  //cborder.style.cursor = cursors[csize-1]
  mouseCursor.removeChild(mouseCursor.firstChild)
  mouseCursor.appendChild(cursorcanvs[csize-1])
}

drawContextMenu.appendChild(sizeSlider);
BrushPreview.appendChild(BrushPreviewBackCanvas);
BrushPreview.appendChild(BrushPreviewCanvas);
drawContextMenu.appendChild(BrushPreview);



// picking and filling context menu

// allLayers tells us if we want to apply a specific action (pickcolor, fill) on all layers or just on the active
var allLayers = true

var fillContextMenu = document.createElement('div')
fillContextMenu.style = "width:190px; display:flex;"

var allLayButton = document.createElement('butt')
allLayButton.innerHTML = "all"
allLayButton.onclick = function() {
  allLayers = true
  mutexSelection(fillContextMenu, allLayButton)
}
mutexSelection(fillContextMenu, allLayButton)


var curLayButton = document.createElement('butt')
curLayButton.innerHTML = "cur"
curLayButton.onclick = function() {
  allLayers = false
  mutexSelection(fillContextMenu, curLayButton)
}

fillContextMenu.appendChild(allLayButton);
fillContextMenu.appendChild(curLayButton);


brushMenu.appendChild(drawButton);
brushMenu.appendChild(eraseButton);
brushMenu.appendChild(fillButton);
brushMenu.appendChild(clpickButton);
brushMenu.appendChild(contextMenu)


SetContextMenu(drawContextMenu)

// the modus we are in tell us which function to execute when clicking on the canvas
// can be draw, pick or fill
var modus = "draw";

// setTool is the function by which it is decided which tool we are currently (exclusively) using
function setTool(nt) {

    switch(nt) {
    case "draw":
      modus = "draw"
      updateBrush(csize,lastcolor)
      SetContextMenu(drawContextMenu)
      mutexSelection(brushMenu, drawButton)      
      break
    case "erase":
      modus = "erase"
      updateBrush(csize,{ R: 0, G: 0, B: 0, A: 0 })
      SetContextMenu(drawContextMenu)
      mutexSelection(brushMenu, eraseButton)
      break
    case "pick":
      modus = "pick"
      
      mouseCursor.removeChild(mouseCursor.firstChild)
      mouseCursor.appendChild(cursorcanvs[0])

      SetContextMenu(fillContextMenu)
      mutexSelection(brushMenu, clpickButton)
      break
    case "fill":
      modus = "fill"
      ccolor = lastcolor;

      mouseCursor.removeChild(mouseCursor.firstChild)
      mouseCursor.appendChild(cursorcanvs[0])

      SetContextMenu(fillContextMenu)
      mutexSelection(brushMenu, fillButton)
      break
    default:
    }
}
// the selected tooo when starting is draw
setTool("draw")


// WindowMenu is the div inside of the Window created by makeWindow
// to this we will append all our Menus, such as the BrushMenu or the colorPicker
var windowMenu = document.createElement('div');

var colorPicker = createColorPicker(colorUpdate);


var mwindow = makeWindow(windowMenu, "tools");
mwindow.style.top = "10px";
mwindow.style.left = "10px";
mwindow.style.zIndex = 10;
// some menu buttons



// cntrlmenu contains some basic controls such as zoom or the undo button
var cntrlmenu = document.createElement("div");
cntrlmenu.classList.add("lightb");
cntrlmenu.style = "display: flex; width: 190px"


undoButton = document.createElement("butt");
undoButton.style = "flex-grow: 0;"

undoButton.innerHTML = "undo";
undoButton.onclick = function() {
  undo();
}

var zoomSlider = document.createElement("input");
zoomSlider.style = "flex-grow: 1; flex-shrink: 1; width: 70px; margin-right: 10px"
zoomSlider.type = "range";
zoomSlider.min = 1;
zoomSlider.max = 3;
zoomSlider.value = 1;
zoomSlider.oninput = function() {

  zoom = zoomSlider.value; 
  cborder.style.transform = "scale(" +zoom+ ")"

  var newtop = parseInt(cborder.style.top,10);
  var newleft = parseInt(cborder.style.left,10);

  var maxh = (document.documentElement.clientHeight)  - (200) + ((zoom-1)*height/2);
  var maxw = (document.documentElement.clientWidth) - (200) + ((zoom-1)*width/2);

  var minh = 200 - height - ((zoom-1)*height/2);
  var minw = 200 - width - ((zoom-1)*width/2);

  newtop = Math.min(newtop, maxh);
  newleft = Math.min(newleft, maxw);

  newtop = Math.max(newtop, minh);
  newleft = Math.max(newleft, minw);

  cborder.style.top = newtop + "px";
  cborder.style.left = newleft + "px";
}


var zoomLabel = document.createElement('div')
zoomLabel.innerHTML = "zoom:";
zoomLabel.style = "margin: 4px 3px 0px 3px; font-size: 16px; text-align: center; text-decoration: none; line-height:18px"

cntrlmenu.appendChild(undoButton);
cntrlmenu.appendChild(zoomLabel);
cntrlmenu.appendChild(zoomSlider);

windowMenu.appendChild(cntrlmenu);
windowMenu.appendChild(brushMenu);
windowMenu.appendChild(colorPicker);

// colorUpdate is the function passed to the colorPicker
// it gets called when the color was updated via it
function colorUpdate(c) {

  lastcolor = c;
  if (modus == "erase") {
    updateBrush(csize, { R: 0, G: 0, B: 0, A: 0 })
  } else if (modus == "draw") {
    updateBrush(csize, c)
  }

  //setTool("draw")
}

// layerMenu is the right-side div containing all the miniatures for selection of the Layer
layerMenu = document.createElement("div");

for (var i = num_layers; i > 0; i--) {
  layerMenu.appendChild(mini[i-1]);
}

layerMenu.style = "padding: 0px; position: fixed; display: flex; flex-direction: column; border: 2px solid rgb(70, 65, 130); box-shadow: rgb(70, 65, 130) 8px 8px;"
layerMenu.style.top = 10 + "px";
layerMenu.style.right = 15 + "px";
layerMenu.style.zIndex = 10;

oekaki.appendChild(layerMenu);


// append the drawing area
oekaki.appendChild(cborder);


// The div for minimized windows
var minDiv = document.createElement('div')
oekaki.appendChild(minDiv)
minDiv.style = "left: 5px; bottom: 5px; z-index: 10; width: 100px; position: fixed;"

minDiv.appendChild(mwindow);

// undo and redo logic

function addundo() {
  if ( oekaki.actionCallback != null ) {
    var json = '{"UndoPoint": {}}';
    oekaki.actionCallback(json);
  } 
}

var isundoing = false 
function undo() {
  if ( oekaki.actionCallback != null && !isundoing) {
    var json = '{"Undo": {}}';
    oekaki.actionCallback(json);
  } 
  undoButton.classList.add('selected')
  isundoing = true
}

function undone() {
  undoButton.classList.remove('selected')
  isundoing = false
}


// drawing logic

// fbrush is the canvas with which the current line gets drawn
// this line can be from any user and constantly changes color/size
var fbrush = document.createElement('canvas');
fbrush.width = 30;
fbrush.height = 30;
var fbcntx = fbrush.getContext('2d');
fbcntx.globalCompositeOperation = 'destination-in';

// setDab places one current fbrush dab on x, y 
function setDab(x,y, n_lay) {
  zx = Math.round(x);
  zy = Math.round(y);

  contexts[n_lay].drawImage(fbrush, zx-10, zy-10)
}

function rgbString(R, G, B) {
  return "rgb(" + R + "," + G + "," + B + ")"
}

// here http://members.chello.at/easyfilter/bresenham.html are more algos for future reference
// plots a line of dabs
// TODO: maybe less dabs depending on size
function plotLine(x0, y0, x1, y1, size, n_lay, color) {

  x0 = Math.round(x0);
  x1 = Math.round(x1);
  y0 = Math.round(y0);
  y1 = Math.round(y1);

  var cstring = rgbString(color.R,color.G,color.B);  

  if ( color.A == 0 ) {
    contexts[n_lay].globalCompositeOperation='destination-out';
    contexts[n_lay].fillStyle='black';
    //console.log("erase");
  } else {
    contexts[n_lay].globalCompositeOperation='source-over';
    contexts[n_lay].fillStyle = cstring;
  }

  var dx =  Math.abs(x1-x0)
  var dy = -Math.abs(y1-y0)
  
  var sx = x0<x1 ? 1 : -1;
  var sy = y0<y1 ? 1 : -1;

  var err = dx+dy, e2;                                   

  var pxcount = 0;

  var brk1 = false;
  var brk2 = false;

  fbcntx.globalCompositeOperation = 'source-over';
  fbcntx.fillStyle = cstring;
  fbcntx.fillRect(0, 0, 30, 30);
  fbcntx.globalCompositeOperation = 'destination-in';

  fbcntx.drawImage(dabs[size-1], 0, 0)

  for (;;){
    if ( !(pxcount % 1)) {
      setDab(x0,y0, n_lay);        
    }

    if (sx > 0) {
      if (x0 >= x1) {
        brk1 = true;
      }
    } else {
      if (x1 >= x0) {
        brk1 = true;
      }        
    }

    if (sy > 0) {
      if (y0 >= y1) {
        brk2 = true;
      }
    } else {
      if (y1 >= y0) {
        brk2 = true;
      }        
    }

    if (brk1 && brk2) break;
    e2 = 2*err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    pxcount++;
  }
}

// draws a Png on the n_lay Layer at x, y
// clr tells us if the area defined by x, y and the Png width/height should be cleared beforehand
function drawPng(png, x, y, clr, n_lay) {

  lastCompositeOp = contexts[n_lay].globalCompositeOperation
  contexts[n_lay].globalCompositeOperation='source-over';
  if (clr) {
    contexts[n_lay].clearRect(x,y,png.width,png.height);
  }
  contexts[n_lay].drawImage(png, x, y);
  contexts[n_lay].globalCompositeOperation = lastCompositeOp;

}


// for remembering x,y of last event in case of drawing
var lastx = null;
var lasty = null;

// tells us if the mouse is currently pressed down
var isdrawing = false;

var active_layer = 0;

// start the drawing
function startdraw(event) {

  if (event.button == 0) {
  addundo();
  var rect = layers[0].getBoundingClientRect();

  // the x and y in the canvas-space
  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom) -1);
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom)  -1);

  // plot the dot

  plotLine(x, y, x, y, csize, active_layer, ccolor);

  // send the dot
  if ( oekaki.actionCallback != null ) {

    var json = '{"PLine": {"X0": ' + x + ', "Y0": ' + y + ', "X1": ' + x + ', "Y1": ' + y + ', "Layer": ' + active_layer + ', "Size": ' + csize + ', "R": ' + ccolor.R + ', "G": ' + ccolor.G + ', "B": ' + ccolor.B + ', "A": ' + ccolor.A + ' }}';
    oekaki.actionCallback(json);
  } 

  isdrawing = true;
  lastx = x;
  lasty = y;
  
  document.onmouseup = function(){stopdraw()};
  document.onmousemove = dodraw;    
  }
}

function dodraw(event) {
  var rect = layers[0].getBoundingClientRect();
  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom) -1);
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom) -1) ;


  if (isdrawing) {
    plotLine(lastx, lasty, x, y, csize, active_layer, ccolor);

    if ( oekaki.actionCallback != null ) {

      var json = '{"PLine": {"X0": ' + lastx + ', "Y0": ' + lasty + ', "X1": ' + x + ', "Y1": ' + y + ', "Layer": ' + active_layer + ', "Size": ' + csize + ', "R": ' + ccolor.R + ', "G": ' + ccolor.G + ', "B": ' + ccolor.B + ', "A": ' + ccolor.A + ' }}';

      oekaki.actionCallback(json);
    } 

  }
  lastx = x;
  lasty = y;
}

function stopdraw() {

  isdrawing = false;

  updateMini();
  document.onmousemove = null;
}


// isdragging tells us if we are currently dragging, which we use to figure out if we should not send cursor-position updates
var isdragging = false

// practically the same as with drawing
function startdrag(event) {
  var rect = cborder.getBoundingClientRect();
  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom)) -1;
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom)) -1;

  lastx = x;
  lasty = y;

  isdragging = true
  document.onmouseup = stopdrag;
  document.onmousemove = dodrag;
}

function dodrag(event) {

  var rect = cborder.getBoundingClientRect();
  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom)) -1;
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom)) -1;

  ltop = parseInt(cborder.style.top,10)
  lleft = parseInt(cborder.style.left,10)

  var maxh = (document.documentElement.clientHeight)  - (200) + ((zoom-1)*height/2);
  var maxw = (document.documentElement.clientWidth) - (200) + ((zoom-1)*width/2);

  var minh = 200 - height - ((zoom-1)*height/2);
  var minw = 200 - width - ((zoom-1)*width/2);

  var newtop =  parseInt(cborder.style.top,10) + (y - lasty);
  var newleft =  parseInt(cborder.style.left,10) + (x - lastx);

  newtop = Math.round(newtop);
  newleft = Math.round(newleft);

  newtop = Math.min(newtop, maxh);
  newleft = Math.min(newleft, maxw);

  newtop = Math.max(newtop, minh);
  newleft = Math.max(newleft, minw);

  cborder.style.top = newtop + "px";
  cborder.style.left = newleft + "px";
}

function stopdrag(e) {
	console.log(cborder.style.left)
  	document.onmouseup = null;
  	document.onmousemove = null;
  	isdragging = false
}


function pickcolor(event) {

  if (event.button == 0) {

  var rect = layers[0].getBoundingClientRect();

  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom)) -1;
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom)) -1;

  var p

  if (allLayers) {
    for (var i = num_layers-1; i >= 0 ; i--) {
      p = contexts[i].getImageData(x, y, 1, 1).data;
      if (p[3] != 0) {
        break
      } 
    }

  } else {
    p = contexts[active_layer].getImageData(x, y, 1, 1).data;
  }

  if (p[3] == 0) {
    p[0] = 255
    p[1] = 255
    p[2] = 255
    p[3] = 255
  }

  colorPicker.setRGB(p[0],p[1],p[2])
  }
}

function fill(event) {

  if (event.button == 0) {

  var rect = layers[0].getBoundingClientRect();

  var x = Math.round(( Math.round(event.clientX / zoom) ) - (rect.left / zoom)) -1;
  var y = Math.round(( Math.round(event.clientY / zoom) ) - (rect.top / zoom)) -1;

  if ( oekaki.actionCallback != null ) {
    var json = '{"Fill": {"X": ' + x + ', "Y": ' + y + ', "Layer": ' + active_layer + ', "All": ' + allLayers + ', "R": ' + lastcolor.R + ', "G": ' + lastcolor.G + ', "B": ' + lastcolor.B + ', "A": ' + 255 + ' }}';
    oekaki.actionCallback(json);
  } 

  }
}

// events and the corresponding actions/reactions

document.onmousedown = function(event){
  if (event.ctrlKey) {
    startdrag(event);
  }  
}


cborder.onmousedown = function(event){

  console.log(event.altKey)

  if (event.ctrlKey) {
    startdrag(event);
  } else {
    switch(modus) {
      case "draw":
        startdraw(event);
        break;
      case "erase":
        startdraw(event);
        break;
      case "pick":
        pickcolor(event);
        break;
      case "fill":
        fill(event);
        break;
      default:
    }    
  }
};

var cursorX = 0
var cursorY = 0

var lastCursorX = 0
var lastCursorY = 0


function setCursorPosition(event) {

  var rect = cborder.getBoundingClientRect();

  // the x and y in the canvas-space
  cursorX = Math.round(( Math.round(event.clientX/zoom ) ) - (rect.left / zoom) -1);
  cursorY = Math.round(( Math.round(event.clientY/zoom ) ) - (rect.top / zoom) -1);

  mouseCursor.style.left = cursorX - 10 + "px"
  mouseCursor.style.top = cursorY - 10 + "px"
}


document.addEventListener('mousemove', setCursorPosition)

cborder.addEventListener('mouseleave', function() {
  mouseCursor.style.display = 'none';
});

cborder.addEventListener('mouseenter', function() {
  mouseCursor.style.display = 'block';
});


// Interval to send the cursor-position in canvas space
setInterval( function() {

  if ( oekaki.actionCallback != null && ( lastCursorX != cursorX || lastCursorY != cursorY ) && !isdragging && !isdrawing) {
    var json = '{"Cursor": {"X": ' + cursorX + ', "Y": ' + cursorY + ' }}';
    oekaki.actionCallback(json);
  } 

  lastCursorX = cursorX
  lastCursorY = cursorY

},  100);


// the following functions manage the cursors of all the users

// usermap contains the divs of the users cursors, so that we can find them quickly
var usermap = new Map();

function addUser(username) {

  var u = usermap.get(username)
  if ( u !== undefined ) {
    return
  }

  console.log("added user: " + username)
  var u = document.createElement('div');
  u.style = "pointer-events:none;"
  u.style.position = "absolute"
  u.namediv = document.createElement('div');
  usermap.set(username, u);
  u.namediv.innerHTML = username;
  u.appendChild(u.namediv);

  cborder.appendChild(u);
}

// updates a users cursor
// and sets its position in document-space
function updateUserCursor(username, x, y) {
  var rect = layers[0].getBoundingClientRect();

  var newtop = y + "px"
  var newleft = x + "px"

  var u = usermap.get(username)

  if (u !== undefined) {
    u.x = x
    u.y = y
    u.style.top = newtop
    u.style.left = newleft    
  }
}

function changeName(from, to) {
  var u = usermap.get(from)

  if (u !== undefined) {
    cborder.removeChild(u)
    usermap.delete(from)
    addUser(to)    
  }
}

function removeUser(username) {
  var u = usermap.get(username)
  if (u != null) {
    cborder.removeChild(u)
    usermap.delete(username)    
  } 
}

// The div for link
var linkDiv = document.createElement('div')
oekaki.appendChild(linkDiv)
linkDiv.style = "right: 5px; bottom: 5px; z-index: 9; position: fixed;"

function downloadCanvas(link, filename) {

  var tempcanvas = document.createElement("canvas")
  tempcanvas.width = width
  tempcanvas.height = height
  var tempcontext = tempcanvas.getContext("2d")
  tempcontext.fillStyle = 'white'

  tempcontext.fillRect(0, 0, width, height);

  for (var i = 0; i < layers.length; i++) {
    tempcontext.drawImage(layers[i], 0, 0);
  }

  link.href = tempcanvas.toDataURL("image/png");
  link.download = filename;

}

var downloadLink = document.createElement('a')
downloadLink.style = "margin: 3px; background: #ffe3e3;"
downloadLink.innerHTML = "save"
downloadLink.onclick = function() {
  downloadCanvas(this, 'oekaki.png');
}

var controlLink = document.createElement('a')
controlLink.style = "margin: 3px; background: #ffe3e3;"
controlLink.innerHTML = '<a href="/stuff/controls.html">controls</a>'

linkDiv.appendChild(downloadLink);
linkDiv.appendChild(controlLink);

// UserWindow with chat and so on

var usrinterface = createUserInterface(actionCallback);
var usrwindow = makeWindow(usrinterface, "chat")
minDiv.appendChild(usrwindow);

var maxh = document.documentElement.clientHeight - 380;
var maxw = document.documentElement.clientWidth - 510;

usrwindow.style.top = maxh + "px";
usrwindow.style.left = maxw + "px";    


// a function to provide a draggable, minimizable window
function makeWindow(node, descr) {

  var border = document.createElement('div');
  border.style = "border: 2px solid rgb(70, 65, 130); padding: 0px; position: fixed;";

  border.classList.add("blueback")
  border.classList.add("shadowb")


  var header = document.createElement('div');
  header.style = "height: 22px; background: rgb(70, 65, 130); margin-bottom: 1px; min-width: 50px; display: flex"
  //header.classList.add("blueback")

  var content = document.createElement('div');

  var minButton = document.createElement('div');
  minButton.ismin = false;
  minButton.style = "height: 20px; width: 20px; background: pink;"
  minButton.innerHTML = "[-]"

  
  minButton.onclick = function() {
    if (minButton.ismin) {
      content.style.display = "block"
      minButton.innerHTML = "[-]"
      minButton.ismin = false
      border.style.position = "fixed"
      header.onmousedown = dragMouseDown;
    } else {
      content.style.display = "none"
      minButton.innerHTML = "[+]"
      minButton.ismin = true
      border.style.position = "initial"
      header.onmousedown = null;
    }
  }
  
  header.appendChild(minButton);
  border.appendChild(header);
  content.appendChild(node);
  border.appendChild(content);

  var descrDiv = document.createElement('div')
  descrDiv.style = "color: white; margin-left: 10px"
  descrDiv.innerHTML = descr 
  header.appendChild(descrDiv)


  var offx = 0, offy = 0;

  header.onmousedown = dragMouseDown;
  
  window.addEventListener('resize', function(event){

    var rect = header.getBoundingClientRect();

    var maxh = document.documentElement.clientHeight - rect.height;
    var maxw = document.documentElement.clientWidth - rect.width;

    var newtop = Math.min( parseInt(border.style.top,10), maxh);
    var newleft = Math.min(parseInt(border.style.left,10), maxw);

    newtop = Math.max(0,newtop);
    newleft = Math.max(0,newleft);

    border.style.top = newtop + "px";
    border.style.left = newleft + "px";    
  });

  return border;

  function dragMouseDown(e) {
    //e = e || window.event;

    offx = e.offsetX;
    offy = e.offsetY;

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    //e = e || window.event;

    var rect = header.getBoundingClientRect();

    var maxh = document.documentElement.clientHeight - rect.height;
    var maxw = document.documentElement.clientWidth - rect.width;

    console.log(rect.height);
    console.log(rect.width);

    var newtop = Math.min((e.clientY - offy), maxh);
    var newleft = Math.min((e.clientX - offx), maxw);

    newtop = Math.max(0,newtop);
    newleft = Math.max(0,newleft);

    newtop = Math.round(newtop);
    newleft = Math.round(newleft);

    border.style.top = newtop + "px";
    border.style.left = newleft + "px";
  }

  function closeDragElement() {

    document.onmouseup = null;
    document.onmousemove = null;
  }

}


function promisepng(clearUpdate) {

  return new Promise(function(resolve, reject) {

    var npng = "data:image/png;base64," + clearUpdate.Png

    var drawing = new Image();
    drawing.src = npng

    drawing.onload = function() {
      console.log("this should fire");
      drawPng(drawing, clearUpdate.X, clearUpdate.Y, clearUpdate.Clear, clearUpdate.Layer)
      updateMini();
      resolve()
    };
  });
}


// receives some decoded json and executes the appropriate Action
// won't execute in the desired order
function doActionPromise(m) {

  return new Promise(function(resolve, reject) {

    var pl = m.PLine;
    if (pl !== undefined) {
      var cstring
      if (pl.A == 0) {
        cstring = "erase"
      } else {
        cstring = "rgb(" + pl.R + "," + pl.G + "," + pl.B + ")"
      }
      color =
      plotLine(pl.X0,pl.Y0,pl.X1,pl.Y1,pl.Size,pl.Layer, { R: pl.R, G: pl.G, B: pl.B, A: pl.A} );

      updateUserCursor(m.User, pl.X1, pl.Y1)
      resolve("Line")
    }

    if (m.clearUpdate !== undefined) {

    promisepng(m.clearUpdate).then(function(resloved) {resolve("clearUpdate")})
    
    }

    if (m.admin !== undefined) {
      usrinterface.isadmin = true;
      resolve("whatever")
    }

    if (m.yourname !== undefined) {
      usrinterface.yourName(m.yourname);
      resolve("whatever")
    }

    if (m.register !== undefined) {
      console.log("received register m for:" + m.register)
      addUser(m.register)
      usrinterface.addUser(m.register);
      resolve("whatever")
    }

    if (m.unregister !== undefined) {
      console.log("received unregister m for:" + m.unregister)
      removeUser(m.unregister)
      usrinterface.removeUser(m.unregister);
      resolve("whatever")
    }

    if (m.NameChange !== undefined ) {
      changeName(m.NameChange.from, m.NameChange.to)
      usrinterface.nameChange(m.NameChange);
      resolve("whatever")
    }

    if (m.Cursor !== undefined && m.User !== undefined) {
      updateUserCursor(m.User,m.Cursor.X,m.Cursor.Y)
      resolve("whatever")
    }

    if (m.Text !== undefined) {
      usrinterface.newText(m)
      resolve("whatever")
    }

    if (m.Undo !== undefined ) {
      if (m.User == usrinterface.name) {
        undone()      
      }
      resolve("whatever")
    }

    resolve("whatever")
  });

}
oekaki.doActionPromise = doActionPromise

var highPQueue = []

var messageQueue = []
oekaki.messageQueue = messageQueue

// receives some decoded json and executes the appropriate Action
function messageLoop() {

  if (messageQueue.length != 0) {
    let m = messageQueue.shift()
    doActionPromise(m).then(function(printact) {
      //console.log(printact)
      messageLoop()
    });
  } else {
    window.requestAnimationFrame(messageLoop);
    //setInterval(messageLoop,  10000);
  }

}
oekaki.messageLoop = messageLoop;

messageLoop()


// update the contents of the miniature preview
function updateMini() {
  for (var i = 0; i < num_layers; i++) {
    mini_cntx[i].clearRect(0,0,100,100);
    mini_cntx[i].drawImage(layers[i],0,0,100,100);
  } 
}


// should be called after connecting to register the function which should receive json messages
function initConnection(actionCallback) {
  oekaki.actionCallback = actionCallback;
}
oekaki.initConnection = initConnection;


// some key combos

document.addEventListener("keypress", function(event) {
  console.log(event.ctrlKey)
  console.log(event.which)
  if (event.ctrlKey) {
    var key = event.which
    if (key == 26) { undo(); }
  }

});


// and finally return our our oekaki canvas
return oekaki;
}


