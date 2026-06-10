// symbol database for Asymptote language
// keywords, built-in types, constants, functions, standard library modules

// ========== LANGUAGE KEYWORDS ==========
export const keywords: string[] = [
  'if', 'else', 'while', 'for', 'do', 'return',
  'break', 'continue', 'struct', 'typedef', 'using',
  'new', 'operator', 'this', 'explicit',
  'import', 'include', 'access', 'from', 'unravel', 'quote',
  'static', 'autounravel',
  'public', 'private', 'restricted',
  'and', 'controls', 'tension', 'atleast', 'curl',
];

// ========== CONTROL FLOW KEYWORDS (for completion with snippet) ==========
export const controlFlowKeywords: { label: string; insertText: string; detail: string }[] = [
  { label: 'if', insertText: 'if (${1:condition}) {\n\t$0\n}', detail: 'if statement' },
  { label: 'if/else', insertText: 'if (${1:condition}) {\n\t$2\n} else {\n\t$3\n}', detail: 'if-else statement' },
  { label: 'while', insertText: 'while (${1:condition}) {\n\t$0\n}', detail: 'while loop' },
  { label: 'for', insertText: 'for (${1:init}; ${2:test}; ${3:update}) {\n\t$0\n}', detail: 'for loop' },
  { label: 'for-each', insertText: 'for (${1:type} ${2:var} : ${3:array}) {\n\t$0\n}', detail: 'for-each loop' },
  { label: 'do/while', insertText: 'do {\n\t$1\n} while (${2:condition});', detail: 'do-while loop' },
  { label: 'return', insertText: 'return ${1:value};', detail: 'return statement' },
  { label: 'struct', insertText: 'struct ${1:Name} {\n\t$0\n}', detail: 'struct definition' },
];

// ========== PRIMITIVE TYPES ==========
export const builtinTypes: { label: string; detail: string }[] = [
  { label: 'void', detail: 'Void type' },
  { label: 'bool', detail: 'Boolean type' },
  { label: 'int', detail: 'Integer type' },
  { label: 'real', detail: 'Real (double) type' },
  { label: 'string', detail: 'String type' },
  { label: 'pair', detail: '2D point/vector (real, real)' },
  { label: 'triple', detail: '3D point/vector (real, real, real)' },
  { label: 'transform', detail: '2D affine transformation' },
  { label: 'guide', detail: 'Unresolved cubic spline' },
  { label: 'path', detail: 'Resolved 2D path' },
  { label: 'path3', detail: 'Resolved 3D path' },
  { label: 'pen', detail: 'Drawing pen (color, width, cap, join, etc.)' },
  { label: 'picture', detail: 'Picture/frame container' },
  { label: 'frame', detail: 'Picture frame (alias for picture)' },
  { label: 'file', detail: 'File handle' },
  { label: 'code', detail: 'Compiled code reference' },
];

// ========== BUILT-IN CONSTANTS ==========
export const constants: { label: string; detail: string }[] = [
  { label: 'true', detail: 'Boolean true' },
  { label: 'false', detail: 'Boolean false' },
  { label: 'null', detail: 'Null value' },
  { label: 'cycle', detail: 'Cycle specifier for closed paths' },
  { label: 'newframe', detail: 'New picture frame' },
  { label: 'pi', detail: 'π (3.14159...)' },
  { label: 'inf', detail: 'Infinity' },
  { label: 'infinity', detail: 'Infinity' },
  { label: 'nan', detail: 'Not a Number' },
  { label: 'VERSION', detail: 'Asymptote version string' },
  { label: 'realEpsilon', detail: 'Machine epsilon for real' },
  { label: 'realDigits', detail: 'Number of significant digits in real' },
  { label: 'realMin', detail: 'Minimum positive real value' },
  { label: 'realMax', detail: 'Maximum real value' },
  { label: 'intMax', detail: 'Maximum int value' },
  { label: 'intMin', detail: 'Minimum int value' },
  { label: 'randMax', detail: 'Maximum random int value' },
  { label: 'currentpen', detail: 'Current default pen' },
  { label: 'currentpicture', detail: 'Current picture' },
  { label: 'defaultpen', detail: 'Default pen' },
  { label: 'zero', detail: 'Zero pair/triple value' },
];

// ========== BUILT-IN FUNCTION SIGNATURES ==========
export interface FuncSignature {
  label: string;
  insertText: string;
  detail: string;
  documentation?: string;
  signatures?: FuncSignatureDetail[];
}

export interface FuncSignatureDetail {
  label: string;
  parameters: { label: string; documentation?: string }[];
  documentation?: string;
}

