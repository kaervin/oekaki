# お絵描き

Oekaki (Japanese: お絵描き, o- (formal prefix) + e "picture" + kaki "to draw") is a Japanese term used to describe the act of drawing a picture.

This is the cooperative oekaki software that is used by http://channel.moe
Open a room, join one, or host your own.

With it, you can draw together, but undo seperately.
This is achieved by storing the drawcalls of all users, and recreating the necessary portion of the canvas.
To make things faster in the case of recreation, the canvas content gets cached every so often.

## How to use:

go get https://gitlab.com/kaervin/oeakaki
Then build it, and (on linux) setcap for it to use the http port with:
```
setcap CAP_NET_BIND_SERVICE=+eip dir_of_executable
```

Currently the executable looks for the 'stuff' and 'templates' folders in the working directory, so copy them to wherever.
Room data gets saved in the working directory as well.

Set the admin name and password in oekaki.go to whatever you wish.
Don't commit your password accidentially. 
Via the admin page you can create named permanent rooms.


This software has only been tested on Linux, and with recent versions of Chrome and Firefox

If you have any questions, feel free to mail kyouko@channel.moe