# Asymptote Language Support for VS Code

LSP-based VS Code extension for the [Asymptote](https://asymptote.sourceforge.io/) vector graphics language (`.asy`).

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

> **Tip:** Enable **Semantic Tokens** (see below) to get richer highlighting that distinguishes function definitions from calls, parameters from local variables, and user-defined structs from built-in types.

### Semantic Tokens (Advanced Highlighting)

Beyond TextMate grammar, the extension provides LSP **Semantic Tokens** for finer-grained token classification:

| Token Type | What gets colored differently |
|---|---|
| `function` + `declaration` | Function **definition** sites (not calls) |
| `parameter` | Function parameters |
| `type` + `declaration` | User-defined struct names |
| `variable` + `readonly` | Built-in constants (`pi`, `true`, `IgnoreAspect`, etc.) |
| `function` + `defaultLibrary` | Built-in function calls (`draw`, `fill`, `sin`, etc.) |

To see the effect, add semantic color customizations to your settings:

```json
{
  "editor.semanticTokenColorCustomizations": {
    "enabled": true,
    "rules": {
      "function.declaration": { "fontStyle": "bold" },
      "parameter": { "fontStyle": "italic" },
      "type.declaration": { "fontStyle": "bold" },
      "*.defaultLibrary": { "fontStyle": "underline" },
      "namespace.declaration": { "fontStyle": "bold" }
    }
  }
}
```

> **Note:** The `editor.semanticHighlighting.enabled` setting must be `true` (the default in VS Code) for semantic tokens to work.

#### Semantic Token Customization Guide

Semantic tokens use **scope selectors** (dot-separated names matching `<type>.<modifier>`). Available selectors:

| Selector | Matches |
|---|---|
| `function.declaration` | Function definitions |
| `function.defaultLibrary` | Built-in function names |
| `type.declaration` | User-defined struct names |
| `type.defaultLibrary` | Built-in type names |
| `parameter` | Function parameters |
| `parameter.readonly` | Parameters with defaults |
| `variable.readonly` | Constants |
| `namespace.declaration` | Struct definitions |
| `*.defaultLibrary` | **Any** token that is built-in |
| `*.declaration` | **Any** token at its definition site |
| `*.readonly` | **Any** read-only token |

**VSCode customization properties** you can set on each rule:

| Property | Values | Effect |
|---|---|---|
| `"foreground"` | `"#RRGGBB"` | Text color |
| `"fontStyle"` | `"bold"`, `"italic"`, `"underline"`, `"strikethrough"`, `""` (clear) | Font style (can combine: `"bold italic"`) |

**Example: Bold+colored function definitions, italic parameters:**

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "function.declaration": {
        "foreground": "#569CD6",
        "fontStyle": "bold"
      },
      "parameter": {
        "fontStyle": "italic"
      },
      "type.declaration": {
        "foreground": "#4EC9B0",
        "fontStyle": "bold"
      },
      "*.defaultLibrary": {
        "fontStyle": "underline"
      }
    }
  }
}
```

**Example: Subtle — only italic for parameters, everything else default:**

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "parameter": { "fontStyle": "italic" }
    }
  }
}
```

### Code Completion

- **Keywords**: control-flow snippets (`if`, `for`, `while`, `return`, `struct`)
- **Built-in functions**: `draw`, `fill`, `label`, `sin`, `cos`, `Arrow`, `PenMargin`, `size`, `graph`, `axes`, `light`, `surface`, `grid3` and many more
- **Built-in types**: `int`, `real`, `pair`, `path`, `triple`, `pen`, `transform`, `picture`, `frame`
- **Constants**: `pi`, `true`, `false`, `null`, `cycle`, `Zero`, `IgnoreAspect`, `LeftSide`, `RightSide`
- **Module names**: Auto-scanned from search paths (see below)
- **Member access**: Type-aware dot completion (`pair.` → `x`, `y`; `path.` → `length`, `arclength`)

### Go-to-Definition

- **Import/access/include statements**: jump to the referenced `.asy` file
- **In-file symbols**: locate variable declarations and struct definitions in the current document
- **Cross-module symbols**: jump to definitions in imported modules (resolved via search paths)
- **Overloaded functions**: when a function has multiple definitions, all locations are listed
- **Dot-access**: `object.method()` resolves `object` as a module and finds `method`

### Hover

- Built-in types, constants, and functions show their signatures and documentation on hover
- Cross-module hover: hovering a symbol imported from another module shows its source

### Signature Help

- Function parameter hints triggered on `(` and `,`
- Shows all overloaded signatures

### Code Formatting

