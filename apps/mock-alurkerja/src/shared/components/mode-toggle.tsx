import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nemu/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "next-themes";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-nemu-id={NEMU_IDS.shell.themeMenu}
        aria-label="Ganti tema"
        render={<Button variant="outline" size="icon" />}
      >
        <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          data-nemu-id={NEMU_IDS.shell.themeLight}
          onClick={() => setTheme("light")}
        >
          Terang
        </DropdownMenuItem>
        <DropdownMenuItem data-nemu-id={NEMU_IDS.shell.themeDark} onClick={() => setTheme("dark")}>
          Gelap
        </DropdownMenuItem>
        <DropdownMenuItem
          data-nemu-id={NEMU_IDS.shell.themeSystem}
          onClick={() => setTheme("system")}
        >
          Ikuti sistem
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