export const builtinFunctions: FuncSignature[] = [
  // === Drawing Functions ===
  { label: 'draw', insertText: 'draw(${1:path/image/picture}${2:, pen});', detail: 'Draw path, image, or picture', signatures: [
    { label: 'draw(picture pic, path g, pen p=currentpen)', parameters: [
      { label: '(pic, g, p)' },
    ] },
    { label: 'draw(picture pic, path[] g, pen p=currentpen)', parameters: [
      { label: '(pic, g[], p)' },
    ] },
    { label: 'draw(picture pic, explicit pair z, L=Label)', parameters: [
      { label: '(pic, z, L)' },
    ] },
    { label: 'draw(picture pic, guide[] g, pen p=currentpen)', parameters: [
      { label: '(pic, g[], p)' },
    ] },
    { label: 'draw(picture pic, frame f, pair position, ...)', parameters: [
      { label: '(pic, f, pos, ...)' },
    ] },
    { label: 'draw(path g, pen p=currentpen)', parameters: [{ label: '(g, p)' }] },
    { label: 'draw(path[] g, pen p=currentpen)', parameters: [{ label: '(g[], p)' }] },
    { label: 'draw(picture pic=currentpicture, ...)', parameters: [{ label: '(pic, ...)' }] },
  ] },
  { label: 'fill', insertText: 'fill(${1:path}${2:, pen});', detail: 'Fill a path', signatures: [
    { label: 'fill(picture pic, path g, pen p=currentpen)', parameters: [{ label: '(pic, g, p)' }] },
    { label: 'fill(picture pic, path[] g, pen p=currentpen)', parameters: [{ label: '(pic, g[], p)' }] },
    { label: 'fill(path g, pen p=currentpen)', parameters: [{ label: '(g, p)' }] },
    { label: 'fill(path[] g, pen p=currentpen)', parameters: [{ label: '(g[], p)' }] },
  ] },
  { label: 'filldraw', insertText: 'filldraw(${1:path}${2:, fillpen}${3:, drawpen});', detail: 'Fill and draw a path', signatures: [
    { label: 'filldraw(picture pic, path g, pen fillpen, pen drawpen=currentpen)', parameters: [{ label: '(pic, g, fillpen, drawpen)' }] },
    { label: 'filldraw(path g, pen fillpen=currentpen, pen drawpen=currentpen)', parameters: [{ label: '(g, fillpen, drawpen)' }] },
  ] },
  { label: 'label', insertText: 'label(${1:Label}${2:, position}${3:, align});', detail: 'Add a label to current picture', signatures: [
    { label: 'label(picture pic, Label L, pair position, align align=NoAlign)', parameters: [{ label: '(pic, L, pos, align)' }] },
    { label: 'label(picture pic, Label L, path g, align align=NoAlign)', parameters: [{ label: '(pic, L, g, align)' }] },
    { label: 'label(Label L, pair position, align align=NoAlign)', parameters: [{ label: '(L, pos, align)' }] },
    { label: 'label(Label L, path g, align align=NoAlign)', parameters: [{ label: '(L, g, align)' }] },
    { label: 'label(picture pic=currentpicture, Label L, ...)', parameters: [{ label: '(pic, L, ...)' }] },
  ] },
  { label: 'clip', insertText: 'clip(${1:path});', detail: 'Clip to a path', signatures: [
    { label: 'clip(picture pic, path g)', parameters: [{ label: '(pic, g)' }] },
    { label: 'clip(path g)', parameters: [{ label: '(g)' }] },
  ] },
  { label: 'shipout', insertText: 'shipout(${1:prefix}${2:, picture});', detail: 'Ship out a picture', signatures: [
    { label: 'shipout(string prefix, picture pic=currentpicture)', parameters: [{ label: '(prefix, pic)' }] },
  ] },
  { label: 'add', insertText: 'add(${1:picture/drawable});', detail: 'Add a picture or drawable element to currentpicture', signatures: [
    { label: 'add(picture pic, frame f)', parameters: [{ label: '(pic, f)' }] },
    { label: 'add(frame f)', parameters: [{ label: '(f)' }] },
  ] },
  { label: 'dot', insertText: 'dot(${1:pair/guide}${2:, pen});', detail: 'Draw a dot', signatures: [
    { label: 'dot(picture pic, pair z, pen p=currentpen)', parameters: [{ label: '(pic, z, p)' }] },
    { label: 'dot(picture pic, pair[] z, pen p=currentpen)', parameters: [{ label: '(pic, z[], p)' }] },
    { label: 'dot(pair z, pen p=currentpen)', parameters: [{ label: '(z, p)' }] },
    { label: 'dot(pair[] z, pen p=currentpen)', parameters: [{ label: '(z[], p)' }] },
  ] },
  { label: 'erase', insertText: 'erase(${1:picture});', detail: 'Erase picture', signatures: [
    { label: 'erase(picture pic)', parameters: [{ label: '(pic)' }] },
  ] },

  // === Math Functions ===
  { label: 'sin', insertText: 'sin(${1:real/pair})', detail: 'Sine function (real or pair)', signatures: [
    { label: 'sin(real x)', parameters: [{ label: '(x)' }] },
    { label: 'sin(pair z)', parameters: [{ label: '(z)' }] },
  ] },
  { label: 'cos', insertText: 'cos(${1:real})', detail: 'Cosine function', signatures: [
    { label: 'cos(real x)', parameters: [{ label: '(x)' }] },
    { label: 'cos(pair z)', parameters: [{ label: '(z)' }] },
  ] },
  { label: 'tan', insertText: 'tan(${1:real})', detail: 'Tangent function', signatures: [
    { label: 'tan(real x)', parameters: [{ label: '(x)' }] },
  ] },
  { label: 'asin', insertText: 'asin(${1:real})', detail: 'Arc sine', signatures: [
    { label: 'asin(real x)', parameters: [{ label: '(x)' }] },
  ] },
  { label: 'acos', insertText: 'acos(${1:real})', detail: 'Arc cosine', signatures: [
    { label: 'acos(real x)', parameters: [{ label: '(x)' }] },
  ] },
  { label: 'atan', insertText: 'atan(${1:real})', detail: 'Arc tangent', signatures: [
    { label: 'atan(real x)', parameters: [{ label: '(x)' }] },
  ] },
  { label: 'atan2', insertText: 'atan2(${1:y}, ${2:x})', detail: 'Arc tangent of y/x', signatures: [
    { label: 'atan2(real y, real x)', parameters: [{ label: '(y, x)' }] },
  ] },
  { label: 'sinh', insertText: 'sinh(${1:real})', detail: 'Hyperbolic sine' },
  { label: 'cosh', insertText: 'cosh(${1:real})', detail: 'Hyperbolic cosine' },
  { label: 'tanh', insertText: 'tanh(${1:real})', detail: 'Hyperbolic tangent' },
  { label: 'exp', insertText: 'exp(${1:real/pair})', detail: 'Exponential function' },
  { label: 'log', insertText: 'log(${1:real})', detail: 'Natural logarithm' },
  { label: 'log10', insertText: 'log10(${1:real})', detail: 'Logarithm base 10' },
  { label: 'sqrt', insertText: 'sqrt(${1:real/pair})', detail: 'Square root' },
  { label: 'cbrt', insertText: 'cbrt(${1:real})', detail: 'Cube root' },
  { label: 'abs', insertText: 'abs(${1:real/int/pair/triple})', detail: 'Absolute value / magnitude' },
  { label: 'fabs', insertText: 'fabs(${1:real})', detail: 'Floating-point absolute value' },
  { label: 'expm1', insertText: 'expm1(${1:real})', detail: 'exp(x)-1 (accurate for small x)' },
  { label: 'log1p', insertText: 'log1p(${1:real})', detail: 'log(1+x) (accurate for small x)' },
  { label: 'pow', insertText: 'pow(${1:base}, ${2:exponent})', detail: 'Power function' },
  { label: 'pow10', insertText: 'pow10(${1:x})', detail: '10^x' },
  { label: 'floor', insertText: 'floor(${1:real})', detail: 'Floor' },
  { label: 'ceil', insertText: 'ceil(${1:real})', detail: 'Ceiling' },
  { label: 'round', insertText: 'round(${1:real}, ${2:n})', detail: 'Round to n decimal places' },
  { label: 'min', insertText: 'min(${1:a}, ${2:b})', detail: 'Minimum value', signatures: [
    { label: 'min(T a, T b)', parameters: [{ label: '(a, b)' }] },
    { label: 'min(T[] a)', parameters: [{ label: '(a[])' }] },
  ] },
  { label: 'max', insertText: 'max(${1:a}, ${2:b})', detail: 'Maximum value', signatures: [
    { label: 'max(T a, T b)', parameters: [{ label: '(a, b)' }] },
    { label: 'max(T[] a)', parameters: [{ label: '(a[])' }] },
  ] },
  { label: 'sum', insertText: 'sum(${1:array})', detail: 'Sum of array elements' },
  { label: 'interp', insertText: 'interp(${1:a}, ${2:b}, ${3:t})', detail: 'Linear interpolation a*(1-t)+b*t' },
  { label: 'sort', insertText: 'sort(${1:array}, ${2:less}, ${3:stable})', detail: 'Sort array' },
  { label: 'search', insertText: 'search(${1:array}, ${2:key})', detail: 'Search sorted array' },
  { label: 'degrees', insertText: 'degrees(${1:radians})', detail: 'Convert radians to degrees' },
  { label: 'radians', insertText: 'radians(${1:degrees})', detail: 'Convert degrees to radians' },
  { label: 'dot', insertText: 'dot(${1:a}, ${2:b})', detail: 'Dot product of pairs/triples', signatures: [
    { label: 'dot(pair a, pair b)', parameters: [{ label: '(a, b)' }] },
    { label: 'dot(triple a, triple b)', parameters: [{ label: '(a, b)' }] },
  ] },
  { label: 'cross', insertText: 'cross(${1:a}, ${2:b})', detail: 'Cross product' },
  { label: 'unit', insertText: 'unit(${1:pair/triple})', detail: 'Unit vector' },
  { label: 'length', insertText: 'length(${1:array/path/string})', detail: 'Length of array, path, or string' },

  // === Pair / Triple Functions ===
  { label: 'xpart', insertText: 'xpart(${1:pair/triple})', detail: 'x component' },
  { label: 'ypart', insertText: 'ypart(${1:pair/triple})', detail: 'y component' },
  { label: 'zpart', insertText: 'zpart(${1:triple})', detail: 'z component' },
  { label: 'conj', insertText: 'conj(${1:pair/triple})', detail: 'Complex conjugate' },
  { label: 'angle', insertText: 'angle(${1:pair}, ${2:warn})', detail: 'Angle of pair in radians [0, 2π]' },
  { label: 'polar', insertText: 'polar(${1:radius}, ${2:angle})', detail: 'Polar coordinates to pair' },
  { label: 'dir', insertText: 'dir(${1:degrees}, ${2:pair})', detail: 'Direction vector' },
  { label: 'abs2', insertText: 'abs2(${1:pair/triple})', detail: 'Squared magnitude' },

  // === Transform Functions ===
  { label: 'scale', insertText: 'scale(${1:sx}, ${2:sy})', detail: 'Scale transform', signatures: [
    { label: 'scale(real s)', parameters: [{ label: '(s)' }] },
    { label: 'scale(real sx, real sy)', parameters: [{ label: '(sx, sy)' }] },
    { label: 'scale(real sx, real sy, real sz)', parameters: [{ label: '(sx, sy, sz)' }] },
  ] },
  { label: 'rotate', insertText: 'rotate(${1:angle}, ${2:z})', detail: 'Rotation transform', signatures: [
    { label: 'rotate(real angle)', parameters: [{ label: '(angle)' }] },
    { label: 'rotate(real angle, pair z)', parameters: [{ label: '(angle, z)' }] },
  ] },
  { label: 'shift', insertText: 'shift(${1:pair/triple})', detail: 'Translation transform' },
  { label: 'reflect', insertText: 'reflect(${1:a}, ${2:b})', detail: 'Reflection transform' },
  { label: 'slant', insertText: 'slant(${1:s})', detail: 'Slant/skew transform' },
  { label: 'inverse', insertText: 'inverse(${1:transform})', detail: 'Inverse transform' },
  { label: 'identity', insertText: 'identity', detail: 'Identity transform' },

  // === Array / Collection Functions ===
  { label: 'array', insertText: 'array(${1:n}, ${2:value}, ${3:depth})', detail: 'Create array of n copies of value' },
  { label: 'copy', insertText: 'copy(${1:array}, ${2:depth})', detail: 'Deep copy array' },
  { label: 'map', insertText: 'map(${1:function}, ${2:array})', detail: 'Apply function to each element' },
  { label: 'sequence', insertText: 'sequence(${1:function}, ${2:n})', detail: 'Create array from function' },
  { label: 'concat', insertText: 'concat(${1:...arrays})', detail: 'Concatenate arrays' },
  { label: 'alias', insertText: 'alias(${1:a}, ${2:b})', detail: 'Make array a reference to b' },
  { label: 'push', insertText: 'push(${1:array}, ${2:...items})', detail: 'Push items to end of array' },
  { label: 'append', insertText: 'append(${1:array}, ${2:other})', detail: 'Append another array' },
  { label: 'pop', insertText: 'pop(${1:array})', detail: 'Pop last element' },
  { label: 'insert', insertText: 'insert(${1:array}, ${2:...items})', detail: 'Insert before beginning' },
  { label: 'delete', insertText: 'delete(${1:array}, ${2:i}, ${3:j})', detail: 'Delete elements from array' },
  { label: 'transpose', insertText: 'transpose(${1:array})', detail: 'Transpose 2D/3D array' },
  { label: 'diagonal', insertText: 'diagonal(${1:array})', detail: 'Extract diagonal elements' },

  // === String Functions ===
  { label: 'substr', insertText: 'substr(${1:string}, ${2:start}, ${3:length})', detail: 'Substring' },
  { label: 'find', insertText: 'find(${1:string}, ${2:pattern}, ${3:pos})', detail: 'Find substring' },
  { label: 'rfind', insertText: 'rfind(${1:string}, ${2:pattern}, ${3:pos})', detail: 'Reverse find' },
  { label: 'replace', insertText: 'replace(${1:text}, ${2:before}, ${3:after})', detail: 'Replace substring' },
  { label: 'split', insertText: 'split(${1:string}, ${2:delimiter})', detail: 'Split string into array' },
  { label: 'join', insertText: 'join(${1:array}, ${2:separator})', detail: 'Join array into string' },
  { label: 'format', insertText: 'format(${1:formatString}, ${2:...args})', detail: 'C-style format' },
  { label: 'hex', insertText: 'hex(${1:int})', detail: 'Hexadecimal string' },

  // === I/O Functions ===
  { label: 'write', insertText: 'write(${1:value}${2:, file}${3:, suffix})', detail: 'Write to stdout or file', signatures: [
    { label: 'write(T value, file file=stdout, void() suffix=none)', parameters: [{ label: '(value, file, suffix)' }] },
    { label: 'write(string s, file file=stdout, void() suffix=none)', parameters: [{ label: '(s, file, suffix)' }] },
    { label: 'write(file file, ...)', parameters: [{ label: '(file, ...)' }] },
  ] },
  { label: 'input', insertText: 'input(${1:filename}, ${2:check})', detail: 'Read file as Asymptote code' },
  { label: 'output', insertText: 'output(${1:filename}, ${2:update})', detail: 'Set output file' },
  { label: 'eof', insertText: 'eof(${1:file})', detail: 'Check end of file' },
  { label: 'eol', insertText: 'eol(${1:file})', detail: 'Check end of line' },
  { label: 'error', insertText: 'error(${1:message})', detail: 'Report error' },
  { label: 'warning', insertText: 'warning(${1:category}, ${2:message})', detail: 'Report warning' },
  { label: 'exit', insertText: 'exit()', detail: 'Exit Asymptote' },

  // === Path Construction ===
  { label: 'box', insertText: 'box(${1:min}, ${2:max})', detail: 'Rectangle path from min to max' },
  { label: 'circle', insertText: 'circle(${1:center}, ${2:radius})', detail: 'Circle path' },
  { label: 'ellipse', insertText: 'ellipse(${1:center}, ${2:a}, ${3:b})', detail: 'Ellipse path' },
  { label: 'arc', insertText: 'arc(${1:center}, ${2:from}, ${3:to})', detail: 'Circular arc' },
  { label: 'graph', insertText: 'graph(${1:f}, ${2:a}, ${3:b}${4:, n})', detail: 'Graph of a function', signatures: [
    { label: 'graph(real f(real), real a, real b, int n=ngraph)', parameters: [{ label: '(f, a, b, n)' }] },
    { label: 'graph(real f(real), real a, real b, int n, real T(real))', parameters: [{ label: '(f, a, b, n, T)' }] },
    { label: 'graph(pair f(real), real a, real b, int n=ngraph)', parameters: [{ label: '(f, a, b, n)' }] },
    { label: 'graph(pair z(real, real), ...)', parameters: [{ label: '(z, ...)' }] },
  ] },
  { label: 'polygon', insertText: 'polygon(${1:n})', detail: 'Regular n-gon' },
  { label: 'ngon', insertText: 'ngon(${1:center}, ${2:radius}, ${3:n})', detail: 'Regular n-gon at center' },
  { label: 'cross', insertText: 'cross(${1:center}, ${2:size})', detail: 'Cross mark (pensize 4)' },

  // === Settings Functions ===
  { label: 'size', insertText: 'size(${1:width}, ${2:height}, ${3:keepAspect})', detail: 'Set picture size', signatures: [
    { label: 'size(real x, real y=0, bool keepAspect=Aspect)', parameters: [{ label: '(x, y, keepAspect)' }] },
    { label: 'size(picture pic, real x, real y=0, bool keepAspect=Aspect)', parameters: [{ label: '(pic, x, y, keepAspect)' }] },
  ] },
  { label: 'unitsize', insertText: 'unitsize(${1:x}, ${2:y})', detail: 'Set unit size', signatures: [
    { label: 'unitsize(real x, real y=x)', parameters: [{ label: '(x, y)' }] },
    { label: 'unitsize(picture pic, real x, real y=x)', parameters: [{ label: '(pic, x, y)' }] },
  ] },
  { label: 'newpage', insertText: 'newpage(${1:picture})', detail: 'Start new page' },
  { label: 'save', insertText: 'save()', detail: 'Save graphics state' },
  { label: 'restore', insertText: 'restore()', detail: 'Restore graphics state' },
  { label: 'layer', insertText: 'layer(${1:picture})', detail: 'Start new layer' },

  // === Pen construction functions ===
  { label: 'rgb', insertText: 'rgb(${1:r}, ${2:g}, ${3:b})', detail: 'RGB color pen' },
  { label: 'cmyk', insertText: 'cmyk(${1:c}, ${2:m}, ${3:y}, ${4:k})', detail: 'CMYK color pen' },
  { label: 'gray', insertText: 'gray(${1:level})', detail: 'Grayscale pen' },
  { label: 'invisible', insertText: 'invisible', detail: 'Invisible pen' },
  { label: 'nullpen', insertText: 'nullpen', detail: 'Null pen (for fill only)' },
  { label: 'squarecap', insertText: 'squarecap', detail: 'Square line cap' },
  { label: 'roundcap', insertText: 'roundcap', detail: 'Round line cap' },
  { label: 'extendcap', insertText: 'extendcap', detail: 'Extended line cap' },
  { label: 'miterjoin', insertText: 'miterjoin', detail: 'Miter line join' },
  { label: 'roundjoin', insertText: 'roundjoin', detail: 'Round line join' },
  { label: 'beveljoin', insertText: 'beveljoin', detail: 'Bevel line join' },
  { label: 'solid', insertText: 'solid', detail: 'Solid line type' },
  { label: 'dashed', insertText: 'dashed', detail: 'Dashed line type' },
  { label: 'dotted', insertText: 'dotted', detail: 'Dotted line type' },
  { label: 'longdashed', insertText: 'longdashed', detail: 'Long dashed line type' },
  { label: 'linewidth', insertText: 'linewidth(${1:width})', detail: 'Set line width' },
  { label: 'linecap', insertText: 'linecap(${1:n})', detail: 'Set line cap style' },
  { label: 'linejoin', insertText: 'linejoin(${1:n})', detail: 'Set line join style' },

  // === Label alignment (constants) ===
  { label: 'N', detail: 'Alignment: north' },
  { label: 'S', detail: 'Alignment: south' },
  { label: 'E', detail: 'Alignment: east' },
  { label: 'W', detail: 'Alignment: west' },
  { label: 'NE', detail: 'Alignment: northeast' },
  { label: 'NW', detail: 'Alignment: northwest' },
  { label: 'SE', detail: 'Alignment: southeast' },
  { label: 'SW', detail: 'Alignment: southwest' },
  { label: 'CCW', detail: 'Counter-clockwise' },
  { label: 'CW', detail: 'Clockwise' },
  { label: 'NoAlign', detail: 'No alignment' },
  { label: 'Align', detail: 'Align to direction' },
  { label: 'LeftSide', detail: 'Left side of path' },
  { label: 'RightSide', detail: 'Right side of path' },
  { label: 'Relative', detail: 'Relative position' },
  { label: 'BeginPoint', detail: 'Begin point of path' },
  { label: 'MidPoint', detail: 'Mid point of path' },
  { label: 'EndPoint', detail: 'End point of path' },
  { label: 'UnFill', detail: 'Unfill area around label' },

  // === Standard library module names ===
  { label: 'graph', detail: 'graph module' },
  { label: 'geometry', detail: 'geometry module' },
  { label: 'three', detail: 'three module' },
  { label: 'math', detail: 'math module' },
  { label: 'plain', detail: 'plain module' },
  { label: 'markers', detail: 'markers module' },
  { label: 'palette', detail: 'palette module' },
  { label: 'contour', detail: 'contour module' },
  { label: 'contour3', detail: 'contour3 module' },
  { label: 'solids', detail: 'solids module' },
  { label: 'simplex', detail: 'simplex module' },
  { label: 'flowchart', detail: 'flowchart module' },
  { label: 'feynman', detail: 'feynman module' },
  { label: 'stats', detail: 'stats module' },
  { label: 'interpolate', detail: 'interpolate module' },
  { label: 'ode', detail: 'ode module' },
  { label: 'slopefield', detail: 'slopefield module' },
  { label: 'tube', detail: 'tube module' },
  { label: 'roundedpath', detail: 'roundedpath module' },
  { label: 'labelpath', detail: 'labelpath module' },
  { label: 'labelpath3', detail: 'labelpath3 module' },
  { label: 'anim', detail: 'animate module' },
  { label: 'embed', detail: 'embed module' },
  { label: 'slide', detail: 'slide module' },
  { label: 'babel', detail: 'babel module' },
  { label: 'external', detail: 'external module' },
  { label: 'pattern', detail: 'patterns module' },
  { label: 'colormap', detail: 'colormap module' },
  { label: 'X11colors', detail: 'X11colors module' },
  { label: 'texcolors', detail: 'texcolors module' },
];

