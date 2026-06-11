import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
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
  DocumentSymbol,
  SymbolKind,
  ColorInformation,
  Color,
  ColorPresentation,
  ReferenceParams,
  WorkspaceEdit,
  PrepareRenameParams,
  RenameParams,
  TextDocumentPositionParams,
  FoldingRange,
  FoldingRangeRequest,
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
      documentSymbolProvider: true,
      referencesProvider: true,
      colorProvider: true,
      renameProvider: { prepareProvider: true },
      foldingRangeProvider: true,
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
  if (!change || !change.settings) return;
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
  localSymbolCache.delete(e.document.uri);
  importedSymbolCache.delete(e.document.uri);
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
  //connection.console.log(`[completion] trigger charBefore="${charBeforeCursor}" line="${lineText.trim().slice(0,60)}"`);

  // ===== IMPORT COMPLETION (standard library modules) =====
  if (isAfterImport(lineText)) {
    connection.console.log("[completion] → import path");
    return getModuleCompletions();
  }

  // ===== FILE PATH COMPLETION (include/access) =====
  if (isAfterInclude(lineText)) {
    return []; // File path completion - delegate to VS Code's fs completion
  }

  // ===== DOT COMPLETION (member access) =====
  if (charBeforeCursor === ".") {
    connection.console.log("[completion] → dot (charBefore)");
    return getMemberCompletions(document, text, offset);
  }
  const dotIdx = text.substring(0, offset).lastIndexOf(".");
  if (dotIdx > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(text.substring(dotIdx + 1, offset))) {
    connection.console.log("[completion] → dot (inline)");
    return getMemberCompletions(document, text, offset);
  }

  // ===== PAREN COMPLETION =====
  if (charBeforeCursor === "(") {
    return []; // Let signatureHelp handle at "("
  }

  // ===== SPACE COMPLETION =====
  if (shouldProvideCompletions(lineText, charBeforeCursor)) {
    connection.console.log("[completion] → space/free, calling getAllCompletions");
    const all = getAllCompletions(document);
    connection.console.log(`[completion] getAllCompletions → ${all.length} items`);
    return all;
  }

  connection.console.log("[completion] → fallthrough (no completions)");
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
  buildStructIndex(document);
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
      } else if (defs.structs.has(word) || structIndex.has(word)) {
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

// ========== DOCUMENT SYMBOLS PROVIDER ==========

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const symbols: DocumentSymbol[] = [];
  const text = document.getText();
  const lines = text.split("\n");

  const structRegex = /struct\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let sm: RegExpExecArray | null;
  while ((sm = structRegex.exec(text)) !== null) {
    const pos = document.positionAt(sm.index);
    symbols.push({
      name: sm[1],
      kind: SymbolKind.Struct,
      range: { start: pos, end: document.positionAt(sm.index + sm[0].length) },
      selectionRange: { start: pos, end: document.positionAt(sm.index + sm[1].length + 6) },
    });
  }

  const funcRegex = /\b([A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let fm: RegExpExecArray | null;
  while ((fm = funcRegex.exec(text)) !== null) {
    const retType = fm[1];
    if (keywordSet.has(retType) && retType !== "struct" && retType !== "typedef") continue;
    if (retType !== "void" && !builtinTypeNames.has(retType) && !/[A-Z]/.test(retType[0])) continue;
    const pos = document.positionAt(fm.index + fm[0].indexOf(fm[2]));
    symbols.push({
      name: fm[2],
      kind: SymbolKind.Function,
      range: { start: pos, end: document.positionAt(fm.index + fm[0].length) },
      selectionRange: { start: pos, end: document.positionAt(fm.index + fm[0].indexOf(fm[2]) + fm[2].length) },
    });
  }

  return symbols;
});

const builtinTypeNames = new Set(builtinTypes.map((t) => t.label));
const keywordSet = new Set(keywords);

// ========== REFERENCES PROVIDER ==========

connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const wordRange = getWordRangeAtPosition(document, params.position);
  if (!wordRange) return [];
  const word = document.getText(wordRange);
  return findAllReferences(word, document);
});

