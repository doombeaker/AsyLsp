# Asymptote Language Support for VS Code

LSP-based VS Code extension for the [Asymptote](https://asymptote.sourceforge.io/) vector graphics language (`.asy`). Provides syntax highlighting, code completion, signature help, go-to-definition, and formatting.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Visual Studio Code](https://code.visualstudio.com/) >= 1.85
- `npm` (bundled with Node.js)

## Project Structure

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

Standard VS Code LSP extension: client communicates with server via [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

## Getting Started

### 1. Install Dependencies

```bash
cd client && npm install
cd ../server && npm install
```

### 2. Build

**In VS Code:** `Ctrl+Shift+B` → **compile all** (includes both client and server).

**Or manually:**

```bash
cd client && npm run compile
cd ../server && npm run compile
```

This compiles TypeScript (`src/`) → JavaScript (`out/`).

## Debugging

Open this project in VS Code, then press **F5**. This uses the **Client + Server** compound launch config:

| Config | What it does |
|---|---|
| **Launch Extension** | Opens a new VS Code window (Extension Development Host) with this extension loaded |
| **Attach to Server** | Attaches Node.js debugger to port 6009 for server-side breakpoints |

- Set breakpoints in `client/src/extension.ts` or `server/src/server.ts`
- In the Extension Development Host, open any `.asy` file to trigger the LSP
- **Client debugger** hits breakpoints in the extension activation code
- **Server debugger** (port 6009) hits breakpoints in language server logic

### Trace LSP Communication

Set `"asymptote.trace.server": "verbose"` in `.vscode/settings.json` to log all LSP messages between client and server. Output appears in the **Asymptote** channel in the Output panel.

### Command-Line Debugging

You can also debug the server standalone:

```bash
cd server && node --inspect=6009 out/server.js --stdio
```

Then attach from VS Code using the **Attach to Server** config.

## Configuration

All settings are under the `asymptote.*` namespace:

| Setting | Default | Description |
|---|---|---|
| `asymptote.trace.server` | `"off"` | LSP trace level: `off`, `messages`, `verbose` |
| `asymptote.asyPath` | `"asy"` | Path to the Asymptote executable |
| `asymptote.formatting.braceStyle` | `"kr"` | Brace style: `kr` or `allman` |
| `asymptote.formatting.indentSize` | `2` | Spaces per indentation level |
| `asymptote.formatting.insertSpaces` | `true` | Use spaces instead of tabs |
| `asymptote.formatting.pathExpressionSpacing` | `"spaced"` | Path operator spacing: `compact` or `spaced` |

## License

MIT