// ========== PAIR MEMBERS (for member completion) ==========
export const pairMembers: { label: string; detail: string }[] = [
  { label: 'x', detail: '(real) x component' },
  { label: 'y', detail: '(real) y component' },
  { label: 'length', detail: '() -> real  Magnitude' },
  { label: 'angle', detail: '() -> real  Angle in radians' },
  { label: 'abs2', detail: '() -> real  Squared magnitude' },
  { label: 'dot', detail: '(pair) -> real  Dot product' },
  { label: 'unit', detail: '() -> pair  Unit direction' },
  { label: 'conj', detail: '() -> pair  Complex conjugate' },
  { label: 'print', detail: '(string sep)  Formatted output' },
];

// ========== TRIPLE MEMBERS ==========
export const tripleMembers: { label: string; detail: string }[] = [
  { label: 'x', detail: '(real) x component' },
  { label: 'y', detail: '(real) y component' },
  { label: 'z', detail: '(real) z component' },
  { label: 'length', detail: '() -> real  Magnitude' },
  { label: 'abs2', detail: '() -> real  Squared magnitude' },
  { label: 'dot', detail: '(triple) -> real  Dot product' },
  { label: 'cross', detail: '(triple) -> triple  Cross product' },
  { label: 'unit', detail: '() -> triple  Unit direction' },
];

