import { createRequire } from "node:module";
import * as path from "node:path";
import type { ProviderId, TokenizerProvider } from "../types";
import { isProviderId } from "../types";

const require = createRequire(__filename);
const cache = new Map<ProviderId, TokenizerProvider>();

export function loadProvider(extensionRoot: string, providerId: ProviderId): TokenizerProvider {
  const cached = cache.get(providerId);
  if (cached) {
    return cached;
  }
  if (!isProviderId(providerId)) {
    throw new Error(`Unknown provider "${providerId}".`);
  }
  const file = path.join(extensionRoot, "dist", "providers", `${providerId}.js`);
  const loaded = require(file) as { provider?: TokenizerProvider };
  if (!loaded.provider) {
    throw new Error(`Tokenizer module ${file} did not export a provider.`);
  }
  cache.set(providerId, loaded.provider);
  return loaded.provider;
}
