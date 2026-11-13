const GENERATED_PROSE = /Литературно:|Что это за дисциплина|Как использовать за столом|добавлен[ао] как игровая справка|не упирались в пустую стену|[МM]ир Тьмы\s*▼|Главное меню|Статусы переводов/i;

export function sourceIntegrityErrors(entry) {
  const errors = [];
  if (!/^https:\/\/wod\.su\//.test(entry.sourceUrl ?? "")) errors.push("missing wod.su source URL");
  const content = [entry.description, entry.system, entry.systemText, entry.summary,
    entry.chat, entry.ethics, entry.hierarchy, entry.weakness, entry.organization,
    entry.stereotypes, ...Object.values(entry.mechanics ?? {})].join("\n");
  if (GENERATED_PROSE.test(content)) errors.push("invented template or captured website navigation");
  if (entry.audit?.status === "verified" && !["existing-source-text", "local-source-text"].includes(entry.contentMode)) errors.push("non-source content marked verified");
  if (/<a\b[^>]*href=["']https?:\/\/(?:www\.)?wod\.su\//i.test(content)) errors.push("source hyperlink substituted for reference text");
  if (!entry.description?.trim()) errors.push("empty description");
  return errors;
}