// ========== PATH / GUIDE MEMBERS ==========
export const pathMembers: { label: string; detail: string }[] = [
  { label: 'length', detail: '(int) Length of path' },
  { label: 'size', detail: '() -> int  Number of nodes' },
  { label: 'cyclic', detail: '(bool) Whether path is cyclic' },
  { label: 'straight', detail: '(int i) -> bool  Whether segment i is straight' },
  { label: 'point', detail: '(int i) -> pair  Point at node i' },
  { label: 'precontrol', detail: '(int i) -> pair  Pre-control at node i' },
  { label: 'postcontrol', detail: '(int i) -> pair  Post-control at node i' },
  { label: 'dir', detail: '(int i, int sign=0) -> pair  Direction at node i' },
  { label: 'reverse', detail: '() -> path  Reversed path' },
  { label: 'subpath', detail: '(int a, int b) -> path  Subpath' },
  { label: 'intersect', detail: '(path p, real fuzz) -> real[]  Intersection times' },
  { label: 'intersections', detail: '(path p, real fuzz) -> pair[]  Intersection points' },
  { label: 'arclength', detail: '() -> real  Arc length' },
  { label: 'arctime', detail: '(real L) -> real  Time at arc length L' },
  { label: 'min', detail: '() -> pair  Min bounds' },
  { label: 'max', detail: '() -> pair  Max bounds' },
  { label: 'at', detail: 'Item at given element (pair, guide, or path)' },
];

