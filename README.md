# Prompt Cost

See how many tokens a prompt will use, and what it will cost, before you send it.

Prompt Cost is a VS Code and Cursor sidebar. You pick a model, type or paste a prompt, and get a local token count and a list-price estimate. Attach a document, image, video, or audio file when the prompt depends on one. Compare two versions when you are trying to make a prompt shorter or cheaper.

Counts run on your machine. An API key is not required.

## Use it

1. Open **Prompt Cost** from the activity bar.
2. Choose a provider and a model.
3. Type a prompt, paste one, or attach files. Files stay on this machine.
4. Click **Cost** for tokens, price, and size.
5. Click **Compare with another prompt**, add a second version, then click **Compare**.

**Analyze Current Document** and **Analyze Selected Text** copy the open file or the selection into the prompt. The status bar shows the same sidebar count.

The count is the prompt you typed and the files you attached. A chat assistant also adds system instructions, rules, and tool definitions. Include that text in the prompt when you want it in the count.

Changing the model recounts an open comparison. While the comparison charts are open, the single-prompt cost charts stay hidden.

## What the numbers mean

Each result is labeled:

- **Exact local tokenizer** uses that model's vocabulary on this machine.
- **Approximate** is an estimate. The badge says why.
- **Provider API count** is an optional Anthropic or Gemini count. You turn it on, store a key, and confirm each send.

Prices are public list prices. They leave out cache discounts, batch rates, and separate media rates. Images, audio, video, and unparsed documents use the provider's published size rules and are priced like text input. Output cost assumes the completion length in settings, because the prompt does not decide how long the reply will be. A model with no official price stays at zero until you set a rate.

Claude 4.7 and later can use more tokens than the local Claude count. Use the provider API count when that difference matters.

## Privacy

Tokenizers run locally and do not use the network. Prompt text is not saved to extension state, logs, or the secret store. API keys stay in the editor secret store and are not shown in the sidebar. Provider API counting is off until you enable it and confirm a send.

## Commands

| Command | What it does |
| --- | --- |
| Analyze Current Document | Copy the open file into the prompt. |
| Analyze Selected Text | Copy the selection into the prompt. |
| Open Prompt Cost | Open the sidebar. |
| Compare Prompts | Open the comparison. |
| Count Tokens with Provider API | Send the current text to Anthropic or Gemini after you confirm. |
| Store Provider API Key | Save a key in the secret store. |
| Clear Provider API Key | Delete a stored key. |
| Configure MCP Server | Copy the local MCP config, or write it into this workspace. |

## Settings

| Setting | Default | What it changes |
| --- | --- | --- |
| `promptCost.defaultProvider` | `openai` | Provider used before you pick one in the sidebar. |
| `promptCost.defaultModel` | `gpt-5.4` | Model used before you pick one in the sidebar. |
| `promptCost.statusBar.enabled` | `true` | Show the count in the status bar. |
| `promptCost.expectedOutputTokens` | `1024` | Completion length used for the output cost. |
| `promptCost.maxCharacters` | `1000000` | Skip longer text so the editor stays responsive. |
| `promptCost.debounceMs` | `200` | Wait after a keystroke before recounting. |
| `promptCost.apiCounting.enabled` | `false` | Allow an explicit provider API count. |

## MCP

Prompt Cost can run a local MCP server so an agent can count tokens, estimate cost, compare two texts, list models, or measure tool definitions. The server does not listen on a port, does not call a model provider, and does not store the text it receives.

Run **Prompt Cost: Configure MCP Server** to add it to the workspace. The tools are `count_tokens`, `estimate_cost`, `compare_prompts`, `list_models`, and `estimate_tool_definitions`.

## Develop

Node.js 20 or newer.

```bash
npm install
npm test
npm run check
npm run compile
```

Press F5 and choose **Run Prompt Cost**. In the new window, open Prompt Cost from the activity bar.

`npm run package` builds a VSIX. Install it from the Extensions view with **Install from VSIX**.

## License

MIT. See [LICENSE](LICENSE).
