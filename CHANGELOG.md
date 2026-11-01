# Changelog

## 1.0.5

- Changing the model while a comparison is open recounts both prompts.

## 1.0.4

- Opening Compare hides the current prompt’s cost charts. Cost brings them back.

## 1.0.3

- The sidebar opens on the provider, model, and prompt. The repeated title and the “Prompt” label are gone.

## 1.0.2

- During a comparison, the prompt boxes use the same blue and orange as the charts.
- Chart titles have a colored mark beside the name.

## 1.0.1

- Comparison labels are Current prompt and Compared prompt.
- Chart sections start open and can be collapsed.
- The activity bar icon is a coin with a prompt mark.

## 1.0.0

- First major release. The sidebar is a prompt composer with file attachments, cost charts, and a separate comparison.

## 0.4.3

- Cost charts use the sidebar width. Numbers, bars, and the size grid stay readable when the panel is resized.

## 0.4.2

- Version increment.

## 0.4.1

- The sidebar keeps the prompt composer and a second composer for comparison.
- Cost opens charts for tokens, price, size, text mix, and the two prompts.

## 0.4.0

- The prompt box accepts documents, images, video, and audio by attach, drop, or paste. The files stay on this machine.
- Text documents are counted with the model tokenizer. Images, audio, video, and unparsed documents use the provider's published size rules.

## 0.3.1

- Document and Selection read the open editor tab when the sidebar has focus.

## 0.3.0

- The sidebar is a single prompt. Document and Selection fill that prompt, and a second prompt is optional.
- Document and Selection keep working after the sidebar takes focus.
- The visible name is Prompt Cost.

## 0.2.0

- Local MCP server with tools for token counts, cost estimates, prompt comparison, the model catalog, and tool-definition size.
- VS Code and Cursor can start the server from the extension. **Prompt Cost: Configure MCP Server** copies or writes the config.

## 0.1.0

Initial release.

- Local token counts for OpenAI, Anthropic, Gemini, Llama, Mistral, and DeepSeek.
- Status bar, sidebar dashboard, prompt comparison, and cost estimate.
- Optional Anthropic and Gemini API counts after an explicit confirmation.