// ========== PEN MEMBERS ==========
export const penMembers: { label: string; detail: string }[] = [
  { label: 'color', detail: '(pair[]) RGB color components' },
  { label: 'width', detail: '(real) Line width' },
  { label: 'cap', detail: '(int) Line cap style' },
  { label: 'join', detail: '(int) Line join style' },
  { label: 'miterlimit', detail: '(real) Miter limit' },
  { label: 'linetype', detail: '(real[]) Dash on/off pattern' },
  { label: 'font', detail: '(string) Font name' },
  { label: 'fontsize', detail: '(real) Font size' },
  { label: 'fillcolor', detail: '(pen) Fill color pen' },
  { label: 'overwrite', detail: '(int) Overwrite mode' },
  { label: 'opacity', detail: '(real) Opacity' },
];

// ========== TRANSFORM MEMBERS ==========
export const transformMembers: { label: string; detail: string }[] = [
  { label: 'x', detail: '(real) xx component' },
  { label: 'y', detail: '(real) yx component' },
  { label: 'xx', detail: '(real) xx scale component' },
  { label: 'xy', detail: '(real) xy skew component' },
  { label: 'yx', detail: '(real) yx skew component' },
  { label: 'yy', detail: '(real) yy scale component' },
  { label: 'inverse', detail: '() -> transform  Inverse transform' },
];

