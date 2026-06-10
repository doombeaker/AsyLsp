import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

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
  SemanticTokensBuilder,
  SemanticTokens,
  SemanticTokensRequest,
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

let workspaceFolders: string[] = [];

// Configuration
interface AsymptoteSettings {
  asyPath: string;
  searchPaths: string[];
  formatting: {
    braceStyle: "kr" | "allman";
    indentSize: number;
    insertSpaces: boolean;
    pathExpressionSpacing: "compact" | "spaced";
  };
}

const defaultSettings: AsymptoteSettings = {
  asyPath: "asy",
  searchPaths: [],
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

  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders.map((f) =>
      fileURLToPath(f.uri)
    );
  }

  const initOptions = params.initializationOptions as Partial<AsymptoteSettings> | undefined;
  if (initOptions) {
    if (initOptions.asyPath !== undefined) {
      globalSettings.asyPath = initOptions.asyPath;
    }
    if (initOptions.searchPaths !== undefined) {
      globalSettings.searchPaths = initOptions.searchPaths;
    }
    if (initOptions.formatting) {
      Object.assign(globalSettings.formatting, initOptions.formatting);
    }
  }

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
      semanticTokensProvider: {
        legend: {
          tokenTypes: [
            "keyword",
            "type",
            "function",
            "parameter",
            "variable",
            "namespace",
            "comment",
            "string",
            "number",
            "operator",
          ],
          tokenModifiers: ["declaration", "readonly", "defaultLibrary"],
        },
        full: true,
      },
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
  connection.client.register(
    DidChangeConfigurationNotification.type,
    undefined
  );
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const removed of event.removed) {
        const p = fileURLToPath(removed.uri);
        workspaceFolders = workspaceFolders.filter((f) => f !== p);
      }
      for (const added of event.added) {
        const p = fileURLToPath(added.uri);
        if (!workspaceFolders.includes(p)) {
          workspaceFolders.push(p);
        }
      }
    });
  }
});

// ========== CONFIGURATION CHANGE ==========

connection.onDidChangeConfiguration((change) => {
  const asySettings = (change.settings.asymptote || {}) as Partial<AsymptoteSettings>;
  if (asySettings.searchPaths !== undefined) {
    globalSettings.searchPaths = asySettings.searchPaths;
    cachedSearchPathHash = "";
    cachedPlainHash = "";
  }
  if (asySettings.asyPath !== undefined) {
    globalSettings.asyPath = asySettings.asyPath;
  }
  if (asySettings.formatting !== undefined) {
    Object.assign(globalSettings.formatting, asySettings.formatting);
  }
  if (hasConfigurationCapability) {
    documentSettings.clear();
  }
});

