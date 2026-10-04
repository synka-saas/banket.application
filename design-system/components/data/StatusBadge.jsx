import React from "react";

const PRESETS = { active: ["success", "Ativo"], inactive: ["neutral", "Inativo"], pending: ["warning", "Pendente"], error: ["danger", "Erro"], draft: ["neutral", "Rascunho"], sent: ["info", "Enviada"], open: ["accent", "Aberto"] };

export function StatusBadge({ status, tone, children, dot = true, className = "", style }) {
  const p = PRESETS[status] || [];
  const t = tone || p[0] || "neutral";
  const cls = ["bk-badge", t !== "neutral" ? "bk-badge--" + t : "", className].filter(Boolean).join(" ");
  return React.createElement("span", { className: cls, style },
    dot ? React.createElement("span", { className: "bk-badge__dot" }) : null, children || p[1] || status);
}
