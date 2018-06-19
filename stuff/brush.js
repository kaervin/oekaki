// TODO: encapsulation sucks. Bring everything to oekaki.js and just simply update the state of oekaki
// no stupid overused callbackfuckery 


// creates the Brushmenu (obviously)
// the updatefunc is given the parameters for the brush and a cursor image
function createBrushMenu(updatefunc) {

// mode can either be draw or erase
var mode = "draw";
// type can be square or round (more to come potentially)
var type = "square";
var size = "1";
var color = "red"

var brushMenu = document.createElement("div");
brushMenu.style = "width:210px; ";
brushMenu.classList.add("lightb");

var drawButton = document.createElement("button");
drawButton.innerHTML = "draw";
drawButton.onclick = function() {
	mode = "draw";
	updateBrush();
}

var eraseButton = document.createElement("button");
eraseButton.innerHTML = "erase";
eraseButton.onclick = function() {
	mode = "erase";
	updateBrush();
}

var clpickButton = document.createElement("button");
clpickButton.innerHTML = "pick color";
clpickButton.onclick = function() {
  mode = "clpick";
  updateBrush();
}

// makes slider logarithmic
function logValue(position) {
  var minv = Math.log(1);
  var maxv = Math.log(10);

  // calculate adjustment factor
  var scale = (maxv-minv) / (10-1);

  return Math.exp(minv + scale*(position-1));
}

let slider = document.createElement("input");
slider.type = "range";
slider.min = 1;
slider.max = 10;
slider.value = 1;
let sizeout = document.createElement("div");
csize = Math.round(logValue(slider.value));
sizeout.innerHTML = csize;
slider.oninput = function() {
  size = Math.round(logValue(this.value));
  sizeout.innerHTML = size;
  updateBrush();
}


function pixelDistance(fromX, fromY, toX, toY) {
  var vX = toX - fromX
  var vY = toY - fromY
  return Math.sqrt( Math.pow(vX,2) + Math.pow(vY,2) )
}

var brush = document.createElement("canvas");
var brush_cntx = brush.getContext("2d");
brush.height = 30;
brush.width = 30;

function updateBrush() {

    brush_cntx.fillStyle = color;

    brush_cntx.clearRect(0,0,30,30);


	for (var i = 0; i < 30; i++) {
  		for (var j = 0; j < 30; j++) {
			var dist = pixelDistance(15, 15, i, j)
		    if ( (dist) <= size-0.5 ) {
		      brush_cntx.fillRect(i, j , 1, 1);
		    }
  		}
	}

	updatefunc(mode, type, size, brush);

}

brushMenu.appendChild(drawButton);
brushMenu.appendChild(eraseButton);
brushMenu.appendChild(clpickButton);

brushMenu.appendChild(slider);
brushMenu.appendChild(sizeout);

function setColor(c) {
	color = c;
	updateBrush();
}
brushMenu.setColor = setColor;

updateBrush();

return brushMenu;
}