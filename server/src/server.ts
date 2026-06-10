import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  MarkupKind,
  Definition,
  Location,
  Range,
  Position,
  TextEdit,
  FormattingOptions,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  keywords,
  controlFlowKeywords,
  builtinTypes,
  constants,
  builtinFunctions,
  pairMembers,
  tripleMembers,
  pathMembers,
  penMembers,
  transformMembers,
  pictureMembers,
  stringMembers,
  arrayMembers,
  typeMemberMap,
  standardLibraryModules,
} from "./symbols";

// ========== SERVER SETUP ==========

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// Configuration
interface AsymptoteSettings {
  asyPath: string;
  formatting: {
    braceStyle: "kr" | "allman";
    indentSize: number;
    insertSpaces: boolean;
    pathExpressionSpacing: "compact" | "spaced";
  };
}

const defaultSettings: AsymptoteSettings = {
  asyPath: "asy",
  formatting: {
    braceStyle: "kr",
    indentSize: 2,
    insertSpaces: true,
    pathExpressionSpacing: "spaced",
  },
};

let globalSettings: AsymptoteSettings = defaultSettings;
const documentSettings: Map<string, Thenable<AsymptoteSettings>> = new Map();

function getDocumentSettings(resource: string): Thenable<AsymptoteSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "asymptote",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// ========== INITIALIZATION ==========

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [".", "(", " ", "/", "\\"],
      },
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
        retriggerCharacters: [","],
      },
      definitionProvider: true,
      documentFormattingProvider: true,
      hoverProvider: true,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change received.");
    });
  }
});

// ========== CONFIGURATION CHANGE ==========

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = <AsymptoteSettings>(
      (change.settings.asymptote || defaultSettings)
    );
  }
});

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// ========== HOVER PROVIDER ==========

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const wordRange = getWordRangeAtPosition(
    document,
    params.position
  );
  if (!wordRange) return null;

  const word = document.getText(wordRange);

  // Check built-in types
  const typeEntry = builtinTypes.find((t) => t.label === word);
  if (typeEntry) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${word}** - ${typeEntry.detail}`,
      },
    };
  }

  // Check constants
  const constEntry = constants.find((c) => c.label === word);
  if (constEntry) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${word}** - ${constEntry.detail}`,
      },
    };
  }

  // Check keywords
  if (keywords.includes(word)) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${word}** - Asymptote keyword`,
      },
    };
  }

  // Check built-in functions
  const funcEntry = builtinFunctions.find((f) => f.label === word);
  if (funcEntry) {
    let md = `**${word}** - ${funcEntry.detail}`;
    if (funcEntry.signatures) {
      md += "\n\n### Signatures\n";
      for (const sig of funcEntry.signatures) {
        md += `\n\`\`\`asy\n${sig.label}\n\`\`\``;
      }
    }
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: md,
      },
    };
  }

  return null;
});

// ========== COMPLETION PROVIDER ==========

connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const lineText = getLineText(document, params.position.line);
  const charBeforeCursor = offset > 0 ? text[offset - 1] : "";

  // ===== IMPORT COMPLETION (standard library modules) =====
  if (isAfterImport(lineText)) {
    return getModuleCompletions();
  }

  // ===== FILE PATH COMPLETION (include/access) =====
  if (isAfterInclude(lineText)) {
    return []; // File path completion - delegate to VS Code's fs completion
  }

  // ===== DOT COMPLETION (member access) =====
  if (charBeforeCursor === ".") {
    return getMemberCompletions(text, offset);
  }

  // ===== PAREN COMPLETION =====
  if (charBeforeCursor === "(") {
    return []; // Let signatureHelp handle at "("
  }

  // ===== SPACE COMPLETION =====
  if (shouldProvideCompletions(lineText, charBeforeCursor)) {
    return getAllCompletions();
  }

  return [];
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // Add documentation to function completions
  return item;
});

// ========== SIGNATURE HELP PROVIDER ==========

connection.onSignatureHelp((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const text = document.getText();
  const offset = document.offsetAt(params.position);

  // Find the function name by scanning backwards from cursor
  const funcCall = getFunctionCallAtCursor(text, offset);
  if (!funcCall) return null;

  const funcSig = builtinFunctions.find((f) => f.label === funcCall.name);
  if (!funcSig || !funcSig.signatures) return null;

  const signatures: SignatureInformation[] = funcSig.signatures.map((sig) => {
    const params: ParameterInformation[] = sig.parameters.map((p) => ({
      label: p.label,
      documentation: p.documentation,
    }));
    return {
      label: sig.label,
      documentation: funcSig.detail,
      parameters: params,
    };
  });

  const help: SignatureHelp = {
    signatures,
    activeSignature: 0,
    activeParameter: funcCall.currentArg,
  };

  return help;
});