// ========== COLOR PROVIDER ==========

const namedColors: Record<string, [number, number, number, number]> = {
  white: [1, 1, 1, 1], black: [0, 0, 0, 1],
  red: [1, 0, 0, 1], green: [0, 1, 0, 1], blue: [0, 0, 1, 1],
  yellow: [1, 1, 0, 1], magenta: [1, 0, 1, 1], cyan: [0, 1, 1, 1],
  orange: [1, 0.647, 0, 1], purple: [0.502, 0, 0.502, 1],
  pink: [1, 0.753, 0.796, 1], brown: [0.647, 0.165, 0.165, 1],
  gray: [0.5, 0.5, 0.5, 1], grey: [0.5, 0.5, 0.5, 1],
  lightgray: [0.827, 0.827, 0.827, 1], lightgrey: [0.827, 0.827, 0.827, 1],
  darkgray: [0.663, 0.663, 0.663, 1], darkgrey: [0.663, 0.663, 0.663, 1],
  olive: [0.502, 0.502, 0, 1], teal: [0, 0.502, 0.502, 1],
  navy: [0, 0, 0.502, 1], maroon: [0.502, 0, 0, 1],
  lime: [0.749, 1, 0, 1], aqua: [0, 1, 1, 1],
  silver: [0.753, 0.753, 0.753, 1],
};