async function refreshGlobalSettings(): Promise<void> {
  try {
    const fresh = await connection.workspace.getConfiguration("asymptote");
    if (fresh === null || fresh === undefined) return;
    const s = fresh as Partial<AsymptoteSettings>;
    let changed = false;
    if (s.searchPaths !== undefined && !arraysEqual(s.searchPaths, globalSettings.searchPaths)) {
      globalSettings.searchPaths = s.searchPaths;
      cachedSearchPathHash = "";
      cachedPlainHash = "";
      changed = true;
    }
    if (s.asyPath !== undefined && s.asyPath !== globalSettings.asyPath) {
      globalSettings.asyPath = s.asyPath;
      changed = true;
    }
    if (s.formatting !== undefined) {
      Object.assign(globalSettings.formatting, s.formatting);
    }
  } catch { /* pull failed, keep using cached */ }
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// ========== HOVER PROVIDER ==========

connection.onHover(async (params) => {
  await refreshGlobalSettings();
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

  const importedDefs = collectAllDefinitions(word, document);
  if (importedDefs.length > 0) {
    const firstUri = importedDefs[0].uri;
    const firstPath = fileURLToPath(firstUri);
    const moduleName = path.basename(firstPath, ".asy");
    const count = importedDefs.length;
    const overloadNote = count > 1 ? ` (${count} overload${count > 1 ? "s" : ""})` : "";
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${word}** - defined in \`${moduleName}.asy\`${overloadNote}\n\n*Press F12 to jump to definition*`,
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

connection.onDefinition(async (params) => {
  await refreshGlobalSettings();
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

  const currentFileDef = findSymbolDefinition(document, params.position);
  if (currentFileDef) return currentFileDef;

  const wordRange = getWordRangeAtPosition(document, params.position);
  if (!wordRange) return null;
  const word = document.getText(wordRange);

  const dotAccess = getDotAccessTarget(lineText, params.position);
  if (dotAccess) {
    const dotResult = resolveDotAccess(dotAccess.objectName, dotAccess.symbolName, document);
    if (dotResult) return dotResult;
  }

  const allDefs = collectAllDefinitions(word, document);
  if (allDefs.length > 0) return allDefs;

  return null;
});

// ========== FORMATTING PROVIDER ==========

connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  return formatDocument(document, params.options);
});

// ========== SEMANTIC TOKENS PROVIDER ==========

const TOKEN_KEYWORD = 0;
const TOKEN_TYPE = 1;
const TOKEN_FUNCTION = 2;
const TOKEN_PARAMETER = 3;
const TOKEN_VARIABLE = 4;
const TOKEN_NAMESPACE = 5;
const TOKEN_COMMENT = 6;
const TOKEN_STRING = 7;
const TOKEN_NUMBER = 8;
const TOKEN_OPERATOR = 9;

const MOD_DECLARATION = 1 << 0;
const MOD_READONLY = 1 << 1;
const MOD_DEFAULTLIB = 1 << 2;

connection.onRequest(SemanticTokensRequest.type, (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return { data: [] };
  const builder = new SemanticTokensBuilder();
  tokenizeSemantic(document, builder);
  return builder.build();
});

function collectDefinitions(document: TextDocument): {
  structs: Set<string>;
  functions: Set<string>;
  params: Set<string>;
} {
  const text = document.getText();
  const structs = new Set<string>();
  const functions = new Set<string>();
  const params = new Set<string>();
  const keywordSet = new Set(keywords);
  const builtinTypeSet = new Set(builtinTypes.map((t) => t.label));

  const structRegex = /struct\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let sm: RegExpExecArray | null;
  while ((sm = structRegex.exec(text)) !== null) {
    structs.add(sm[1]);
  }

  const funcRegex = /\b([A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let fm: RegExpExecArray | null;
  while ((fm = funcRegex.exec(text)) !== null) {
    const retType = fm[1];
    const funcName = fm[2];
    if (!keywordSet.has(retType) || retType === "struct" || retType === "typedef") continue;
    if (retType === "void" || builtinTypeSet.has(retType) || /^[A-Z]/.test(retType)) {
      functions.add(funcName);
      const openParen = fm.index + fm[0].length;
      let depth = 0;
      let closeParen = -1;
      for (let j = openParen; j < text.length; j++) {
        if (text[j] === "(") { depth++; }
        else if (text[j] === ")") {
          if (depth === 0) { closeParen = j; break; }
          depth--;
        }
      }
      if (closeParen > openParen) {
        const paramStr = text.substring(openParen, closeParen);
        for (const part of paramStr.split(",")) {
          const words = part.trim().split(/\s+/);
          for (let w = 0; w < words.length - 1; w++) {
            if (builtinTypeSet.has(words[w]) || structs.has(words[w]) || /^[A-Z]/.test(words[w])) {
              const paramName = words[w + 1].replace(/=.*$/, "");
              if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(paramName)) {
                params.add(paramName);
              }
            }
          }
        }
      }
    }
  }

  return { structs, functions, params };
}

function tokenizeSemantic(
  document: TextDocument,
  builder: SemanticTokensBuilder
): void {
  const defs = collectDefinitions(document);
  const text = document.getText();
  const len = text.length;
  let i = 0;
  let line = 0;
  let char = 0;
  const keywordSet = new Set(keywords);
  const builtinTypeSet = new Set(builtinTypes.map((t) => t.label));
  const constantSet = new Set(constants.map((c) => c.label));
  const builtinFuncSet = new Set(builtinFunctions.map((f) => f.label));

  const addToken = (
    tl: number, tc: number, tlen: number,
    tt: number, mods: number
  ) => builder.push(tl, tc, tlen, tt, mods);

  while (i < len) {
    while (i < len && (text[i] === " " || text[i] === "\t" || text[i] === "\r")) {
      char++; i++;
    }
    while (i < len && text[i] === "\n") { line++; char = 0; i++; }
    if (i >= len) break;

    const c = text[i];
    const cl = line;
    const cc = char;

    if (c === "/" && i + 1 < len && text[i + 1] === "/") {
      const startC = cc;
      i += 2; char += 2;
      while (i < len && text[i] !== "\n") { char++; i++; }
      addToken(cl, startC, char - startC, TOKEN_COMMENT, 0);
      continue;
    }

    if (c === "/" && i + 1 < len && text[i + 1] === "*") {
      const startC = cc;
      i += 2; char += 2;
      while (i < len - 1 && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") { line++; char = 0; }
        else char++;
        i++;
      }
      if (i < len - 1) { i += 2; char += 2; }
      else { i = len; }
      addToken(cl, startC, 2 + (i - cl > 0 ? i - (cl > 0 ? 0 : 0) : 0), TOKEN_COMMENT, 0);
      continue;
    }

    if (c === "\"" || c === "'") {
      const delim = c;
      const startC = cc;
      i++; char++;
      while (i < len && text[i] !== delim) {
        if (text[i] === "\\") { char += 2; i += 2; }
        else if (text[i] === "\n") { line++; char = 0; i++; }
        else { char++; i++; }
      }
      if (i < len) { i++; char++; }
      addToken(cl, startC, i - (cl * 0 + startC), TOKEN_STRING, 0);
      continue;
    }

    if (/[0-9]/.test(c) || (c === "." && i + 1 < len && /[0-9]/.test(text[i + 1]))) {
      const startC = cc;
      while (i < len && /[0-9.eE+\-]/.test(text[i])) { char++; i++; }
      addToken(cl, startC, char - startC, TOKEN_NUMBER, 0);
      continue;
    }

    if (/[{}\[\]();,:.<>=+\-*\/#%^!&|?~@$\\]/.test(c)) {
      let opLen = 1;
      const c2 = i + 1 < len ? text[i + 1] : "";
      const c3 = i + 2 < len ? text[i + 2] : "";
      if (c === "." && c2 === ".") { opLen = c3 === "." ? 3 : 2; }
      else if (c === "-" && c2 === "-") { opLen = c3 === "-" ? 3 : 2; }
      else if (c === ":" && c2 === ":") opLen = 2;
      else if ((c === "=" || c === "!" || c === "<" || c === ">") && c2 === "=") opLen = 2;
      else if (c === "&" && c2 === "&") opLen = 2;
      else if (c === "|" && c2 === "|") opLen = 2;
      else if ((c === "+" || c === "-") && c2 === c) opLen = 2;
      char += opLen; i += opLen;
      addToken(cl, cc, opLen, TOKEN_OPERATOR, 0);
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const startC = cc;
      let word = "";
      while (i < len && /[A-Za-z0-9_]/.test(text[i])) {
        word += text[i]; char++; i++;
      }
      const wlen = word.length;
      let tt = TOKEN_VARIABLE;
      let mods = 0;

      if (keywordSet.has(word)) {
        tt = TOKEN_KEYWORD;
      } else if (builtinTypeSet.has(word)) {
        tt = TOKEN_TYPE;
        mods = MOD_DEFAULTLIB;
      } else if (constantSet.has(word)) {
        tt = TOKEN_VARIABLE;
        mods = MOD_READONLY | MOD_DEFAULTLIB;
      } else if (builtinFuncSet.has(word)) {
        tt = TOKEN_FUNCTION;
        mods = MOD_DEFAULTLIB;
      } else if (defs.structs.has(word)) {
        tt = TOKEN_TYPE;
        mods = MOD_DECLARATION;
      } else if (defs.functions.has(word)) {
        tt = TOKEN_FUNCTION;
      } else if (defs.params.has(word)) {
        tt = TOKEN_PARAMETER;
      }

      addToken(cl, startC, wlen, tt, mods);
      continue;
    }

    char++; i++;
  }
}

// Make the text document manager listen on the connection
// for open, change, and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

// ========== HELPER FUNCTIONS ==========

function getLineText(document: TextDocument, line: number): string {
  const lineRange = {
    start: { line, character: 0 },
    end: { line, character: document.getText().split("n")[line]?.length || 0 },
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

function resolveModuleFile(
  moduleName: string,
  document: TextDocument
): string | null {
  const searchPath = buildSearchPath(document);
  const candidates = [
    moduleName.replace(/\./g, "/") + ".asy",
    moduleName.replace(/\./g, "/"),
    moduleName + ".asy",
    moduleName,
  ];

  for (const dir of searchPath) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return null;
}

function getDocumentImports(document: TextDocument): string[] {
  const text = document.getText();
  const modules = new Set<string>();
  const importRegex = /^(?:import|access)\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\b/gm;
  const fromRegex = /^from\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s+access\b/gm;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(text)) !== null) {
    modules.add(match[1]);
  }
  while ((match = fromRegex.exec(text)) !== null) {
    modules.add(match[1]);
  }

  modules.add("plain");
  for (const m of scanPlainModules(document)) {
    modules.add(m);
  }

  return Array.from(modules);
}

let cachedPlainModules: string[] = [];
let cachedPlainHash: string = "";

function scanPlainModules(document: TextDocument): string[] {
  const searchPath = buildSearchPath(document);
  const hash = searchPath.join(":");
  if (hash === cachedPlainHash) return cachedPlainModules;

  cachedPlainHash = hash;
  cachedPlainModules = [];
  const seen = new Set<string>();

  for (const dir of searchPath) {
    for (const candidate of [dir, path.join(dir, "base")]) {
      if (!fs.existsSync(candidate)) continue;
      try {
        for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          if (!entry.name.startsWith("plain_") || !entry.name.endsWith(".asy")) continue;
          const moduleName = entry.name.slice(0, -4);
          if (!seen.has(moduleName)) {
            seen.add(moduleName);
            cachedPlainModules.push(moduleName);
          }
        }
      } catch { /* skip unreadable */ }
    }
  }

  return cachedPlainModules;
}

function findSymbolInFile(
  filePath: string,
  symbolName: string
): Location[] {
  if (!fs.existsSync(filePath)) return [];

  const fileUrl = filePath.startsWith("/")
    ? `file://${filePath}`
    : `file:///${filePath}`;

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const escaped = escapeRegex(symbolName);
  const results: Location[] = [];

  const structRegex = new RegExp(`struct\\s+(${escaped})\\b`, "g");
  let structMatch: RegExpExecArray | null;
  while ((structMatch = structRegex.exec(fileContent)) !== null) {
    const nameStartInMatch = structMatch[0].indexOf(structMatch[1]);
    const offset = structMatch.index + nameStartInMatch;
    const line = fileContent.substring(0, offset).split("\n").length - 1;
    results.push({
      uri: fileUrl,
      range: {
        start: { line, character: 0 },
        end: { line, character: 0 },
      },
    });
  }
  if (results.length > 0) return results;

  const declRegex = new RegExp(
    `\\b([A-Za-z_][A-Za-z0-9_]*(?:\\s+[A-Za-z_][A-Za-z0-9_]*)?)\\s+(${escaped})\\b`,
    "g"
  );
  let declMatch: RegExpExecArray | null;
  while ((declMatch = declRegex.exec(fileContent)) !== null) {
    const fullMatch = declMatch[0];
    const matchedSymbol = declMatch[2];
    const symbolOffset = declMatch.index + fullMatch.lastIndexOf(matchedSymbol);
    const line = fileContent.substring(0, symbolOffset).split("\n").length - 1;
    const charPos = symbolOffset - fileContent.lastIndexOf("\n", symbolOffset - 1) - 1;
    results.push({
      uri: fileUrl,
      range: {
        start: { line, character: charPos },
        end: { line, character: charPos + symbolName.length },
      },
    });
  }

  return results;
}

function getDotAccessTarget(
  lineText: string,
  position: Position
): { objectName: string; symbolName: string } | null {
  const trimmed = lineText.trim();
  const dotMatch = trimmed.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/
  );
  if (!dotMatch) return null;

  const methodName = dotMatch[2];
  const leadingWs = lineText.length - trimmed.length;
  const fullExpr = dotMatch[0];
  const exprStart = leadingWs + trimmed.indexOf(fullExpr);
  const methodStart = exprStart + fullExpr.lastIndexOf(methodName);
  const methodEnd = methodStart + methodName.length;
  if (position.character < methodStart || position.character > methodEnd) return null;

  return { objectName: dotMatch[1].split(".")[0], symbolName: methodName };
}

function resolveDotAccess(
  objectName: string,
  symbolName: string,
  document: TextDocument
): Location[] | null {
  const modulePath = resolveModuleFile(objectName, document);
  if (!modulePath) return null;
  const results = findSymbolInFile(modulePath, symbolName);
  return results.length > 0 ? results : null;
}

function collectAllDefinitions(word: string, document: TextDocument): Location[] {
  const results: Location[] = [];
  const importedModules = getDocumentImports(document);
  for (const moduleName of importedModules) {
    const moduleFile = resolveModuleFile(moduleName, document);
    if (!moduleFile) continue;
    results.push(...findSymbolInFile(moduleFile, word));
  }
  return results;
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
  const lines = text.split("n");
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

function expandPath(raw: string): string {
  let expanded = raw.replace(/^~(?=$|\/|\\)/g, os.homedir());
  expanded = expanded.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || "");
  expanded = expanded.replace(/\$(\w+)/g, (_, name) => process.env[name] || "");
  return path.resolve(expanded);
}

function buildSearchPath(document: TextDocument): string[] {
  const paths: string[] = [];

  for (const ws of workspaceFolders) {
    paths.push(ws);
  }

  for (const sp of globalSettings.searchPaths) {
    paths.push(expandPath(sp));
  }

  const asyHome = process.env.ASYMPTOTE_HOME || path.join(os.homedir(), ".asy");
  if (fs.existsSync(asyHome)) {
    paths.push(asyHome);
  }

  const filePath = fileURLToPath(document.uri);
  paths.push(path.dirname(filePath));

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    if (!seen.has(p)) {
      seen.add(p);
      unique.push(p);
    }
  }
  return unique;
}

function createFileLocation(filePath: string): Definition {
  const href = filePath.startsWith("/")
    ? `file://${filePath}`
    : `file:///${filePath}`;
  return {
    uri: href,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
  };
}

function resolveImportPath(
  importPath: string,
  document: TextDocument
): Definition | null {
  const searchPath = buildSearchPath(document);

  const hasSlash = importPath.includes("/");
  const hasDots = importPath.includes(".");

  const candidates: string[] = [];

  if (hasDots) {
    candidates.push(importPath.replace(/\./g, "/") + ".asy");
    candidates.push(importPath.replace(/\./g, "/"));
  }

  candidates.push(importPath + ".asy");
  candidates.push(importPath);

  if (hasSlash || hasDots) {
    candidates.push(importPath + ".asy" + ".asy");
  }

  if (/^\.asy$/.test(path.extname(importPath))) {
    candidates.push(importPath + ".asy");
  } else {
    candidates.push(importPath);
  }

  if (path.isAbsolute(importPath)) {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return createFileLocation(candidate);
      }
    }
  }

  for (const dir of searchPath) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) {
        return createFileLocation(fullPath);
      }
    }
  }

  return null;
}

