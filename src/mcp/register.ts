import * as path from "node:path";
import * as vscode from "vscode";

const SERVER_ID = "prompt-cost";

export function registerPromptCostMcpServer(context: vscode.ExtensionContext): vscode.Disposable | undefined {
  if (typeof vscode.lm.registerMcpServerDefinitionProvider !== "function") {
    return undefined;
  }
  const script = mcpScript(context);
  const version = extensionVersion(context);
  return vscode.lm.registerMcpServerDefinitionProvider("promptCost.servers", {
    provideMcpServerDefinitions: () => [
      new vscode.McpStdioServerDefinition("Prompt Cost", process.execPath, [script], mcpEnvironment(context), version),
    ],
  });
}

export async function showMcpSetup(context: vscode.ExtensionContext): Promise<void> {
  const script = mcpScript(context);
  const entry = { type: "stdio", command: process.execPath, args: [script] };
  const cursorEntry = { command: process.execPath, args: [script] };
  const choice = await vscode.window.showInformationMessage(
    "Prompt Cost MCP counts tokens in a local process. Text passed to its tools is not stored or sent to a model provider.",
    "Copy Cursor config",
    "Copy VS Code config",
    "Add to this workspace",
  );
  if (choice === "Copy Cursor config") {
    await vscode.env.clipboard.writeText(JSON.stringify({ mcpServers: { [SERVER_ID]: cursorEntry } }, null, 2));
    void vscode.window.showInformationMessage("Cursor MCP config copied. Paste it into ~/.cursor/mcp.json or .cursor/mcp.json.");
    return;
  }
  if (choice === "Copy VS Code config") {
    await vscode.env.clipboard.writeText(JSON.stringify({ servers: { [SERVER_ID]: entry } }, null, 2));
    void vscode.window.showInformationMessage("VS Code MCP config copied. Paste it into .vscode/mcp.json.");
    return;
  }
  if (choice !== "Add to this workspace") {
    return;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showErrorMessage("Open a folder before adding the Prompt Cost MCP config.");
    return;
  }
  const vscodeFile = vscode.Uri.joinPath(folder.uri, ".vscode", "mcp.json");
  const cursorFile = vscode.Uri.joinPath(folder.uri, ".cursor", "mcp.json");
  await writeServerEntry(vscodeFile, "servers", entry);
  await writeServerEntry(cursorFile, "mcpServers", cursorEntry);
  void vscode.window.showInformationMessage(`Added Prompt Cost to ${vscodeFile.fsPath} and ${cursorFile.fsPath}.`);
}

function mcpScript(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, "dist", "mcp.js");
}

function extensionVersion(context: vscode.ExtensionContext): string {
  const version = context.extension.packageJSON.version;
  return typeof version === "string" ? version : "0.0.0";
}

function mcpEnvironment(context: vscode.ExtensionContext): Record<string, string> {
  return {
    PROMPT_COST_EXTENSION_ROOT: context.extensionPath,
    PROMPT_COST_MAX_CHARACTERS: maxCharactersFromSettings(),
  };
}

function maxCharactersFromSettings(): string {
  const value = vscode.workspace.getConfiguration("promptCost").get<number>("maxCharacters");
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1000) {
    return "1000000";
  }
  return String(Math.floor(value));
}

async function writeServerEntry(
  uri: vscode.Uri,
  section: "servers" | "mcpServers",
  entry: { command: string; args: string[]; type?: string },
): Promise<void> {
  const current = await readJsonObject(uri);
  const existing = current[section];
  const servers = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};
  servers[SERVER_ID] = entry;
  current[section] = servers;
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(`${JSON.stringify(current, null, 2)}\n`));
}

async function readJsonObject(uri: vscode.Uri): Promise<Record<string, unknown>> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${uri.fsPath} is not a JSON object. Prompt Cost left it unchanged.`);
    }
    return { ...(parsed as Record<string, unknown>) };
  } catch (error) {
    if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
      return {};
    }
    throw error;
  }
}
