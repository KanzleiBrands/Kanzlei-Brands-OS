import Anthropic from "@anthropic-ai/sdk";

/**
 * Zentraler Anthropic-Client. Der im Kanzlei-Brands-Account hinterlegte
 * ANTHROPIC_API_KEY ist organisationsweit angelegt ("Geltungsbereich:
 * Organisation" in der Claude Console), nicht einem bestimmten Workspace
 * zugeordnet - solche Keys lehnt die API mit "This API key is not scoped
 * to a workspace" ab, solange nicht per anthropic-workspace-id-Header
 * angegeben wird, welcher Workspace für den Aufruf gilt. ANTHROPIC_WORKSPACE_ID
 * (Format "wrkspc_...", zu finden in der Claude Console im Workspace selbst)
 * ist optional - ohne sie verhält sich der Client wie zuvor, für Accounts
 * mit einem regulären workspace-gebundenen Key.
 */
export function getAnthropicClient(): Anthropic {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : undefined);
}
