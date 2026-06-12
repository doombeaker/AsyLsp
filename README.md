# Asymptote Language Support for VS Code

LSP-based VS Code extension for the [Asymptote](https://asymptote.sourceforge.io/) vector graphics language (`.asy`).

> **Repository:** [github.com/doombeaker/AsyLsp](https://github.com/doombeaker/AsyLsp)  
> Found a bug? Have a feature request? [Open an issue](https://github.com/doombeaker/AsyLsp/issues) — feedback is welcome!

## Features

### Syntax Highlighting

Comprehensive TextMate grammar for Asymptote, covering:

| Category | Examples |
|---|---|
| Keywords | `if`, `else`, `for`, `while`, `return`, `struct`, `import`, `include`, `access`, `from`, `unravel`, `new`, `operator` |
| Built-in Types | `int`, `real`, `bool`, `string`, `void`, `pair`, `triple`, `path`, `path3`, `pen`, `transform`, `guide`, `picture`, `frame`, `file`, `code` |
| 3D Types | `material`, `light`, `projection`, `Camera`, `Sphere`, `Cylinder`, `BBox3`, `grid3`, `graph3`, `Marker`, `Ticks` |
| Built-in Functions | `draw`, `fill`, `filldraw`, `dot`, `label`, `clip`, `size`, `unitsize`, `add`, `erase`, `sin`, `cos`, `atan2`, `exp`, `log`, `sqrt`, `floor`, `ceil` |
| 3D Functions | `graph3`, `surface`, `extrude`, `tube`, `light`, `viewport`, `orthographic`, `perspective`, `embed`, `project` |
| Drawing Functions | `graph`, `axes`, `xaxis`, `yaxis`, `zaxis`, `grid`, `legend`, `palette`, `contour`, `Arrow`, `PenMargin`, `markers`, `minipage`, `fontsize`, `defaultpen` |
| Spline / Shading | `spline`, `Hermite`, `NURBS`, `bezier`, `tension`, `curl`, `specular`, `diffuse`, `phong`, `lambert`, `gouraud` |
| Constants | `pi`, `inf`, `true`, `false`, `null`, `zero`, `IgnoreAspect`, `Fill`, `NoFill`, `BeginPenMargin`, `EndPenMargin`, `LeftSide`, `RightSide`, `Align` |
| Direction Constants | `N`, `S`, `E`, `W`, `NE`, `NW`, `SE`, `SW`, `NNE`, `NNW`, `SSE`, `SSW`, `ENE`, `WNW`, `ESE`, `WSW` |
| Comments & Strings | `//`, `/* */` comments; `'...'` and `"..."` strings with escape sequences |

### Semantic Tokens (Advanced Highlighting)

Beyond TextMate grammar, the extension provides LSP **Semantic Tokens** for finer-grained classification — **zero config, works out of the box**. The default color scheme:

| Category | Color | Style | What it means |
|---|---|---|---|
| Function definitions | `#569CD6` (blue) | **bold** | Spot where a function is defined |
| System functions (C-level + std-lib) | `#DCDCAA` (warm yellow) | — | "Provided by the language" |
| Types (built-in + user structs) | `#4EC9B0` (teal) | — | Standard type color |
| Type/struct definitions | `#4EC9B0` (teal) | **bold** | Struct declarations stand out |
| Parameters | `#569CD6` (blue) | *italic* | Distinguish from local variables |
| Constants | `#CE9178` (copper) | — | Immutable / fixed value |

> **Note:** `editor.semanticHighlighting.enabled` must be `true` (default in VS Code).

#### Customizing the Color Scheme

Override the built-in scheme in your `settings.json`:

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "function.declaration": { "fontStyle": "bold" },
      "parameter": { "fontStyle": "italic" },
      "*.defaultLibrary": { "fontStyle": "underline" }
    }
  }
}
```

Available selectors:

| Selector | Matches |
|---|---|
| `function.declaration` | Function definitions |
| `function.defaultLibrary` | Built-in & std-lib function names |
| `type.declaration` | User-defined struct names |
| `type.defaultLibrary` | Built-in type names |
| `type` | All type references (with or without modifiers) |
| `parameter` | Function parameters |
| `variable.readonly.defaultLibrary` | Built-in constants |
| `*.declaration` | Any definition site (wildcard) |
| `*.defaultLibrary` | Any system-provided token (wildcard) |
| `*.readonly` | Any readonly token (wildcard) |

Style properties: `"foreground"` (hex color), `"fontStyle"` (`"bold"`, `"italic"`, `"underline"`, `"strikethrough"`, combined: `"bold italic"`).

### Code Completion

- **Keywords**: control-flow snippets (`if`, `for`, `while`, `return`, `struct`)
- **Built-in functions**: `draw`, `fill`, `label`, `sin`, `cos`, `Arrow`, `PenMargin`, `size`, `graph`, `axes`, `light`, `surface`, `grid3` and many more
- **Built-in types**: `int`, `real`, `pair`, `path`, `triple`, `pen`, `transform`, `picture`, `frame`
- **Constants**: `pi`, `true`, `false`, `null`, `cycle`, `IgnoreAspect`, `LeftSide`, `RightSide`
- **Module names**: Auto-scanned from search paths (see below)
- **Imported module symbols**: functions, structs, and variables from all imported modules are auto-completed (e.g., `import drawtree;` → type `Tr` → `TreeNode` appears)
- **Member access**: Type-aware dot completion (`pair.` → `x`, `y`; `path.` → `length`, `arclength`)

### Real-time Diagnostics

As-you-type error checking with no save required:

- **Bracket matching**: Red squiggly on unmatched `{ }`, `( )`, `[ ]` — strings and comments are skipped
- **Import resolution**: Yellow squiggly when `import` / `access` / `from` references a module not found in search paths
- **Missing semicolons**: Blue info hint on lines that appear to be statements without a terminating `;` (optional in Asymptote; function definitions and brace-only lines are not flagged)

### Go-to-Definition

- **Import/access/include statements**: jump to the referenced `.asy` file
- **In-file symbols**: locate variable declarations and struct definitions in the current document
- **Cross-module symbols**: jump to definitions in imported modules (resolved via search paths)
- **Overloaded functions**: when a function has multiple definitions, all locations are listed
- **Dot-access**: `object.method()` resolves `object` as a module and finds `method`

### Find All References

Right-click a symbol → **Find All References** (or `Shift+F12`) to locate every usage across the current file and imported modules.

### Rename Symbol (F2)

Rename a function, variable, struct, or parameter across all files where it is defined or referenced. Uses the same cross-module search as Find All References.

### Document Outline

The Outline sidebar shows a structured view of all struct definitions and function definitions in the current file for quick navigation.

### Color Preview

Named pen colors (`red`, `blue`, `lightgray`, `magenta`, `pink`, `olive`, `navy`, `teal`, `orange`, `purple`, `brown`, `maroon`, `lime`, `aqua`, `silver`) and `rgb(...)` expressions display inline color swatches in the editor.

### Hover

- Built-in types, constants, and functions show their signatures and documentation
- Cross-module hover: hovering a symbol imported from another module shows its source

### Signature Help

- Function parameter hints triggered on `(` and `,`
- Shows all overloaded signatures

### Code Formatting

- Brace style: `kr` (same line) or `allman` (new line)
- Configurable indent size (spaces or tabs)
- Path expression spacing: `..`, `--`, `---`, `::` operators can be compact or spaced

### Compile & Preview

- **Compile**: `Asymptote: Compile` command — runs `asy` on the current file
- **Preview**: `Asymptote: Preview` command — opens compiled output in a side-by-side panel
- **SVG**: inline Webview rendering, vector quality, no external tools needed
- **PDF**: opens in VSCode's built-in PDF viewer in a split column
- **PNG**: inline Webview rendering, resolution controlled by `render` setting
- **Error diagnostics**: compiler errors parsed and shown in the Problems panel
- **Auto-compile on save**: optional via `asymptote.compile.autoCompile`

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `asymptote.trace.server` | `enum` | `"off"` | LSP trace level: `off`, `messages`, `verbose` |
| `asymptote.asyPath` | `string` | `"asy"` | Path to the Asymptote executable |
| `asymptote.searchPaths` | `string[]` | `[]` | Additional directories searched for `import`/`include`/`access` resolution |
| `asymptote.compile.outputFormat` | `enum` | `"svg"` | Output format: `svg`, `pdf`, `png` |
| `asymptote.compile.render` | `number` | `4` | PNG raster resolution in px/bp (1–16). SVG/PDF ignore this. Recommended: 4–8 |
| `asymptote.compile.outputDir` | `string` | `""` | Output directory. Empty = same as source file |
| `asymptote.compile.autoCompile` | `boolean` | `false` | Auto-compile on save |
| `asymptote.compile.openPreview` | `boolean` | `true` | Open preview after successful compilation |
| `asymptote.compile.extraArgs` | `string[]` | `[]` | Extra command-line arguments passed to `asy` |
| `asymptote.formatting.braceStyle` | `enum` | `"kr"` | Brace style: `"kr"` (same line) or `"allman"` (new line) |
| `asymptote.formatting.indentSize` | `number` | `2` | Spaces per indent (1–8) |
| `asymptote.formatting.insertSpaces` | `boolean` | `true` | Spaces (`true`) or tabs (`false`) |
| `asymptote.formatting.pathExpressionSpacing` | `enum` | `"spaced"` | `"compact"` or `"spaced"` for `..`, `--`, `---` operators |

### Search Paths

The extension resolves `import`/`include`/`access` paths in this order:

1. **Workspace folders** — your VS Code workspace roots
2. **User-configured paths** — from `asymptote.searchPaths` (supports `~` and `${VAR}` expansion)
3. **Auto-discovered system library** — detected via `kpsewhich` or TeX Live directory scan (e.g., `/usr/local/texlive/2024/texmf-dist/asymptote`), plus common Homebrew/Linux paths. No manual configuration needed for standard installations.
4. **`ASYMPTOTE_HOME` or `~/.asy`** — Asymptote user config directory
5. **Current file's directory**

All `plain_*.asy` files found in search paths are automatically indexed as implicit imports (matching `private import plain;` behavior).

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Visual Studio Code](https://code.visualstudio.com/) >= 1.85

### Build & Run

```bash
cd client && npm install && npm run compile
cd ../server && npm install && npm run compile
```

Press **F5** in VS Code to launch the extension in a development host.

### Debug

| Config | Purpose |
|---|---|
| **Launch Extension** | Opens a new VS Code window with this extension loaded |
| **Attach to Server** | Attaches Node.js debugger to port 6009 |

Set `"asymptote.trace.server": "verbose"` to log LSP messages to the Output panel.

## License

MIT
