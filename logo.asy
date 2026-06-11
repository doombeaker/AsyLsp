// AsyLsp Logo — 128x128 minimal geometric icon
// Render: asy -f png -o logo.png logo.asy

settings.render = 0;
settings.outformat = "png";
size(128, 128);

pen bg    = rgb(0.09, 0.11, 0.19);   // deep navy
pen white = rgb(0.96, 0.96, 0.96);   // off-white
pen gold  = rgb(0.98, 0.76, 0.15);   // warm gold

fill(box((0, 0), (128, 128)), bg);

pair O = (64, 64);
real R = 48;

// Outer circle ring
draw(circle(O, R), white + 3.5);

// "A" shape — two thick diagonal strokes
real top_y = 93;
real bot_y = 38;
real span  = 20;

draw((O.x - span, bot_y) -- (O.x, top_y + 1), white + 8.5);
draw((O.x + span, bot_y) -- (O.x, top_y + 1), white + 8.5);

// Crossbar
draw((O.x - span * 0.7, 57) -- (O.x + span * 0.7, 57), white + 5);

// Gold accent dots on each side
real dotR = 3.5;
fill(circle((O.x - R + 14, O.y), dotR), gold);
fill(circle((O.x + R - 14, O.y), dotR), gold);
