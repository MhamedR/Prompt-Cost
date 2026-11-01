# Prompt Cost

A VS Code extension that estimates token counts and API cost for the text in your editor. It also runs in Cursor anywhere the same extension APIs are available: commands, the status bar, webviews, settings, and the secret store.

Counts run on your machine. An API key is not required. Editor text is sent to a provider only after you turn on API counting and confirm a send.

## What it counts

The extension counts the prompt in the sidebar, including files you attach there. Use Document or Selection to copy the open file or the current selection into that prompt. It does not reconstruct the prompt Cursor, Copilot, or another assistant actually sends. That prompt can include system instructions, rules, tool definitions, and chat framing. Those stay outside this count unless you include them.

Accuracy is labeled on every result:

| Label | Meaning |
| --- | --- |
| Exact local tokenizer | The provider's own vocabulary, running locally. Chat templates and special tokens are not added. |
| Approximate | A provider-specific estimate, or a real tokenizer from an older model in the same family. The compatibility line says which. |
| Provider API count | Anthropic `count_tokens` or Gemini `countTokens`, after an explicit send. |

OpenAI counts use `gpt-tokenizer` (`o200k_base` or `cl100k_base`, chosen per model). Claude counts use the Claude encoding in `ai-tokenizer`, not `@anthropic-ai/tokenizer`, which does not match Claude 3 or later. Llama 3 uses `llama3-tokenizer-js`. Llama 4 does not reuse that vocabulary. Mistral uses `mistral-tokenizer-ts`. DeepSeek V3 and R1 use `@cyberlangke/tokkit-deepseek`. DeepSeek V4 and Gemini do not have a small local vocabulary in this extension, so they use separate estimates.

Claude 4.7 and later, including Fable and the 5.x models, use a newer tokenizer. Anthropic says it produces about 30% more tokens than earlier models. The local Claude count can under-count those models. Use the API count when the difference matters.

Prices are list prices recorded in `src/models/`. They leave out cache discounts, batch rates, and tool calls. Attached images, audio, video, and unparsed documents are added with the provider's published size rules and priced at the text input rate. A provider that bills those modalities separately can charge a different amount. Open-weight models with no official API price start at zero until you enter the host rate. Output cost uses the expected output length you set, because a prompt does not determine the completion length.

## Features

- Type a prompt, or attach a document, image, video, or audio file. Files stay in the sidebar and are not uploaded.
- Compare with another prompt uses the same composer, including attachments.
- Compare opens charts for the two prompts: token counts, the difference, and input cost.
- Commands and editor context menu actions.
- Optional Anthropic and Gemini API counts. Keys stay in the VS Code secret store.
- Local MCP server for token counts, cost estimates, prompt comparison, and tool-definition size.

## Commands

| Command | Action |
| --- | --- |
| Prompt Cost: Analyze Current Document | Copy the open document into the prompt and show its metrics. |
| Prompt Cost: Analyze Selected Text | Copy the selection into the prompt and show its metrics. |
| Prompt Cost: Open Prompt Cost | Focus the sidebar. |
| Prompt Cost: Compare Prompts | Focus the comparison section. |
| Prompt Cost: Count Tokens with Provider API | Confirm, then send the current text to Anthropic or Gemini. |
| Prompt Cost: Store Provider API Key | Save a key in the secret store. |
| Prompt Cost: Clear Provider API Key | Delete a stored key. |
| Prompt Cost: Configure MCP Server | Copy the local MCP config, or add it to this workspace. |

## MCP

Prompt Cost includes a local stdio MCP server. VS Code and Cursor start it from the extension when the host supports MCP server providers. The server does not listen on a port, does not call a model provider, and does not store the text a tool receives.

Tools:

| Tool | Result |
| --- | --- |
| `count_tokens` | Token count, tokenizer, and accuracy for one model. |
| `estimate_cost` | Input count plus input, output, and total list-price cost. |
| `compare_prompts` | Token difference between two texts. |
| `list_models` | Catalog models, accuracy, and the first price tier. |
| `estimate_tool_definitions` | Tokens in a JSON document of tool names, descriptions, and input schemas. |

`estimate_tool_definitions` does not connect to other MCP servers. Pass the definitions you want measured. The count leaves out the provider's tool-calling wrapper, so a live request can be larger.

Run **Prompt Cost: Configure MCP Server** to copy a Cursor or VS Code snippet, or to write `.cursor/mcp.json` and `.vscode/mcp.json` in the open workspace. Those files point at this machine's extension install. Hosts that discover `promptCost.servers` do not need the files.