- Brace style: `kr` (same line) or `allman` (new line)
- Configurable indent size (spaces or tabs)
- Path expression spacing: `..`, `--`, `---`, `::` operators can be compact or spaced

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `asymptote.trace.server` | `enum` | `"off"` | LSP trace level for debugging: `off`, `messages`, `verbose` |
| `asymptote.asyPath` | `string` | `"asy"` | Path to the Asymptote executable |
| `asymptote.searchPaths` | `string[]` | `[]` | Additional directories to search for `import`/`include`/`access` resolution |
| `asymptote.formatting.braceStyle` | `enum` | `"kr"` | Brace style: `"kr"` (same line) or `"allman"` (new line) |
| `asymptote.formatting.indentSize` | `number` | `2` | Spaces per indentation level (1–8) |
| `asymptote.formatting.insertSpaces` | `boolean` | `true` | Spaces (`true`) or tabs (`false`) |
| `asymptote.formatting.pathExpressionSpacing` | `enum` | `"spaced"` | `"compact"` or `"spaced"` for `..`, `--`, `---` operators |

### Search Paths

The `asymptote.searchPaths` setting is critical for module resolution. The extension searches for `.asy` files in the following order:

1. **Workspace folders** — the root directories of your VS Code workspace
2. **User-configured paths** — from `asymptote.searchPaths` (supports `~` for home directory and `${VAR}` environment variable expansion)
3. **`ASYMPTOTE_HOME` or `~/.asy`** — user's Asymptote configuration directory
4. **Current file's directory** — where the `.asy` file being edited is located

When searching for a module (e.g., `import graph;`), the extension looks for `<module>.asy` in each directory. Dot-notation (e.g., `import dir.mod;`) maps to `dir/mod.asy`.

Additionally, all files matching `plain_*.asy` are automatically indexed as implicit imports (matching Asymptote's `private import plain;` behavior).

**Example: pointing to a local Asymptote installation:**

```json
{
  "asymptote.searchPaths": [
    "/usr/local/texlive/2022/texmf-dist/asymptote/base"
  ]
}
```

## Semantic Token Configuration

### Full featured setup

```json
{
  "editor.semanticHighlighting.enabled": true,
  "editor.semanticTokenColorCustomizations": {
    "enabled": true,
    "rules": {
      "function.declaration": { "foreground": "#569CD6", "fontStyle": "bold" },
      "function.defaultLibrary": { "foreground": "#DCDCAA" },
      "type.declaration": { "foreground": "#4EC9B0", "fontStyle": "bold" },
      "type.defaultLibrary": { "foreground": "#4EC9B0" },
      "parameter": { "fontStyle": "italic" },
      "variable.readonly": { "foreground": "#CE9178" },
      "namespace.declaration": { "fontStyle": "bold" }
    }
  }
}
```

### Minimal setup (bold definitions + italic parameters)

```json
{
  "editor.semanticTokenColorCustomizations": {
    "rules": {
      "*.declaration": { "fontStyle": "bold" },
      "parameter": { "fontStyle": "italic" }
    }
  }
}
```

### Available Semantic Token Selectors

| Selector | What it highlights |
|---|---|
| `function.declaration` | Function definitions (e.g., `void draw(...)`) |
| `function.defaultLibrary` | Built-in function names (`draw`, `fill`, `sin`, `Arrow`, etc.) |
| `type.declaration` | User-defined struct names used as types |
| `type.defaultLibrary` | Built-in type names (`int`, `real`, `pair`, `path`, etc.) |
| `parameter` | Function parameters |
| `variable.readonly` | Constants (`pi`, `true`, `false`, `IgnoreAspect`, `N`, `S`, etc.) |
| `variable` | Regular variables |
| `namespace.declaration` | Struct definitions (`struct Point`) |
| `*.declaration` | Wildcard: any token at its definition site |
| `*.readonly` | Wildcard: any read-only token |
| `*.defaultLibrary` | Wildcard: any built-in / standard library token |

Applicable style properties:

| Property | Values |
|---|---|
| `"foreground"` | Hex color: `"#RRGGBB"` |
| `"fontStyle"` | `"bold"`, `"italic"`, `"underline"`, `"strikethrough"`, or combined: `"bold italic"` |

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Visual Studio Code](https://code.visualstudio.com/) >= 1.85

### Project Structure

```
AsyLsp/
├── client/          # VS Code extension (activates the language server)
│   └── src/extension.ts
├── server/          # Language server (LSP implementation)
│   └── src/server.ts
├── syntaxes/        # TextMate grammar for syntax highlighting
├── snippets/        # Code snippets
└── package.json     # Extension manifest (root)
```

### Build

```bash
cd client && npm install && npm run compile
cd ../server && npm install && npm run compile
```

Or in VS Code: `Ctrl+Shift+B` → **compile all**.

### Debug

Press **F5** → launches the Extension Development Host with the extension loaded.

| Config | Purpose |
|---|---|
| **Launch Extension** | Opens a new VS Code window with this extension |
| **Attach to Server** | Attaches Node.js debugger to port 6009 |

Set `"asymptote.trace.server": "verbose"` to log all LSP messages to the Output panel.

## License

MIT
