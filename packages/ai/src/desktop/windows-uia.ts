import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import type { ScreenElement } from "@nemu/contracts/school";

import type { AccessibleText } from "./reader.js";

/**
 * Windows UI Automation through one long-lived PowerShell host (a fresh spawn costs a few hundred
 * ms). Read-only: it reads Name, ControlType, bounds and IsPassword of the foreground window's
 * elements; it never invokes, toggles or sets anything, and it never reads a Value.
 * Chrome and Edge expose web pages to UIA by default from version 138.
 */

export const UIA_SCRIPT = String.raw`
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class NemuWin { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); }
"@
$ErrorActionPreference = "Stop"
$wanted = @("Text","Button","Hyperlink","Edit","ComboBox","CheckBox","RadioButton","MenuItem","TabItem","ListItem","Document","Pane","Window","Group","StatusBar","ToolTip")
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  try {
    $handle = [NemuWin]::GetForegroundWindow()
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
    $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    $items = New-Object System.Collections.ArrayList
    $count = 0
    foreach ($el in $all) {
      if ($count -ge 600) { break }
      $c = $el.Current
      $type = $c.ControlType.ProgrammaticName -replace "ControlType\.", ""
      if ($wanted -notcontains $type) { continue }
      $r = $c.BoundingRectangle
      [void]$items.Add(@{ n = $c.Name; t = $type; p = $c.IsPassword; x = $r.X; y = $r.Y; w = $r.Width; h = $r.Height; off = $c.IsOffscreen })
      $count++
    }
    $out = @{ ok = $true; items = $items } | ConvertTo-Json -Compress -Depth 4
  } catch {
    $out = @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  }
  [Console]::Out.WriteLine($out)
}
`;

type RawItem = {
  n?: string | null;
  t?: string;
  p?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  off?: boolean;
};
type RawReply = { ok: true; items: RawItem[] | RawItem | null } | { ok: false; error: string };

const TEXT_TYPES = new Set(["Text", "StatusBar", "ToolTip", "Document", "Group", "Pane", "Window"]);
const POINTABLE_TYPES = new Set([
  "Button",
  "Hyperlink",
  "Edit",
  "ComboBox",
  "CheckBox",
  "RadioButton",
  "MenuItem",
  "TabItem",
  "ListItem",
]);

/** Pure: one PowerShell reply → texts to read, elements to point at, and whether a password field is present. */
export function parseUiaReply(line: string): AccessibleText | null {
  let reply: RawReply;
  try {
    reply = JSON.parse(line) as RawReply;
  } catch {
    return null;
  }
  if (!reply.ok) return null;
  const items = Array.isArray(reply.items) ? reply.items : reply.items ? [reply.items] : [];
  const texts: string[] = [];
  const elements: ScreenElement[] = [];
  let hasPasswordField = false;
  for (const item of items) {
    if (item.p) hasPasswordField = true;
    if (item.off) continue;
    const name = (item.n ?? "").trim();
    if (!name) continue;
    if (TEXT_TYPES.has(item.t ?? "")) texts.push(name);
    if (POINTABLE_TYPES.has(item.t ?? "")) {
      const finite = [item.x, item.y, item.w, item.h].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      );
      elements.push({
        name,
        controlType: item.t ?? "",
        rect: finite ? { x: item.x!, y: item.y!, width: item.w!, height: item.h! } : null,
      });
    }
  }
  return { url: null, texts, elements, hasPasswordField };
}

export type UiaHost = { read(): Promise<AccessibleText | null>; close(): void };

/** Starts the PowerShell host once; each `read()` asks for one snapshot. Windows only. */
export function startUiaHost(
  options: { timeoutMs?: number; spawnImpl?: typeof spawn } = {},
): UiaHost {
  const spawnImpl = options.spawnImpl ?? spawn;
  const timeoutMs = options.timeoutMs ?? 2_500;
  let child: ChildProcessWithoutNullStreams | null = null;
  let buffer = "";
  const waiting: Array<(line: string | null) => void> = [];

  const ensure = () => {
    if (child && child.exitCode === null) return child;
    child = spawnImpl(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"],
      {
        windowsHide: true,
      },
    ) as ChildProcessWithoutNullStreams;
    buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("{")) waiting.shift()?.(line);
        newline = buffer.indexOf("\n");
      }
    });
    child.on("exit", () => {
      while (waiting.length) waiting.shift()?.(null);
    });
    child.stdin.write(`${UIA_SCRIPT}\n`);
    return child;
  };

  return {
    read() {
      const host = ensure();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const index = waiting.indexOf(done);
          if (index >= 0) waiting.splice(index, 1);
          resolve(null);
        }, timeoutMs);
        function done(line: string | null) {
          clearTimeout(timer);
          resolve(line ? parseUiaReply(line) : null);
        }
        waiting.push(done);
        host.stdin.write("read\n");
      });
    },
    close() {
      child?.stdin.end();
      child?.kill();
      child = null;
    },
  };
}