// ========== DEFINITION PROVIDER ==========

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const lineText = getLineText(document, params.position.line);

  // Check for import/include/access statements
  const importPath = getImportPath(lineText);
  if (importPath) {
    return resolveImportPath(importPath, document);
  }

  // Check for symbol definition
  return findSymbolDefinition(document, params.position);
});

// ========== FORMATTING PROVIDER ==========

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  return formatDocument(document, params.options);
});

// Make the text document manager listen on the connection
// for open, change, and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

// ========== HELPER FUNCTIONS ==========

function getLineText(document: TextDocument, line: number): string {
  const lineRange = {
    start: { line, character: 0 },
    end: { line, character: document.getText().split("\n")[line]?.length || 0 },
  };
  const rangeStr = `${lineRange.start.line}:${lineRange.start.character}-${lineRange.end.line}:${lineRange.end.character}`;
  return document.getText({
    start: Position.create(line, 0),
    end: Position.create(line, lineRange.end.character),
  });
}

function getWordRangeAtPosition(
  document: TextDocument,
  position: Position
): Range | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const identifierRegex = /[A-Za-z_][A-Za-z0-9_]*/g;

  let match: RegExpExecArray | null;
  while ((match = identifierRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return {
        start: document.positionAt(start),
        end: document.positionAt(end),
      };
    }
  }
  return null;
}

// ========== COMPLETION HELPERS ==========

function isAfterImport(lineText: string): boolean {
  const trimmed = lineText.trimStart();
  return (
    /^(import|from|access)\s+$/.test(trimmed) ||
    /^(import|from|access)\s+[A-Za-z_][A-Za-z0-9_]*\s+$/.test(trimmed)
  );
}

function isAfterInclude(lineText: string): boolean {
  const trimmed = lineText.trimStart();
  return /^include\s+"?$/.test(trimmed);
}

