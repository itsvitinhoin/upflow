"use client";

import { TASK_TEMPLATES, type TaskTemplateId, getTaskTemplate } from "@/lib/task-templates";
import { useLanguage } from "@/components/language-provider";

interface TaskTemplateFieldsProps {
  templateId: TaskTemplateId;
  values: Record<string, string>;
  onTemplateChange: (id: TaskTemplateId) => void;
  onValuesChange: (values: Record<string, string>) => void;
}

export default function TaskTemplateFields({
  templateId,
  values,
  onTemplateChange,
  onValuesChange,
}: TaskTemplateFieldsProps) {
  const { t } = useLanguage();
  const template = getTaskTemplate(templateId);
  const templateLabel = localizedTemplateText(t, template.id, "label", template.label);
  const templateDescription = localizedTemplateText(
    t,
    template.id,
    "description",
    template.description,
  );

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            {t("taskTemplate.type")}
          </label>
          <select
            value={templateId}
            onChange={(event) => {
              onTemplateChange(event.target.value as TaskTemplateId);
              onValuesChange({});
            }}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TASK_TEMPLATES.map((item) => (
              <option key={item.id} value={item.id}>
                {localizedTemplateText(t, item.id, "label", item.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 self-end rounded-lg bg-black/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="sr-only">{templateLabel}: </span>
          {templateDescription}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {template.fields.map((field) => (
          <label
            key={field.key}
            className={field.kind === "textarea" ? "block sm:col-span-2" : "block"}
          >
            <span className="mb-1.5 block text-xs font-medium text-foreground">{field.label}</span>
            {field.kind === "textarea" ? (
              <textarea
                rows={2}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  onValuesChange({ ...values, [field.key]: event.target.value })
                }
                placeholder={field.placeholder}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <input
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  onValuesChange({ ...values, [field.key]: event.target.value })
                }
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function localizedTemplateText(
  t: (key: string) => string,
  id: TaskTemplateId,
  field: "label" | "description",
  fallback: string,
) {
  const key = `taskTemplate.${id}.${field}`;
  const value = t(key);
  return value === key ? fallback : value;
}
