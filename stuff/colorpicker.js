

function createColorPicker(updatefunc) {

var hue = -1
var saturation = 100
var value = 100

var colorPicker = document.createElement("div");
colorPicker.style = "width:190px;";
colorPicker.classList.add("lightb");


var colorSVRect = document.createElement("canvas")
colorSVRect.style = "position: relative; top: 45px; left: 45px;"
var colorSVRect_cntx = colorSVRect.getContext("2d");

var colorHRect = document.createElement("canvas")
//colorHRect.style = "position: absolute;"
colorHRect.style = "position: absolute; top: 5px; left: 5px;"

var colorHRect_cntx = colorHRect.getContext("2d");

var SVMarker = document.createElement("div")
SVMarker.style = "height:10px; width:10px; border:1px solid magenta; position: absolute; pointer-events: none;"

var HMarker = document.createElement("div")
HMarker.style = "height:0px; width:184px; position: absolute; pointer-events: none; top: 95px; left: 3px;"

var H2Marker = document.createElement("div")
H2Marker.style = "height:6px; width: 18px; position: absolute; pointer-events: none; border: 1px solid black; top: -3px;"
HMarker.appendChild(H2Marker);


colorSVRect.height = 101
colorSVRect.width = 101

colorHRect.height = 180
colorHRect.width = 180

var colorHSV = document.createElement("div");
colorHSV.style = "width: 190px; height: 190px; position: relative;"

colorPicker.appendChild(colorHSV);

colorHSV.appendChild(colorHRect);
colorHSV.appendChild(HMarker);

colorHSV.appendChild(colorSVRect);

colorHSV.appendChild(SVMarker);


var HSlider = document.createElement("input");
var SSlider = document.createElement("input");
var VSlider = document.createElement("input");

HSlider.type = "number";
HSlider.min = 0;
HSlider.max = 360;
HSlider.value = 0;
HSlider.oninput = function() {
  setHSV(this.value,saturation,value) 
}

SSlider.type = "number";
SSlider.min = 0;
SSlider.max = 100;
SSlider.value = 0;
SSlider.oninput = function() {
  setHSV(hue,this.value,value) 
}

VSlider.type = "number";
VSlider.min = 0;
VSlider.max = 100;
VSlider.value = 0;
VSlider.oninput = function() {
   setHSV(hue,saturation,this.value) 
}


var HLabel = document.createElement("div");
var SLabel = document.createElement("div");
var VLabel = document.createElement("div");

HLabel.style.width = "30px";
SLabel.style.width = "30px";
VLabel.style.width = "30px";

var Hout = document.createElement("div");
var Sout = document.createElement("div");
var Vout = document.createElement("div");

Hout.className = "sliderout"
Sout.className = "sliderout"
Vout.className = "sliderout"

/*
colorPicker.appendChild(Hout);
colorPicker.appendChild(Sout);
colorPicker.appendChild(Vout);

Hout.appendChild(HLabel);
Sout.appendChild(SLabel);
Vout.appendChild(VLabel);

Hout.appendChild(HSlider);
Sout.appendChild(SSlider);
Vout.appendChild(VSlider);
*/
Palette = document.createElement('div');
Palette.style = "border: 1px solid black; display: flex; flex-wrap: wrap; width: 180px; margin: auto; margin-top: 10px; margin-bottom: 10px;"

for (var i = 0; i < 18; i++) {
    var pcol = document.createElement('div');
    pcol.style = "width:16px; height:16px; border: 1px solid black; margin: 1px;"
    pcol.onmousedown = function(event) {

        if (event.button == 0 && this.hue != null) {
            setHSV(this.hue,this.saturation,this.value);
        }

        if (event.button == 2) {
            var c = hsvToRgbString(hue,saturation,value)
            this.style.background = c.string
            this.hue = hue;
            this.saturation = saturation;
            this.value = value;
        }
    }
    pcol.oncontextmenu = function() {return false;};
    Palette.appendChild(pcol);
}

colorPicker.appendChild(Palette);

colorPicker.updatefunc = updatefunc



function setHSV(h,s,v) {

    var lasthue = hue

    hue = Math.round( Math.min(Math.max(h,0),360))
    saturation = Math.min(Math.max(s,0),100)
    value = Math.min(Math.max(v,0),100)

    // SVRect
    if (lasthue != hue) {
    // update the SVRects context to match the selected hue
        for (var i = 0; i <= colorSVRect.height; i++) {
            for (var j = 0; j <= colorSVRect.width; j++) {
                let c = hsvToRgbString(hue,i,j);
                colorSVRect_cntx.fillStyle = c.string;
                colorSVRect_cntx.fillRect(i, j, 1, 1);
            }
        }    
    }


    HSlider.value = hue
    SSlider.value = saturation
    VSlider.value = value

    HLabel.innerHTML = hue
    SLabel.innerHTML = saturation
    VLabel.innerHTML = value

    if (colorPicker.updatefunc != null) {
        colorPicker.updatefunc(hsvToRgbString(hue,saturation,value))
    }

    var c = hsvToRgbString(hue-180,100,100);
    SVMarker.style.left = (saturation + 40) + "px";
    SVMarker.style.top = (value + 40) + "px";
    SVMarker.style.border = "1px solid " + c.string;

    HMarker.style.transform = "rotate(" + hue + "deg)"


}

// basically init everything via setting setHSV

for (var i = 0; i < colorHRect.height; i++) {
  for (var j = 0; j < colorHRect.width; j++) {
    var dist = Math.round( pixelDistance(89.5, 89.5, i, j) )
    if ( dist < 91 && dist > 75 ) {
      var c = hsvToRgbString( pixelDegree(90, 90, i, j) ,100,100 );
      colorHRect_cntx.fillStyle = c.string;
      colorHRect_cntx.fillRect(i, j , 1, 1);          
    }
  }
}


// taken from https://gist.github.com/eyecatchup/9536706
// but fixed
function hsvToRgbString(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;
     
    // Make sure our arguments stay in-range
    //h = Math.max(0, Math.min(360, h));

    h = h + 360
    h = h % 360

    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));
     
    // We accept saturation and value arguments from 0 to 100 because that's
    // how Photoshop represents those values. Internally, however, the
    // saturation and value are calculated from a range of 0 to 1. We make
    // That conversion here.
    s /= 100;
    v /= 100;
     
    if(s == 0) {
        // Achromatic (grey)
        r = g = b = v;
        
        var R = Math.round(r * 255)
        var G = Math.round(g * 255)
        var B = Math.round(b * 255)
        
        return { 'R': R, 'G': G, 'B': B, 'A': 255, 'string': 'rgb(' + R + ',' + G + ',' + B + ')' }
    }
     
    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));
     
    switch(i) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
     
        case 1:
            r = q;
            g = v;
            b = p;
            break;
     
        case 2:
            r = p;
            g = v;
            b = t;
            break;
     
        case 3:
            r = p;
            g = q;
            b = v;
            break;
     
        case 4:
            r = t;
            g = p;
            b = v;
            break;
     
        case 5: // case 5:
            r = v;
            g = p;
            b = q;
            break;

        case 6:
            r = v;
            g = t;
            b = p;
            break;
    }

    var R = Math.round(r * 255)
    var G = Math.round(g * 255)
    var B = Math.round(b * 255)

    return { 'R': R, 'G': G, 'B': B, 'A': 255, 'string': 'rgb(' + R + ',' + G + ',' + B + ')' }
}

