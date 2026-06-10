import * as path from "path";
import { ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
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
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}