function shouldProvideCompletions(
  lineText: string,
  charBefore: string
): boolean {
  const trimmed = lineText.trimStart();
  // Don't provide completions inside comments
  if (/^\/\//.test(trimmed)) return false;

  // Provide after newline or space at start of statement
  if (!charBefore || charBefore === " ") {
    // Skip if we're after a dot operator
    const lastDot = lineText.lastIndexOf(".");
    const lastSpace = lineText.lastIndexOf(" ");
    if (lastDot > lastSpace) return false;
    return true;
  }

  // After a delimiter
  if ([ ",", ";", "{", "}", "[", "]" ].includes(charBefore)) {
    return true;
  }

  return false;
}

function getAllCompletions(): CompletionItem[] {
  const items: CompletionItem[] = [];

  // Keywords (as snippets)
  for (const kw of controlFlowKeywords) {
    items.push({
      label: kw.label,
      kind: CompletionItemKind.Snippet,
      insertText: kw.insertText,
      insertTextFormat: InsertTextFormat.Snippet,
      detail: kw.detail,
    });
  }

  // Other keywords
  for (const kw of keywords) {
    if (!controlFlowKeywords.find((k) => k.label === kw)) {
      items.push({
        label: kw,
        kind: CompletionItemKind.Keyword,
        detail: "Asymptote keyword",
      });
    }
  }

  // Built-in types
  for (const t of builtinTypes) {
    items.push({
      label: t.label,
      kind: CompletionItemKind.Class,
      detail: t.detail,
    });
  }

  // Constants
  for (const c of constants) {
    items.push({
      label: c.label,
      kind: CompletionItemKind.Constant,
      detail: c.detail,
    });
  }

  // Built-in functions
  for (const f of builtinFunctions) {
    items.push({
      label: f.label,
      kind: CompletionItemKind.Function,
      detail: f.detail,
      insertText: f.insertText,
      insertTextFormat: InsertTextFormat.Snippet,
    });
  }

  return items;
}

function getModuleCompletions(): CompletionItem[] {
  return standardLibraryModules.map((mod) => ({
    label: mod.name,
    kind: CompletionItemKind.Module,
    detail: `${mod.name} - ${mod.description}`,
  }));
}

function getMemberCompletions(text: string, offset: number): CompletionItem[] {
  // Get the word before the dot
  const beforeDot = text.substring(0, offset - 1);
  const wordMatch = beforeDot.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
  if (!wordMatch) return [];

  const objName = wordMatch[1];

  // Check known type members
  if (typeMemberMap[objName]) {
    return typeMemberMap[objName].map((m) => ({
      label: m.label,
      kind: CompletionItemKind.Method,
      detail: m.detail,
    }));
  }

  // Check if objName is a known type
  const builtinType = builtinTypes.find((t) => t.label === objName);
  if (builtinType) {
    return [];
  }

  // Generic array members (if variable name suggests array)
  if (
    objName.endsWith("[]") ||
    objName.toLowerCase().includes("array") ||
    objName.toLowerCase().includes("list")
  ) {
    return arrayMembers.map((m) => ({
      label: m.label,
      kind: CompletionItemKind.Method,
      detail: m.detail,
    }));
  }

  return [];
}

// ========== SIGNATURE HELP HELPERS ==========

function getFunctionCallAtCursor(
  text: string,
  offset: number
): { name: string; currentArg: number } | null {
  // Scan backwards from cursor to find the function name
  // Count commas to determine current argument index
  let depth = 0;
  let argCount = 0;
  let i = offset - 1;

  // Count commas within the current parentheses context
  while (i >= 0) {
    const ch = text[i];
    if (ch === ")") {
      depth++;
    } else if (ch === "(") {
      if (depth > 0) {
        depth--;
      } else {
        // Found the opening paren of the function call we're in
        break;
      }
    } else if (ch === "," && depth === 0) {
      argCount++;
    }
    i--;
  }

  if (i < 0 || depth !== 0) return null;

  // Now find the function name before the parenthesis
  i--; // Move past the "("
  while (i >= 0 && text[i] === " ") i--; // Skip whitespace

  const nameEnd = i + 1;
  while (i >= 0 && /[A-Za-z_][A-Za-z0-9_]*/.test(text[i])) i--;
  const name = text.substring(i + 1, nameEnd);

  if (!name) return null;

  return { name, currentArg: argCount };
}

// ========== DEFINITION HELPERS ==========

function getImportPath(lineText: string): string | null {
  const trimmed = lineText.trim();

  // import module; or import module as alias;
  let match = trimmed.match(/^(?:import|from)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) return match[1];

  // include "file"; or include file;
  match = trimmed.match(/^include\s+"?([^"\s;]+)"?/);
  if (match) return match[1];

  // access module;
  match = trimmed.match(/^access\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) return match[1];

  return null;
}

