import { ExternalLinkIcon, FolderIcon, LayoutIcon, MegaphoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Resource = { label: string; url: string | null; icon: React.ComponentType<{ className?: string }> };

export function ResourceLinksCard({
  driveFolderUrl,
  landingPageUrl,
  metaAdLibraryUrl,
  linkedInAdLibraryUrl,
}: {
  driveFolderUrl: string | null;
  landingPageUrl: string | null;
  metaAdLibraryUrl: string | null;
  linkedInAdLibraryUrl: string | null;
}) {
  const resources: Resource[] = [
    { label: "Google-Drive-Ordner", url: driveFolderUrl, icon: FolderIcon },
    { label: "Landingpage", url: landingPageUrl, icon: LayoutIcon },
    { label: "Meta-Werbebibliothek", url: metaAdLibraryUrl, icon: MegaphoneIcon },
    { label: "LinkedIn-Werbebibliothek", url: linkedInAdLibraryUrl, icon: MegaphoneIcon },
  ].filter((r) => r.url);

  if (resources.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ressourcen</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {resources.map((resource) => (
          <Button
            key={resource.label}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={resource.url!} target="_blank" rel="noopener noreferrer" />}
          >
            <resource.icon className="size-3.5" />
            {resource.label}
            <ExternalLinkIcon className="size-3" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