connection.onDocumentColor((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const colors: ColorInformation[] = [];
  const text = document.getText();

  for (const [name, rgba] of Object.entries(namedColors)) {
    const regex = new RegExp(`\\b${name}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const pos = document.positionAt(match.index);
      colors.push({
        range: { start: pos, end: document.positionAt(match.index + name.length) },
        color: Color.create(rgba[0], rgba[1], rgba[2], rgba[3]),
      });
    }
  }

  const rgbRegex = /rgb\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rgbRegex.exec(text)) !== null) {
    const pos = document.positionAt(rm.index);
    colors.push({
      range: { start: pos, end: document.positionAt(rm.index + rm[0].length) },
      color: Color.create(parseFloat(rm[1]), parseFloat(rm[2]), parseFloat(rm[3]), 1),
    });
  }

  const cmykRegex = /cmyk\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/g;
  let ck: RegExpExecArray | null;
  while ((ck = cmykRegex.exec(text)) !== null) {
    const c_ = parseFloat(ck[1]), m = parseFloat(ck[2]), y = parseFloat(ck[3]), k = parseFloat(ck[4]);
    const rr = 1 - Math.min(1, c_ + k);
    const gg = 1 - Math.min(1, m + k);
    const bb = 1 - Math.min(1, y + k);
    const pos = document.positionAt(ck.index);
    colors.push({
      range: { start: pos, end: document.positionAt(ck.index + ck[0].length) },
      color: Color.create(rr, gg, bb, 1),
    });
  }

  const grayRegex = /\bgray\(\s*([0-9.]+)\s*\)/g;
  let gk: RegExpExecArray | null;
  while ((gk = grayRegex.exec(text)) !== null) {
    const gv = parseFloat(gk[1]);
    const pos = document.positionAt(gk.index);
    colors.push({
      range: { start: pos, end: document.positionAt(gk.index + gk[0].length) },
      color: Color.create(gv, gv, gv, 1),
    });
  }

  return colors;
});

connection.onColorPresentation((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const rangeText = doc.getText(params.range);
  const m = rangeText.match(/^(rgb|cmyk|gray)\(([^)]+)\)$/);
  if (!m) return [];

  const funcName = m[1];
  if (funcName === "rgb") return [{ label: formatRgb(params.color), textEdit: { range: params.range, newText: formatRgb(params.color) } }];
  if (funcName === "cmyk") return [{ label: formatCmyk(params.color), textEdit: { range: params.range, newText: formatCmyk(params.color) } }];
  if (funcName === "gray") return [{ label: formatGray(params.color), textEdit: { range: params.range, newText: formatGray(params.color) } }];
  return [];
});

function formatRgb(c: Color): string {
  const r = Math.round(c.red * 255) / 255;
  const g = Math.round(c.green * 255) / 255;
  const b = Math.round(c.blue * 255) / 255;
  return `rgb(${r},${g},${b})`;
}

function formatCmyk(c: Color): string {
  const r = c.red, g = c.green, b = c.blue;
  const k = 1 - Math.max(r, g, b);
  const denom = 1 - k || 1;
  const ci = (1 - r - k) / denom;
  const mi = (1 - g - k) / denom;
  const yi = (1 - b - k) / denom;
  return `cmyk(${r1(ci)},${r1(mi)},${r1(yi)},${r1(k)})`;
}

function formatGray(c: Color): string {
  const gv = Math.round((c.red + c.green + c.blue) / 3 * 255) / 255;
  return `gray(${gv})`;
}

function r1(v: number): string {
  const f = Math.round(v * 1000) / 1000;
  return Number.isInteger(f) ? f + ".0" : String(f);
}

// ========== RENAME PROVIDER ==========

connection.onPrepareRename((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const wordRange = getWordRangeAtPosition(document, params.position);
  if (!wordRange) return null;
  const word = document.getText(wordRange);
  if (keywordSet.has(word)) return null;
  return wordRange;
});

connection.onRenameRequest((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  const wordRange = getWordRangeAtPosition(document, params.position);
  if (!wordRange) return null;
  const word = document.getText(wordRange);

  const locations = findAllReferences(word, document, wordRange);
  if (locations.length === 0) return null;

  const edits: Record<string, TextEdit[]> = {};
  for (const loc of locations) {
    const uri = loc.uri;
    if (!edits[uri]) edits[uri] = [];
    edits[uri].push({ range: loc.range, newText: params.newName });
  }
  return { changes: edits };
});

function findAllReferences(
  word: string,
  document: TextDocument,
  excludeRange?: Range
): Location[] {
  const escaped = escapeRegex(word);
  const results: Location[] = [];
  const refRegex = new RegExp(`\\b(${escaped})\\b`, "g");

  const addMatches = (content: string, uri: string) => {
    let match: RegExpExecArray | null;
    while ((match = refRegex.exec(content)) !== null) {
      const pos = document.positionAt(match.index);
      if (excludeRange &&
        pos.line === excludeRange.start.line &&
        pos.character === excludeRange.start.character) continue;
      results.push({
        uri,
        range: { start: pos, end: { line: pos.line, character: pos.character + word.length } },
      });
    }
  };

  addMatches(document.getText(), document.uri);

  const importedModules = getDocumentImports(document);
  for (const moduleName of importedModules) {
    const moduleFile = resolveModuleFile(moduleName, document);
    if (!moduleFile) continue;
    try {
      const content = fs.readFileSync(moduleFile, "utf-8");
      const fileUri = moduleFile.startsWith("/") ? `file://${moduleFile}` : `file:///${moduleFile}`;
      addMatches(content, fileUri);
    } catch { /* skip */ }
  }

  return results;
}

connection.onRequest(FoldingRangeRequest.type, (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const text = document.getText();
  const ranges: FoldingRange[] = [];
  const stack: { line: number; startChar: number }[] = [];

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      const pos = document.positionAt(i);
      stack.push({ line: pos.line, startChar: pos.character });
    } else if (text[i] === "}" && stack.length > 0) {
      const start = stack.pop()!;
      const pos = document.positionAt(i);
      if (start.line !== pos.line) {
        ranges.push({ startLine: start.line, endLine: pos.line });
      }
    } else if (text.substring(i, i + 2) === "/*") {
      const startPos = document.positionAt(i);
      const end = text.indexOf("*/", i + 2);
      if (end !== -1) {
        const endPos = document.positionAt(end);
        if (startPos.line !== endPos.line) {
          ranges.push({ startLine: startPos.line, endLine: endPos.line });
        }
        i = end + 1;
      }
    }
  }

  return ranges;
});