function resolveImportPath(
  importPath: string,
  document: TextDocument
): Definition | null {
  const asyDir = globalSettings.asyPath
    ? getAsyDir(globalSettings.asyPath)
    : "/usr/share/asymptote";

  // Build candidate paths
  const candidates: string[] = [];

  // 1. Standard library path: $ASYDIR/base/
  if (!importPath.includes(".")) {
    // It's a module name like "graph" or "geometry"
    const mod = standardLibraryModules.find(
      (m) => m.name === importPath
    );
    if (mod) {
      candidates.push(`${asyDir}/base/${mod.filename}`);
    } else {
      // Try adding .asy extension
      candidates.push(`${asyDir}/base/${importPath}.asy`);
    }
    // Also try just the module name as a file
    candidates.push(`${asyDir}/base/${importPath}.asy`);
  }

  // 2. Relative to current file
  const currentDir = document.uri.replace(/\/[^/]*$/, "");
  candidates.push(`${currentDir}/${importPath}.asy`);
  candidates.push(`${currentDir}/${importPath}`);

  // 3. Workspace path
  // (Simplified - just try relative paths)

  // Return first matching candidate
  // Since we can't check file existence from LSP easily, we return the first
  // candidate path as a definition location (the client will handle URI resolution)
  for (const candidate of candidates) {
    // Return as a definition location pointing to file beginning
    return {
      uri: `file://${candidate}`,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  return null;
}

function findSymbolDefinition(
  document: TextDocument,
  position: Position
): Definition | null {
  const wordRange = getWordRangeAtPosition(document, position);
  if (!wordRange) return null;

  const word = document.getText(wordRange);

  // Search document for declarations of this symbol
  const text = document.getText();

  // Look for variable declarations: "type ident" or "type ident = ..."
  const declRegex = new RegExp(
    `\\b(${builtinTypes.map((t) => t.label).join("|")}|[A-Za-z_][A-Za-z0-9_]*(?:\\s+[A-Za-z_][A-Za-z0-9_]*)?)\\s+(${escapeRegex(word)})\\b`,
    "g"
  );

  let match: RegExpExecArray | null;
  while ((match = declRegex.exec(text)) !== null) {
    const matchPos = document.positionAt(match.index + match[0].indexOf(word));
    // Don't return the position we're currently at
    if (
      matchPos.line !== position.line ||
      matchPos.character !== position.character
    ) {
      return {
        uri: document.uri,
        range: {
          start: matchPos,
          end: {
            line: matchPos.line,
            character: matchPos.character + word.length,
          },
        },
      };
    }
  }

  // Look for struct definitions
  const structRegex = new RegExp(
    `struct\\s+(${escapeRegex(word)})\\b`,
    "g"
  );
  while ((match = structRegex.exec(text)) != null) {
    const matchPos = document.positionAt(match.index + 7);
    if (
      matchPos.line !== position.line ||
      matchPos.character !== position.character
    ) {
      return {
        uri: document.uri,
        range: {
          start: matchPos,
          end: {
            line: matchPos.line,
            character: matchPos.character + word.length,
          },
        },
      };
    }
  }

  return null;
}

// ========== FORMATTING HELPERS ==========

function formatDocument(
  document: TextDocument,
  options: FormattingOptions
): TextEdit[] {
  const settings = globalSettings.formatting;
  const text = document.getText();
  const edits: TextEdit[] = [];

  let formatted = "";
  const lines = text.split("\n");
  let indentLevel = 0;
  const indentStr = settings.insertSpaces
    ? " ".repeat(settings.indentSize)
    : "\t";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      formatted += "\n";
      continue;
    }

    // Adjust indent for closing braces before outputting
    if (/^[}\])]/.test(trimmed)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Build the formatted line with proper indentation
    let formattedLine = indentStr.repeat(indentLevel);

    // Format path expressions
    formattedLine += formatPathExpression(
      trimmed,
      settings.pathExpressionSpacing
    );

    // Brace style
    if (/\{$/.test(formattedLine) && settings.braceStyle === "allman") {
      // Move opening brace to next line
      const braceIdx = formattedLine.lastIndexOf("{");
      formattedLine =
        formattedLine.substring(0, braceIdx).trimEnd() +
        "\n" +
        indentStr.repeat(indentLevel) +
        "{";
    }

    formatted += formattedLine + "\n";

    // Adjust indent for opening braces after outputting
    if (/[{[(]$/.test(trimmed) && !/\}\)\]$/.test(trimmed)) {
      indentLevel = Math.min(indentLevel + 1, 20);
    }
  }

  // Create single edit replacing entire document
  edits.push({
    range: {
      start: { line: 0, character: 0 },
      end: document.positionAt(text.length),
    },
    newText: formatted.trimEnd() + "\n",
  });

  return edits;
}

function formatPathExpression(
  line: string,
  spacing: "compact" | "spaced"
): string {
  if (spacing === "compact") {
    return line
      .replace(/\s*\.\.\.\s*/g, " ... ")
      .replace(/\s*\.\.\s*/g, "..")
      .replace(/\s*--\s*/g, "--")
      .replace(/\s*---\s*/g, "---")
      .replace(/\s*::\s*/g, "::");
  } else {
    return line
      .replace(/\s*\.\.\.\s*/g, " ... ")
      .replace(/\s*\.\.\s*/g, " .. ")
      .replace(/\s*--\s*/g, " -- ")
      .replace(/\s*---\s*/g, " --- ")
      .replace(/\s*::\s*/g, " :: ");
  }
}

// ========== UTILITY HELPERS ==========

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAsyDir(asyPath: string): string {
  // Default standard library paths
  // The actual discovery would involve running `asy --version` or similar
  // For now, use known default paths
  const defaultPaths = [
    "/usr/share/asymptote",
    "/usr/local/share/asymptote",
    "/opt/asymptote",
  ];

  // In the future, could run: asy --help or check env var ASYMPTOTE_DIR
  return process.env.ASYMPTOTE_DIR || defaultPaths[0];
}