// gives us some degree of the vector (from, to)
function pixelDegree(fromX, fromY, toX, toY) {
  var vX = toX - fromX
  var vY = toY - fromY
  return (Math.atan2(vY, vX) * 180 / Math.PI) + 180;
}

function pixelDistance(fromX, fromY, toX, toY) {
  var vX = toX - fromX
  var vY = toY - fromY
  return Math.sqrt( Math.pow(vX,2) + Math.pow(vY,2) )
}

colorHRect.onmousedown = function(event) {

    if (event.button == 0) {
        var rect = colorHRect.getBoundingClientRect();
        var x = Math.round(event.clientX - rect.left + 1);
        var y = Math.round(event.clientY - rect.top + 1);


        var dist = pixelDistance(90, 90, x, y)
        if ( dist < 100 && dist > 70 ) {
            h = pixelDegree(90, 90, x, y)
            console.log(h)
            setHSV( h ,saturation,value)

            document.onmousemove = HRectDrag

            document.onmouseup = function(event) {
                document.onmousemove = null;
            }
        }
    }
}


colorPicker.onmouseenter = function(event) {
    colorHRect.style.opacity = 1
    colorSVRect.style.opacity = 1
}

colorPicker.onmouseleave = function(event) {
    colorHRect.style.opacity = 0.5
    colorSVRect.style.opacity = 0.5
}

colorHRect.style.opacity = 0.5
colorSVRect.style.opacity = 0.5

HRectDrag = function(event) {
    var rect = colorHRect.getBoundingClientRect();
    var x = Math.round(event.clientX - rect.left + 1);
    var y = Math.round(event.clientY - rect.top + 1);

    var dist = pixelDistance(90, 90, x, y)
    if (dist > 30) {
        setHSV( pixelDegree(90, 90, x, y) ,saturation,value)
    }
}

colorSVRect.onmousedown = function(event) {

    if (event.button == 0) {
        var rect = colorSVRect.getBoundingClientRect();
        var x = Math.round(event.clientX - rect.left + 1);
        var y = Math.round(event.clientY - rect.top + 1);

        setHSV(hue,x,y)
        document.onmousemove = SVDrag
        document.onmouseup = function(event) {
            document.onmousemove = null;
        }
    }


}

SVDrag = function(event) {
    var rect = colorSVRect.getBoundingClientRect();
    var x = Math.round(event.clientX - rect.left + 1);
    var y = Math.round(event.clientY - rect.top + 1);
    setHSV(hue,x,y)	
}





function setRGB(r,g,b) {

    r = r/255
    g = g/255
    b = b/255

    var max = Math.max(r,g,b)
    var min = Math.min(r,g,b)

    var delta = max - min

    var v = max
    var s = 0
    var h = 0

    if (max != 0) {
        s = (max - min) / max
    }

    if (max != min) {
        if (r == max) { h =  (g-b)/delta }
        if (g == max) { h = 2 + ((b-r)/delta) }
        if (b == max) { h = 4 + ((r-g)/delta) }        
    }

    h = h * 60
    if (h < 0) {
        h = h + 360
    }

    h = Math.round(h)
    s = Math.round(s*100)
    v = Math.round(v*100)

    setHSV(h,s,v);
}
colorPicker.setRGB = setRGB;

setHSV(hue,saturation,value);
return colorPicker

}

