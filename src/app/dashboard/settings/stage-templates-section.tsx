import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewStageTemplateDialog } from "./new-stage-template-dialog";
import { EditStageTemplateDialog } from "./edit-stage-template-dialog";
import { DeleteStageTemplateButton } from "./delete-stage-template-button";
import type { EditableStage } from "./stage-list-editor";

export function StageTemplatesSection({
  templates,
}: {
  templates: { id: string; name: string; stages: EditableStage[] }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statusvorlagen</CardTitle>
        <CardAction>
          <NewStageTemplateDialog existingTemplates={templates} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Diese Vorlagen legen die Status-Spalten fest, mit denen eine neue Kampagne startet. Änderungen wirken sich
          nur auf künftig angelegte Kampagnen aus, nicht rückwirkend.
        </p>
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">{template.name}</p>
              <div className="flex items-center gap-1">
                <EditStageTemplateDialog templateId={template.id} name={template.name} stages={template.stages} />
                <DeleteStageTemplateButton templateId={template.id} templateName={template.name} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {template.stages.map((stage) => (
                <Badge key={stage.name} style={{ backgroundColor: stage.color, color: "white" }}>
                  {stage.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Vorlagen angelegt.</p>}
      </CardContent>
    </Card>
  );
}