let cachedSearchModules: CompletionItem[] = [];
let cachedSearchPathHash: string = "";

function scanSearchPathModules(searchPath: string[]): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  for (const dir of searchPath) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".asy")) {
          const moduleName = entry.name.slice(0, -4);
          if (!seen.has(moduleName)) {
            seen.add(moduleName);
            items.push({
              label: moduleName,
              kind: CompletionItemKind.Module,
              detail: `${moduleName} - from ${dir}`,
            });
          }
        } else if (entry.isDirectory()) {
          try {
            const subEntries = fs.readdirSync(path.join(dir, entry.name), {
              withFileTypes: true,
            });
            for (const subEntry of subEntries) {
              if (subEntry.isFile() && subEntry.name.endsWith(".asy")) {
                const moduleName = `${entry.name}.${subEntry.name.slice(0, -4)}`;
                if (!seen.has(moduleName)) {
                  seen.add(moduleName);
                  items.push({
                    label: moduleName,
                    kind: CompletionItemKind.Module,
                    detail: `${moduleName} - from ${path.join(dir, entry.name)}`,
                  });
                }
              }
            }
          } catch { /* skip unreadable subdirectories */ }
        }
      }
    } catch { /* skip unreadable directories */ }
  }

  return items;
}

function getModuleCompletions(): CompletionItem[] {
  const searchPath = workspaceFolders.length > 0
    ? workspaceFolders.concat(
        [expandPath(process.env.ASYMPTOTE_HOME || path.join(os.homedir(), ".asy"))]
      )
    : [expandPath(process.env.ASYMPTOTE_HOME || path.join(os.homedir(), ".asy"))];

  const currentHash = searchPath.join(":");
  if (currentHash !== cachedSearchPathHash) {
    cachedSearchPathHash = currentHash;
    cachedSearchModules = scanSearchPathModules(searchPath);
  }

  const seen = new Set(standardLibraryModules.map((m) => m.name));
  const items: CompletionItem[] = standardLibraryModules.map((mod) => ({
    label: mod.name,
    kind: CompletionItemKind.Module,
    detail: `${mod.name} - ${mod.description}`,
  }));

  for (const item of cachedSearchModules) {
    if (!seen.has(item.label)) {
      seen.add(item.label);
      items.push(item);
    }
  }

  return items;
}