// Make the text document manager listen on the connection
// for open, change, and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

// ========== STRUCT INDEX & TYPE INFERENCE ==========

interface StructMember {
  name: string;
  type: string;
}

const structIndex = new Map<string, StructMember[]>();
const structIndexCache = new Map<string, number>();

function parseStructBodies(text: string): Map<string, StructMember[]> {
  const result = new Map<string, StructMember[]>();
  const kwSet = new Set(["if","else","for","while","return","break","continue","unravel","from","import","access","using","typedef","new"]);
  let i = 0;
  while ((i = text.indexOf("struct", i)) !== -1) {
    if (i > 0 && /[A-Za-z0-9_]/.test(text[i - 1])) { i += 6; continue; }
    let j = i + 6;
    while (j < text.length && /[ \t]/.test(text[j])) j++;
    if (j >= text.length || !/[A-Za-z_]/.test(text[j])) { i++; continue; }
    const idStart = j;
    while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
    const name = text.slice(idStart, j);
    if (name === "typedef") { i = j; continue; }
    const braceStart = text.indexOf("{", j);
    if (braceStart === -1) { i = j; continue; }
    let depth = 0;
    let k = braceStart;
    for (; k < text.length; k++) {
      if (text[k] === "{") depth++;
      else if (text[k] === "}") { depth--; if (depth === 0) break; }
      else if (text[k] === '"' || text[k] === "'") {
        const q = text[k]; k++;
        while (k < text.length && text[k] !== q) { if (text[k] === "\\") k++; k++; }
      }
      else if (text[k] === "/" && k + 1 < text.length) {
        if (text[k + 1] === "/") { while (k < text.length && text[k] !== "\n") k++; }
        else if (text[k + 1] === "*") { k += 2; while (k + 1 < text.length && !(text[k] === "*" && text[k + 1] === "/")) k++; k++; }
      }
    }
    if (k >= text.length) { i = braceStart + 1; continue; }
    const body = text.slice(braceStart + 1, k);
    const members = parseStructMembers(body, name, kwSet);
    result.set(name, members);
    i = k + 1;
  }
  return result;
}

function parseStructMembers(body: string, structName: string, kwSet: Set<string>): StructMember[] {
  const members: StructMember[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[ \t\n\r]/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] === "/" && i + 1 < body.length) {
      if (body[i + 1] === "/") { i += 2; while (i < body.length && body[i] !== "\n") i++; continue; }
      if (body[i + 1] === "*") { i += 2; while (i + 1 < body.length && !(body[i] === "*" && body[i + 1] === "/")) i++; i += 2; continue; }
    }
    if (body[i] === "{") { let d = 1; i++; while (i < body.length && d > 0) { if (body[i] === "{") d++; else if (body[i] === "}") d--; i++; } continue; }
    if (body[i] === ";") { i++; continue; }
    const lineMatch = body.slice(i).match(/^([^\n]*)/);
    if (!lineMatch) { i++; continue; }
    const line = lineMatch[1].trim();
    if (!line) { i++; continue; }
    const firstWord = line.split(/\s+/)[0];
    if (kwSet.has(firstWord)) { i += lineMatch[0].length + 1; continue; }
    if (firstWord === "struct" || (firstWord === "void" && line.includes("operator"))) { i += lineMatch[0].length + 1; continue; }
    if (firstWord === "typedef") { i += lineMatch[0].length + 1; continue; }
    const declMatch = line.match(/^(?:(?:public|private|restricted|static|explicit|autounravel)\s+)*([A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)*)(?:\[\])?\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:;|=)/);
    if (declMatch) {
      const mType = declMatch[1];
      const mName = declMatch[2];
      if (mName !== structName) {
        members.push({ name: mName, type: mType });
      }
    }
    i += lineMatch[0].length + 1;
  }
  return members;
}

