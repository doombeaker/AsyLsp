import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as cp from "child_process";
import {
  ExtensionContext,
  workspace,
  window,
  commands,
  Uri,
  ViewColumn,
  languages,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;
const outputChannel = window.createOutputChannel("Asymptote");
const diagnosticCollection = languages.createDiagnosticCollection("asymptote");

export function activate(context: ExtensionContext) {
  // === LSP Server ===
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "asymptote" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.asy"),
    },
    initializationOptions: {
      asyPath: workspace.getConfiguration("asymptote").get("asyPath", "asy"),
      searchPaths: workspace.getConfiguration("asymptote").get<string[]>("searchPaths", []),
      formatting: {
        braceStyle: workspace
          .getConfiguration("asymptote.formatting")
          .get("braceStyle", "kr"),
        indentSize: workspace
          .getConfiguration("asymptote.formatting")
          .get("indentSize", 2),
        insertSpaces: workspace
          .getConfiguration("asymptote.formatting")
          .get("insertSpaces", true),
        pathExpressionSpacing: workspace
          .getConfiguration("asymptote.formatting")
          .get("pathExpressionSpacing", "spaced"),
      },
    },
  };

  client = new LanguageClient(
    "asymptoteLanguageServer",
    "Asymptote Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  // === Compile Command ===
  context.subscriptions.push(
    commands.registerCommand("asymptote.compile", () => compileActiveDocument())
  );

  // === Preview Command ===
  context.subscriptions.push(
    commands.registerCommand("asymptote.preview", () => previewActiveDocument())
  );

  // === Auto-compile on Save ===
  context.subscriptions.push(
    workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId !== "asymptote") return;
      if (!workspace.getConfiguration("asymptote.compile").get("autoCompile", false)) return;
      compileDocument(doc);
    })
  );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}

// ========== COMPILE ==========

function getAsyPath(): string {
  return workspace.getConfiguration("asymptote").get("asyPath", "asy");
}

function getOutputFormat(): string {
  return workspace.getConfiguration("asymptote.compile").get("outputFormat", "svg");
}

function getOutputDir(sourceDir: string): string {
  const configured = workspace.getConfiguration("asymptote.compile").get<string>("outputDir", "") ?? "";
  if (configured) return configured.replace(/^~/, os.homedir());
  return sourceDir;
}

function getExtraArgs(): string[] {
  return workspace.getConfiguration("asymptote.compile").get<string[]>("extraArgs", []) ?? [];
}

function compileActiveDocument(): void {
  const editor = window.activeTextEditor;
  if (!editor) {
    window.showWarningMessage("No active Asymptote document to compile.");
    return;
  }
  if (editor.document.languageId !== "asymptote") {
    window.showWarningMessage("Active document is not an Asymptote file.");
    return;
  }
  compileDocument(editor.document);
}

function compileDocument(document: { uri: Uri; getText(): string; fileName: string }): void {
  const sourcePath = document.uri.fsPath;
  const sourceDir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, ".asy");
  const format = getOutputFormat();
  const outputDir = getOutputDir(sourceDir);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outName = path.join(outputDir, baseName);
  const asyPath = getAsyPath();

  if (!asyPath || asyPath.trim() === "") {
    window.showErrorMessage(
      "Asymptote executable path is not configured. Please set 'asymptote.asyPath' in settings."
    );
    return;
  }

  if (asyPath.includes("/") || asyPath.includes("\\")) {
    if (!fs.existsSync(asyPath)) {
      window.showErrorMessage(
        `Asymptote executable not found at '${asyPath}'. Please check 'asymptote.asyPath' in settings.`
      );
      return;
    }
  }

  const extraArgs = getExtraArgs();

  const args = ["-f", format, "-o", outName];
  if (format === "png") {
    const render = workspace.getConfiguration("asymptote.compile").get<number>("render", 4) ?? 4;
    args.push("-render", String(render));
  }
  args.push(...extraArgs, sourcePath);

  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine(`> ${asyPath} ${args.join(" ")}`);

  diagnosticCollection.clear();

  const proc = cp.spawn(asyPath, args);

  let stderr = "";
  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  proc.on("close", (code: number | null) => {
    if (stderr) {
      outputChannel.appendLine(stderr);

      const diagnostics = parseAsyErrors(stderr, document as { uri: Uri });
      if (diagnostics.length > 0) {
        diagnosticCollection.set(document.uri, diagnostics);
      }
    }

    if (code === 0) {
      outputChannel.appendLine(`[OK] Compiled to ${outName}.${format}`);
      if (workspace.getConfiguration("asymptote.compile").get("openPreview", true)) {
        previewDocument(outName, format);
      }
    } else {
      outputChannel.appendLine(`[FAIL] asy exited with code ${code}`);
    }
  });

  proc.on("error", (err: Error) => {
    outputChannel.appendLine(`[ERROR] Failed to launch asy: ${err.message}`);
    window.showErrorMessage(`Failed to launch asy: ${err.message}. Check asymptote.asyPath setting.`);
  });
}

