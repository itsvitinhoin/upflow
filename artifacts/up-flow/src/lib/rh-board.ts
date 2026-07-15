export const RH_BOARD_FIELD_NAME = "RH Status";
export const RH_TASK_TYPE_FIELD_NAME = "RH Task Type";

export const RH_BOARD_COLUMNS = [
  { key: "boas_vindas", label: "BOAS VINDAS", color: "#22c55e" },
  { key: "em_treinamento", label: "EM TREINAMENTO", color: "#7c3aed" },
  { key: "ponto_de_atencao", label: "PONTO DE ATENCAO", color: "#f59e0b" },
  { key: "aniversariantes", label: "ANIVERSARIANTES", color: "#14b8a6" },
  { key: "plano_de_carreira", label: "PLANO DE CARREIRA", color: "#3b82f6" },
  { key: "camila", label: "CAMILA", color: "#eab308" },
  { key: "chilliti", label: "CHILLITI", color: "#10b981" },
  { key: "eric", label: "ERIC", color: "#a855f7" },
  { key: "fabricio", label: "FABRICIO", color: "#60a5fa" },
  { key: "gabriel", label: "GABRIEL", color: "#a16207" },
  { key: "gabriela", label: "GABRIELA", color: "#ef4444" },
  { key: "hugo", label: "HUGO", color: "#eab308" },
  { key: "isabella", label: "ISABELLA", color: "#6b7280" },
  { key: "johnny", label: "JOHNNY", color: "#6366f1" },
  { key: "josef", label: "JOSEF", color: "#ca8a04" },
  { key: "julia", label: "JULIA", color: "#2dd4bf" },
  { key: "larissa", label: "LARISSA", color: "#8b5cf6" },
  { key: "lucas", label: "LUCAS", color: "#71717a" },
  { key: "luiz_almeida", label: "LUIZ ALMEIDA", color: "#f97316" },
  { key: "luka", label: "LUKA", color: "#ec4899" },
  { key: "marcela", label: "MARCELA", color: "#34d399" },
  { key: "marcelo", label: "MARCELO", color: "#a78bfa" },
  { key: "murillo", label: "MURILLO", color: "#3b82f6" },
  { key: "pedro", label: "PEDRO", color: "#fb923c" },
  { key: "santiago", label: "SANTIAGO", color: "#ca8a04" },
  { key: "stefan", label: "STEFAN", color: "#f97316" },
  { key: "thiago", label: "THIAGO", color: "#a855f7" },
  { key: "vinicius", label: "VINICIUS", color: "#71717a" },
  { key: "feedbacks", label: "FEEDBACKS", color: "#f97316" },
  { key: "desligamento", label: "DESLIGAMENTO", color: "#ef4444" },
  { key: "assinatura_do_contrato", label: "ASSINATURA DO CONTRATO", color: "#22c55e" },
] as const;

export const RH_TASK_TYPE_OPTIONS = [
  "Entrada",
  "Aniversario",
  "Contrato",
  "Avaliacao mensal",
  "Ficha cadastral",
  "Promocao",
  "Plano de carreira",
  "Feedback",
  "Desligamento",
  "Assinatura do contrato",
  "Outro",
] as const;

export const RH_BOARD_COLUMN_OPTIONS = RH_BOARD_COLUMNS.map((column) => column.label);

export function getRhBoardColumnColor(label: string, fallback = "#3b82f6") {
  return RH_BOARD_COLUMNS.find((column) => column.label === label)?.color ?? fallback;
}
