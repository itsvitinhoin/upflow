export function isCommercialDepartmentName(name: string | null | undefined) {
  const normalized = (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return /^(commercial|comercial)(?:\b|\s|[-–—/&])/.test(normalized);
}