// ========== PICTURE / FRAME MEMBERS ==========
export const pictureMembers: { label: string; detail: string }[] = [
  { label: 'empty', detail: '(bool) Whether picture is empty' },
  { label: 'min', detail: '() -> pair  Minimum bounds' },
  { label: 'max', detail: '() -> pair  Maximum bounds' },
  { label: 'size', detail: '() -> pair  Size of picture' },
  { label: 'calculateTransform', detail: '() -> transform  Calculate transform from user to true size' },
  { label: 'erase', detail: '() -> void  Erase content' },
  { label: 'add', detail: '(frame/path)  Add element' },
  { label: 'copy', detail: '() -> picture  Copy picture' },
  { label: 'uptodate', detail: '(bool) Whether picture is up to date' },
];

// ========== STRING MEMBERS ==========
export const stringMembers: { label: string; detail: string }[] = [
  { label: 'length', detail: '(int) String length' },
  { label: 'substr', detail: '(int i, int n) -> string  Substring' },
  { label: 'find', detail: '(string s, int pos=0) -> int  Find substring' },
  { label: 'rfind', detail: '(string s, int pos=-1) -> int  Reverse find' },
  { label: 'replace', detail: '(string before, string after) -> string  Replace' },
  { label: 'split', detail: '(string delimiter) -> string[]  Split string' },
  { label: 'format', detail: '(...) -> string  Formatted output' },
  { label: 'insert', detail: '(int pos, string s) -> string  Insert at position' },
];