The same accuracy labels apply. A tool result is the text you passed in, not the full prompt an assistant sends.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `promptCost.defaultProvider` | `openai` | Provider used before the sidebar choice is saved. |
| `promptCost.defaultModel` | `gpt-5.4` | Model used before the sidebar choice is saved. |
| `promptCost.statusBar.enabled` | `true` | Show the status bar item. |
| `promptCost.statusBar.source` | `auto` | `auto`, `document`, or `selection`. |
| `promptCost.expectedOutputTokens` | `1024` | Completion length assumed by the cost estimate. |
| `promptCost.maxCharacters` | `1000000` | Skip longer text so the editor stays responsive. |
| `promptCost.debounceMs` | `200` | Wait after a keystroke before recounting. |
| `promptCost.apiCounting.enabled` | `false` | Allow an explicit provider API count. |

The extension does not change document contents.

## Architecture

```
src/
  extension.ts                 activation
  controller.ts                commands, editor listeners, webview messages
  constants.ts
  types.ts                     TokenizerProvider and shared types
  models/                      one catalog file per provider, plus pricing helpers
  pricing/calculator.ts        tier selection and cost
  analysis/                    stats, comparison, distribution
  tokenization/
    registry.ts                loads a provider bundle on demand
    providers/                 one tokenizer module per provider
  api/providerApi.ts           explicit Anthropic and Gemini counts
  mcp/                         local MCP server and editor registration
  secrets/apiKeys.ts
  statusBar/ sidebar/ webview/
  webview-ui/                  React dashboard
```

`TokenizerProvider` is the only counting entry point:

```ts
interface TokenizerProvider {
  countTokens(text: string, model: string): Promise<TokenCountResult>;
}
```

`TokenCountResult` carries the count, the accuracy label, the tokenizer name, and warnings. Pricing, commands, and the webview do not know how a provider tokenizes.

Provider bundles are separate so the extension host does not parse every vocabulary at startup. Mistral and DeepSeek read vocabulary files from disk, so those packages are copied to `dist/node_modules` instead of being inlined.

## Privacy

- Local tokenizers are the default and do not use the network.
- Document text is not written to extension state, logs, or the secret store.
- Comparison drafts stay in the webview until it is disposed. They are not saved.
- API keys are stored with `ExtensionContext.secrets` and are not shown in the webview.
- `promptCost.apiCounting.enabled` defaults to off.
- A provider request also requires a confirmation dialog that states how many characters will be sent.
- The extension does not run a backend. The MCP server is a local process started by the editor.

## Development

Requirements: Node.js 20 or newer, and VS Code or Cursor.

```bash
npm install
npm test
npm run check
npm run compile
```

Run it in the Extension Development Host:

1. Open this folder in VS Code or Cursor.
2. Press F5, or run the launch configuration **Run Prompt Cost**.
3. The first launch starts the `npm: watch` build.
4. In the new window, open a text file. The status bar shows a token count. The Prompt Cost icon in the activity bar opens the dashboard.

Cursor uses the same launch flow when the workspace is opened in Cursor. To try a packaged build in Cursor, install the VSIX from the Extensions view with **Install from VSIX**.

## Package a VSIX

```bash
npm install
npm run package
```

`npm run package` compiles and runs `vsce package`. The publisher in `package.json` is `prompt-cost`. Change `publisher` to your marketplace publisher id before you publish. Local packaging does not require that publisher to exist.

The VSIX includes `dist/`, including the Mistral and DeepSeek vocabularies under `dist/node_modules`. Install it with **Extensions: Install from VSIX** in VS Code or Cursor.

## Publish to the VS Code Marketplace

1. Create a publisher at https://marketplace.visualstudio.com/manage and set the same id in `package.json`.
2. Create a Personal Access Token with Marketplace: Manage scope.
3. Log in and publish:

```bash
npx vsce login <publisher>
npm run publish:marketplace
```

You can also upload the `.vsix` from the marketplace management page. The extension manifest already sets `engines.vscode`, an icon, categories, and the commands the marketplace lists.

## Publish to Open VSX

Open VSX is the registry Eclipse Theia and some Cursor setups use. Create a namespace at https://open-vsx.org and create an access token.

```bash
npx ovsx create-namespace <publisher>
npx ovsx publish --no-dependencies -p <token>
```

`npm run publish:openvsx` runs `ovsx publish --no-dependencies`. The namespace must match the `publisher` field. Publishing here does not replace a Marketplace publish. Do both if you want the extension in both registries.

## Tests

`npm test` runs Vitest. The tests cover cost tiers, comparison math, the three local estimates, catalog integrity, and real tokenizer counts for each provider, including the fact that OpenAI's two encodings and the other providers do not return the same count for the same text.

## License

MIT. See [LICENSE](LICENSE).