function parseAsyErrors(
  stderr: string,
  document: { uri: Uri }
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = stderr.split("\n");

  for (const line of lines) {
    const match = line.match(/^(.*?):(\d+):(\d+):\s*(.*)/);
    if (!match) continue;

    const file = match[1];
    const lineNum = parseInt(match[2], 10) - 1;
    const colNum = parseInt(match[3], 10) - 1;
    const message = match[4];

    if (lineNum < 0) continue;

    const range = new Range(
      new Position(lineNum, colNum),
      new Position(lineNum, colNum + 10)
    );

    const severity = /error/i.test(message)
      ? DiagnosticSeverity.Error
      : DiagnosticSeverity.Warning;

    diagnostics.push(new Diagnostic(range, message, severity));
  }

  return diagnostics;
}

// ========== PREVIEW ==========

function previewActiveDocument(): void {
  const editor = window.activeTextEditor;
  if (!editor) {
    window.showWarningMessage("No active Asymptote document.");
    return;
  }
  if (editor.document.languageId !== "asymptote") {
    window.showWarningMessage("Active document is not an Asymptote file.");
    return;
  }

  const sourcePath = editor.document.uri.fsPath;
  const sourceDir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, ".asy");
  const outputDir = getOutputDir(sourceDir);
  const format = getOutputFormat();
  const outName = path.join(outputDir, baseName);

  const outFile = `${outName}.${format}`;
  if (!fs.existsSync(outFile)) {
    window.showInformationMessage("No compiled output found. Compiling first...");
    compileDocument(editor.document);
    return;
  }

  previewDocument(outName, format);
}

function previewDocument(outName: string, format: string): void {
  const outFile = `${outName}.${format}`;

  if (format === "svg") {
    previewSvg(outFile);
  } else if (format === "pdf") {
    previewPdf(outFile);
  } else if (format === "png") {
    previewPng(outFile);
  } else {
    commands.executeCommand("vscode.open", Uri.file(outFile));
  }
}

function previewSvg(svgPath: string): void {
  if (!fs.existsSync(svgPath)) {
    window.showErrorMessage(`SVG file not found: ${svgPath}`);
    return;
  }

  const svgContent = fs.readFileSync(svgPath, "utf-8");
  const panel = window.createWebviewPanel(
    "asymptotePreview",
    `Preview: ${path.basename(svgPath)}`,
    ViewColumn.Two,
    { enableScripts: false }
  );

  panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 20px; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
}

function previewPdf(pdfPath: string): void {
  if (!fs.existsSync(pdfPath)) {
    window.showErrorMessage(`PDF file not found: ${pdfPath}`);
    return;
  }

  const pdfUri = Uri.file(pdfPath);
  commands.executeCommand("vscode.open", pdfUri, ViewColumn.Two);
}

function previewPng(pngPath: string): void {
  if (!fs.existsSync(pngPath)) {
    window.showErrorMessage(`PNG file not found: ${pngPath}`);
    return;
  }

  const pngUri = Uri.file(pngPath);
  const panel = window.createWebviewPanel(
    "asymptotePreview",
    `Preview: ${path.basename(pngPath)}`,
    ViewColumn.Two,
    { enableScripts: false }
  );

  panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 20px; background: #fff; display: flex; justify-content: center; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <img src="data:image/png;base64,${fs.readFileSync(pngPath).toString("base64")}" />
</body>
</html>`;
}