// ========== ARRAY MEMBERS (generic) ==========
export const arrayMembers: { label: string; detail: string }[] = [
  { label: 'length', detail: '(int) Array length' },
  { label: 'cyclic', detail: '(bool) Whether array is cyclic' },
  { label: 'push', detail: '(T... items)  Push items' },
  { label: 'append', detail: '(T[] other)  Append array' },
  { label: 'pop', detail: '() -> T  Pop last element' },
  { label: 'insert', detail: '(T... items)  Insert at beginning' },
  { label: 'delete', detail: '(int i, int j)  Delete range' },
  { label: 'initialized', detail: '(int i) -> bool  Check if initialized' },
  { label: 'keys', detail: '() -> int[]  Array of indices' },
  { label: 'find', detail: '(T key) -> int[]  Find all indices' },
  { label: 'sort', detail: '()  Sort array' },
  { label: 'reverse', detail: '()  Reverse array' },
  { label: 'copy', detail: '() -> T[]  Deep copy' },
  { label: 'map', detail: '(func f) -> T[]  Apply function' },
  { label: 'sum', detail: '() -> T  Sum of elements' },
];

// ========== STANDARD LIBRARY MODULES ==========
export const standardLibraryModules: { name: string; filename: string; description: string; exports?: string[] }[] = [
  { name: 'plain', filename: 'plain.asy', description: 'Core drawing package with automatic sizing', exports: ['size', 'unitsize', 'draw', 'fill', 'filldraw', 'label', 'clip', 'dot', 'pair', 'triple', 'transform', 'pen', 'path', 'guide', 'picture', 'currentpen', 'currentpicture', 'defaultpen'] },
  { name: 'graph', filename: 'graph.asy', description: '2D graph plotting with axis, ticks, legends', exports: ['graph', 'xaxis', 'yaxis', 'axes', 'scale', 'Linear', 'Log', 'Label', 'legend'] },
  { name: 'geometry', filename: 'geometry.asy', description: 'Euclidean geometry constructions', exports: ['point', 'line', 'segment', 'circle', 'triangle', 'arc', 'perpendicular', 'parallel', 'intersection'] },
  { name: 'three', filename: 'three.asy', description: '3D drawing', exports: ['draw', 'triple', 'projection', 'currentprojection', 'light', 'render'] },
  { name: 'math', filename: 'math.asy', description: 'Mathematical constants and functions', },
  { name: 'markers', filename: 'markers.asy', description: 'Path markers (arrowheads, bars)', },
  { name: 'palette', filename: 'palette.asy', description: 'Color palette functions', },
  { name: 'contour', filename: 'contour.asy', description: '2D contour plotting', },
  { name: 'contour3', filename: 'contour3.asy', description: '3D contour plotting', },
  { name: 'solids', filename: 'solids.asy', description: 'Solid geometry primitives', },
  { name: 'simplex', filename: 'simplex.asy', description: 'Linear programming (simplex method)', },
  { name: 'flowchart', filename: 'flowchart.asy', description: 'Flowchart drawing', },
  { name: 'feynman', filename: 'feynman.asy', description: 'Feynman diagrams', },
  { name: 'stats', filename: 'stats.asy', description: 'Statistical functions', },
  { name: 'interpolate', filename: 'interpolate.asy', description: 'Interpolation functions', },
  { name: 'ode', filename: 'ode.asy', description: 'ODE solvers', },
  { name: 'slopefield', filename: 'slopefield.asy', description: 'Slope field plotting', },
  { name: 'tube', filename: 'tube.asy', description: '3D tube rendering', },
  { name: 'roundedpath', filename: 'roundedpath.asy', description: 'Rounded path corners', },
  { name: 'labelpath', filename: 'labelpath.asy', description: 'Labels along paths', },
  { name: 'labelpath3', filename: 'labelpath3.asy', description: '3D labels along paths', },
  { name: 'babel', filename: 'babel.asy', description: 'Non-English language support', },
  { name: 'external', filename: 'external.asy', description: 'External graphics', },
  { name: 'slide', filename: 'slide.asy', description: 'Presentation slides', },
  { name: 'embed', filename: 'embed.asy', description: '3D embedding with player controls', },
  { name: 'anim', filename: 'animate.asy', description: 'PDF animation', },
  { name: 'colormap', filename: 'colormap.asy', description: 'Color map functions', },
  { name: 'X11colors', filename: 'x11colors.asy', description: 'X11 color names', },
  { name: 'texcolors', filename: 'texcolors.asy', description: 'TeX color names', },
  { name: 'grid3', filename: 'grid3.asy', description: '3D grid', },
  { name: 'graph3', filename: 'graph3.asy', description: '3D graph plotting', },
  { name: 'graph_settings', filename: 'graph_settings.asy', description: 'Graph settings', },
  { name: 'graph_splinetype', filename: 'graph_splinetype.asy', description: 'Graph spline types', },
  { name: 'bezulate', filename: 'bezulate.asy', description: 'Bezier surface on polygon', },
  { name: 'binarytree', filename: 'binarytree.asy', description: 'Binary tree drawing', },
  { name: 'drawtree', filename: 'drawtree.asy', description: 'Tree drawing', },
  { name: 'tree', filename: 'tree.asy', description: 'Tree data structure', },
  { name: 'collections', filename: 'collections/', description: 'Collection data structures', },
  { name: 'trembling', filename: 'trembling.asy', description: 'Trembling (hand-drawn look)', },
  { name: 'patterns', filename: 'patterns.asy', description: 'Fill patterns', },
  { name: 'v3d', filename: 'v3d.asy', description: 'V3D format support', },
  { name: 'obj', filename: 'obj.asy', description: 'OBJ format support', },
  { name: 'CAD', filename: 'CAD.asy', description: 'CAD format support', },
  { name: 'syzygy', filename: 'syzygy.asy', description: 'Syzygy module', },
  { name: 'rational', filename: 'rational.asy', description: 'Rational numbers', },
  { name: 'rationalSimplex', filename: 'rationalSimplex.asy', description: 'Rational simplex method', },
  { name: 'simplex2', filename: 'simplex2.asy', description: 'Simplex method variant', },
  { name: 'map', filename: 'map.asy', description: 'Hash map implementation', },
  { name: 'mapArray', filename: 'mapArray.asy', description: 'Map-backed array', },
  { name: 'metapost', filename: 'metapost.asy', description: 'MetaPost compatibility', },
  { name: 'pstoedit', filename: 'pstoedit.asy', description: 'PostScript to editable paths', },
  { name: 'bsp', filename: 'bsp.asy', description: 'Binary space partitioning', },
  { name: 'annotate', filename: 'annotate.asy', description: 'Annotation', },
  { name: 'lmfit', filename: 'lmfit.asy', description: 'Levenberg-Marquardt fitting', },
  { name: 'fontsize', filename: 'fontsize.asy', description: 'Font size presets (size10, size11)', },
  { name: 'smoothcontour3', filename: 'smoothcontour3.asy', description: 'Smoothed 3D contours', },
  { name: 'checkversion', filename: 'checkversion.asy', description: 'Version checking', },
];

// ========== TYPE-TO-MEMBER MAP ==========
export const typeMemberMap: Record<string, { label: string; detail: string }[]> = {
  'pair': pairMembers,
  'triple': tripleMembers,
  'path': pathMembers,
  'path3': pathMembers,
  'guide': pathMembers,
  'pen': penMembers,
  'transform': transformMembers,
  'picture': pictureMembers,
  'frame': pictureMembers,
  'string': stringMembers,
  'file': [],
  'code': [],
};