import { Button } from "@nemu/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@nemu/ui/components/command";
import { Kbd } from "@nemu/ui/components/kbd";
import { Skeleton } from "@nemu/ui/components/skeleton";
import { useNavigate } from "@tanstack/react-router";
import { FileTextIcon, ListTreeIcon, SearchIcon, WorkflowIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useWorkspaceSearch } from "@/features/workspace/hooks/use-workspace-search";
import type { SearchGroup, SearchResult } from "@/features/workspace/lib/search-results";

const PLACEHOLDER = "Cari dokumen, alur, atau langkah";
const SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘ K" : "Ctrl K";
const GROUPS: { group: SearchGroup; icon: typeof FileTextIcon }[] = [
  { group: "Dokumen", icon: FileTextIcon },
  { group: "Alur", icon: WorkflowIcon },
  { group: "Langkah", icon: ListTreeIcon },
];

/**
 * The top bar's search: a field-shaped button (or Ctrl/⌘ K) that opens a palette over the school's
 * documents, flows and their steps; picking one opens it.
 */
export default function WorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { results, isPending } = useWorkspaceSearch(open);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const select = (result: SearchResult) => {
    setOpen(false);
    void navigate(result.target);
  };

  return (
    <>
      <Button
        variant="secondary"
        aria-label={PLACEHOLDER}
        className="w-full max-w-90 justify-start font-normal text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon="inline-start" />
        <span className="truncate">{PLACEHOLDER}</span>
        <Kbd className="ml-auto hidden lg:inline-flex">{SHORTCUT}</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Cari di Workspace"
        description={PLACEHOLDER}
      >
        <Command>
          <CommandInput placeholder={PLACEHOLDER} />
          <CommandList>
            {isPending ? (
              <div className="grid gap-2 p-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            ) : (
              <CommandEmpty>Tidak ada dokumen, alur, atau langkah yang cocok.</CommandEmpty>
            )}
            {GROUPS.map(({ group, icon: Icon }) => {
              const items = results.filter((result) => result.group === group);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={group} heading={group}>
                  {items.map((result) => (
                    <CommandItem
                      key={result.value}
                      value={result.value}
                      keywords={[result.label, result.detail]}
                      onSelect={() => select(result)}
                    >
                      <Icon />
                      <span className="truncate">{result.label}</span>
                      <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
                        {result.detail}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
