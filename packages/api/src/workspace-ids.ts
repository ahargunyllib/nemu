/** The Knowledge Workspaces Nemu serves. Every workspace check compares against these. */
export const WORKSPACES = {
  travel: "W-TRAVEL",
  telco: "W-TELKO",
} as const;

export type WorkspaceId = (typeof WORKSPACES)[keyof typeof WORKSPACES];

const WORKSPACE_IDS: ReadonlySet<string> = new Set(Object.values(WORKSPACES));

export function isWorkspaceId(value: string): value is WorkspaceId {
  return WORKSPACE_IDS.has(value);
}
