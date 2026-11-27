import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { Skeleton } from "@nemu/ui/components/skeleton";
import ReactDOM from "react-dom/client";

import { AllowedSiteList } from "../../features/settings/components/allowed-site-list";
import { InstallCodeForm } from "../../features/settings/components/install-code-form";
import { useInstalledSchool } from "../../features/settings/hooks/use-installed-school";
import { useSitePermissions } from "../../features/settings/hooks/use-site-permissions";
import type { SiteConfig } from "../../shared/lib/extension-storage";

import "./style.css";

const NO_SITES: SiteConfig["allowedSites"] = [];

/** The settings page: the school install code (ADR-0015) and the WS-03 sites (ADR-0016). */
function SettingsPage() {
  const { installed, pending, error, save } = useInstalledSchool();
  const sites = installed?.config?.allowedSites ?? NO_SITES;
  const { granted, grant } = useSitePermissions(sites);

  return (
    <main className="flex min-h-svh flex-col items-center gap-6 bg-muted px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Pengaturan Nemu</CardTitle>
          <CardDescription>
            {installed?.config
              ? `Terpasang untuk ${installed.config.schoolName}.`
              : "Masukkan kode pemasangan sekolah agar Nemu bisa membantu guru."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {installed ? (
            <InstallCodeForm
              initialCode={installed.installCode}
              pending={pending}
              error={error}
              onSave={(code) => void save(code)}
            />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </CardContent>
      </Card>

      {installed?.config && (
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Situs yang diizinkan</CardTitle>
            <CardDescription>
              Tombol Nemu hanya muncul di situs ini. Sekolah mengatur daftarnya di Admin Workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AllowedSiteList sites={sites} granted={granted} onGrant={(site) => void grant(site)} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<SettingsPage />);