function buildStructIndex(document: TextDocument): void {
  const searchPath = buildSearchPath(document);
  for (const dir of searchPath) {
    const scanDirs = [dir, path.join(dir, "base")];
    for (const d of scanDirs) {
      if (!fs.existsSync(d)) continue;
      try {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const fp = path.join(d, entry.name);
          if (entry.isFile() && entry.name.endsWith(".asy")) {
            indexFile(fp);
          } else if (entry.isDirectory()) {
            try {
              for (const se of fs.readdirSync(fp, { withFileTypes: true })) {
                if (se.isFile() && se.name.endsWith(".asy")) {
                  indexFile(path.join(fp, se.name));
                }
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }
  }
}

function indexFile(fp: string): void {
  try {
    const stat = fs.statSync(fp);
    const cached = structIndexCache.get(fp);
    if (cached === stat.mtimeMs) return;
    structIndexCache.set(fp, stat.mtimeMs);
    const content = fs.readFileSync(fp, "utf-8");
    const structs = parseStructBodies(content);
    for (const [name, members] of structs) {
      if (!structIndex.has(name) || members.length > 0) {
        structIndex.set(name, members);
      }
    }
  } catch { /* skip */ }
}

function resolveVariableType(document: TextDocument, varName: string): string | null {
  const text = document.getText();
  const escaped = escapeRegex(varName);
  const regex = new RegExp(
    "(?:^|;|\\{|\\})\\s*" +
    "((?:public|private|restricted|static|explicit|autounravel)\\s+)*" +
    "([A-Za-z_][A-Za-z0-9_]*(?:\\s+[A-Za-z_][A-Za-z0-9_]*)*)\\s+" +
    "(" + escaped + ")\\b",
    "gm"
  );
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const t = m[2];
    if (t && t !== "for" && t !== "while" && t !== "if" && t !== "else" && t !== "return") {
      return t;
    }
  }
  return null;
}

function getStructMembers(typeName: string): StructMember[] {
  const builtins: Record<string, StructMember[]> = {
    pair: [{name:"x",type:"real"},{name:"y",type:"real"}],
    triple: [{name:"x",type:"real"},{name:"y",type:"real"},{name:"z",type:"real"}],
    transform: [{name:"x",type:"real"},{name:"y",type:"real"},
      {name:"xx",type:"real"},{name:"xy",type:"real"},{name:"yx",type:"real"},{name:"yy",type:"real"}],
  };
  if (builtins[typeName]) return builtins[typeName];
  return structIndex.get(typeName) || [];
}

// ========== HELPER FUNCTIONS ==========

function getLineText(document: TextDocument, line: number): string {
  const text = document.getText();
  const lines = text.split("\n");
  return document.getText({
    start: Position.create(line, 0),
    end: Position.create(line, lines[line]?.length || 0),
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
  _charBefore: string
): boolean {
  const trimmed = lineText.trimStart();
  if (/^\/\//.test(trimmed)) return false;
  return true;
}

// Pre-built static completion items (never change — built once at startup)
let cachedStaticCompletions: CompletionItem[] | null = null;
const controlFlowLabelSet = new Set(controlFlowKeywords.map((k) => k.label));

function getStaticCompletions(): CompletionItem[] {
  if (cachedStaticCompletions) return cachedStaticCompletions;

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

  // Other keywords (skip ones already covered by controlFlowKeywords)
  for (const kw of keywords) {
    if (!controlFlowLabelSet.has(kw)) {
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

  cachedStaticCompletions = items;
  return items;
}

const localSymbolCache = new Map<string, { version: number; items: CompletionItem[] }>();
const importedSymbolCache = new Map<string, { version: number; items: CompletionItem[] }>();

function getAllCompletions(document: TextDocument): CompletionItem[] {
  const staticItems = getStaticCompletions();
  const docKey = document.uri;
  const docVersion = document.version;

  const localCached = localSymbolCache.get(docKey);
  let localItems: CompletionItem[];
  if (localCached && localCached.version === docVersion) {
    localItems = localCached.items;
  } else {
    localItems = getLocalSymbolCompletions(document);
    localSymbolCache.set(docKey, { version: docVersion, items: localItems });
  }

  const importCached = importedSymbolCache.get(docKey);
  let importedItems: CompletionItem[];
  if (importCached && importCached.version === docVersion) {
    connection.console.log(`[getAllCompletions] import cache HIT (version=${docVersion})`);
    importedItems = importCached.items;
  } else {
    connection.console.log(`[getAllCompletions] import cache MISS (version=${docVersion}), calling getImportedSymbolCompletions`);
    importedItems = getImportedSymbolCompletions(document);
    importedSymbolCache.set(docKey, { version: docVersion, items: importedItems });
  }

  const result = staticItems.concat(localItems).concat(importedItems);
  connection.console.log(`[getAllCompletions] total items: static=${staticItems.length} local=${localItems.length} imported=${importedItems.length} → ${result.length}`);
  return result;
}

function getMemberCompletions(document: TextDocument, text: string, offset: number): CompletionItem[] {
  const dotPos = text.lastIndexOf(".", offset - 1);
  if (dotPos === -1) return [];
  const beforeDot = text.substring(0, dotPos);
  const wordMatch = beforeDot.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
  if (!wordMatch) return [];
  const objName = wordMatch[1];

  if (typeMemberMap[objName]) {
    return typeMemberMap[objName].map((m) => ({
      label: m.label,
      kind: CompletionItemKind.Method,
      detail: m.detail,
    }));
  }

  if (builtinTypes.find((t) => t.label === objName)) return [];

  buildStructIndex(document);
  const varType = resolveVariableType(document, objName);
  connection.console.log(`[completion] dot obj=${objName} varType=${varType || "null"} structIdxHas_obj=${structIndex.has(objName)} structIdxHas_type=${structIndex.has(varType || "")} structIdxSize=${structIndex.size}`);
  if (varType) {
    const members = getStructMembers(varType);
    connection.console.log(`[dot] type=${varType} members=${members.length} names=[${members.map(m=>m.name).join(",")}]`);
    if (members.length > 0) {
      return members.map((m) => ({
        label: m.name,
        kind: CompletionItemKind.Field,
        detail: `${m.name}: ${m.type}`,
      }));
    }
  }

  const structMembers = getStructMembers(objName);
  if (structMembers.length > 0) {
    return structMembers.map((m) => ({
      label: m.name,
      kind: CompletionItemKind.Field,
      detail: `${m.name}: ${m.type}`,
    }));
  }

  if (objName.endsWith("[]") || objName.toLowerCase().includes("array") || objName.toLowerCase().includes("list")) {
    return arrayMembers.map((m) => ({ label: m.label, kind: CompletionItemKind.Method, detail: m.detail }));
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
    `\\b(${builtinTypes.map((t) => t.label).join("|")}|[A-Za-z_][A-Za-z0-9_]*(?:\\s+[A-Za-z_][A-Za-z0-9_]*)?)(?:\\[\\])?\\s+(${escapeRegex(word)})\\b`,
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

  connection.console.log(`[resolveModule] searching "${moduleName}" in searchPath=[${searchPath.join(", ")}]`);
  connection.console.log(`[resolveModule] candidates=[${candidates.join(", ")}]`);

  for (const dir of searchPath) {
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (fs.existsSync(fullPath)) {
        connection.console.log(`[resolveModule] FOUND: ${fullPath}`);
        return fullPath;
      }
    }
  }

  connection.console.log(`[resolveModule] NOT FOUND: "${moduleName}"`);
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
    `\\b([A-Za-z_][A-Za-z0-9_]*(?:\\s+[A-Za-z_][A-Za-z0-9_]*)?)(?:\\[\\])?\\s+(${escaped})\\b`,
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
  if (modulePath) {
    const results = findSymbolInFile(modulePath, symbolName);
    if (results.length > 0) return results;
  }

  buildStructIndex(document);
  const varType = resolveVariableType(document, objectName);
  if (varType) {
    const members = getStructMembers(varType);
    if (members.some((m) => m.name === symbolName)) {
      const importPath = resolveModuleFile(varType, document);
      if (importPath) {
        const results = findSymbolInFile(importPath, symbolName);
        if (results.length > 0) return results;
      }
    }
  }

  const directMembers = getStructMembers(objectName);
  if (directMembers.some((m) => m.name === symbolName)) {
    const importPath = resolveModuleFile(objectName, document);
    if (importPath) {
      const results = findSymbolInFile(importPath, symbolName);
      if (results.length > 0) return results;
    }
  }

  return null;
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

function expandPath(raw: string): string {
  let expanded = raw.replace(/^~(?=$|\/|\\)/g, os.homedir());
  expanded = expanded.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || "");
  expanded = expanded.replace(/\$(\w+)/g, (_, name) => process.env[name] || "");
  return path.resolve(expanded);
}

let cachedSystemLibraryPath: string | null | undefined = undefined;

function discoverAsyLibViaKpsewhich(): string | null {
  try {
    const texmfdist = execSync("kpsewhich -var-value=TEXMFDIST", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (!texmfdist) return null;
    const asyPath = path.join(texmfdist, "asymptote");
    if (fs.existsSync(asyPath)) {
      connection.console.log(`[discoverAsyLib] kpsewhich → ${asyPath}`);
      return asyPath;
    }
  } catch {
    connection.console.log("[discoverAsyLib] kpsewhich unavailable");
  }
  return null;
}

function discoverAsyLibViaTexliveScan(): string | null {
  const texliveBase = "/usr/local/texlive";
  if (!fs.existsSync(texliveBase)) return null;
  try {
    const years = fs.readdirSync(texliveBase, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
      .reverse();
    for (const year of years) {
      const candidate = path.join(texliveBase, year, "texmf-dist", "asymptote");
      if (fs.existsSync(candidate)) {
        connection.console.log(`[discoverAsyLib] texlive scan → ${candidate}`);
        return candidate;
      }
    }
  } catch {
    connection.console.log("[discoverAsyLib] texlive scan failed");
  }
  return null;
}

function discoverAsyLibViaCommonPaths(): string | null {
  const commonPaths = [
    "/opt/homebrew/share/texmf-dist/asymptote",
    "/usr/local/share/texmf-dist/asymptote",
    "/usr/share/texmf-dist/asymptote",
    "/usr/share/texlive/texmf-dist/asymptote",
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      connection.console.log(`[discoverAsyLib] common path → ${p}`);
      return p;
    }
  }
  return null;
}

function getSystemLibraryPath(): string | null {
  if (cachedSystemLibraryPath !== undefined) return cachedSystemLibraryPath;

  cachedSystemLibraryPath =
    discoverAsyLibViaKpsewhich() ??
    discoverAsyLibViaTexliveScan() ??
    discoverAsyLibViaCommonPaths();

  if (!cachedSystemLibraryPath) {
    connection.console.log("[discoverAsyLib] system library not found");
  }
  return cachedSystemLibraryPath;
}

function buildSearchPath(document: TextDocument): string[] {
  const paths: string[] = [];

  for (const ws of workspaceFolders) {
    paths.push(ws);
  }

  for (const sp of globalSettings.searchPaths) {
    paths.push(expandPath(sp));
  }

  const sysLib = getSystemLibraryPath();
  if (sysLib) {
    paths.push(sysLib);
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

function getLocalSymbolCompletions(document: TextDocument): CompletionItem[] {
  connection.console.log("[completion] getLocalSymbolCompletions called");
  const text = document.getText();
  const seen = new Set(keywords);
  for (const t of builtinTypes) seen.add(t.label);
  for (const f of builtinFunctions) seen.add(f.label);
  for (const c of constants) seen.add(c.label);

  const items: CompletionItem[] = [];
  const declRegex = /\b([A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)(?:\[\])?(?:\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:;|=|\s*\()/g;
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(text)) !== null) {
    const name = m[2];
    if (seen.has(name)) continue;
    seen.add(name);
    const hasParams = text[m.index + m[0].length - 1] === '(';
    items.push({
      label: name,
      kind: hasParams ? CompletionItemKind.Function : CompletionItemKind.Variable,
    });
  }
  return items;
}

function extractModuleDeclarations(content: string, seen: Set<string>): CompletionItem[] {
  const items: CompletionItem[] = [];

  const structRegex = /struct\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = structRegex.exec(content)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      items.push({ label: name, kind: CompletionItemKind.Struct });
    }
  }

  const declRegex = /\b([A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)(?:\[\])?(?:\s+[A-Za-z_][A-Za-z0-9_]*(?:\s+[A-Za-z_][A-Za-z0-9_]*)?)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:;|=|\s*\()/g;
  while ((m = declRegex.exec(content)) !== null) {
    const name = m[2];
    if (seen.has(name)) continue;
    seen.add(name);
    const hasParams = content[m.index + m[0].length - 1] === '(';
    items.push({
      label: name,
      kind: hasParams ? CompletionItemKind.Function : CompletionItemKind.Variable,
    });
  }

  return items;
}

function getImportedSymbolCompletions(document: TextDocument): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  for (const kw of keywords) seen.add(kw);
  for (const t of builtinTypes) seen.add(t.label);
  for (const f of builtinFunctions) seen.add(f.label);
  for (const c of constants) seen.add(c.label);

  const importedModules = getDocumentImports(document);
  connection.console.log(`[import-completion] imports detected: [${importedModules.join(", ")}]`);

  for (const moduleName of importedModules) {
    connection.console.log(`[import-completion] processing module: "${moduleName}"`);

    const stdModule = standardLibraryModules.find(m => m.name === moduleName);
    if (stdModule && stdModule.exports) {
      connection.console.log(`[import-completion]   → stdlib exports: [${stdModule.exports.join(", ")}]`);
      let added = 0;
      for (const exp of stdModule.exports) {
        if (!seen.has(exp)) {
          seen.add(exp);
          items.push({
            label: exp,
            kind: CompletionItemKind.Function,
            detail: `${moduleName} module`,
          });
          added++;
        }
      }
      connection.console.log(`[import-completion]   → added ${added} new symbols from exports`);
      continue;
    }

    const moduleFile = resolveModuleFile(moduleName, document);
    if (!moduleFile) {
      connection.console.log(`[import-completion]   → resolveModuleFile returned null (file not found)`);
      continue;
    }
    connection.console.log(`[import-completion]   → resolved file: ${moduleFile}`);

    try {
      const content = fs.readFileSync(moduleFile, "utf-8");
      connection.console.log(`[import-completion]   → file size: ${content.length} chars`);
      const decls = extractModuleDeclarations(content, seen);
      connection.console.log(`[import-completion]   → extractModuleDeclarations returned ${decls.length} items: [${decls.map(d=>d.label).slice(0,20).join(", ")}${decls.length > 20 ? ", ..." : ""}]`);
      for (const d of decls) {
        d.detail = `${moduleName} module`;
        items.push(d);
      }
      connection.console.log(`[import-completion]   → added ${decls.length} symbols`);
    } catch (e: unknown) {
      connection.console.log(`[import-completion]   → read/parse error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  connection.console.log(`[import-completion] total imported symbols: ${items.length}`);
  return items;
}

