"use client";

import { useRouter } from "next/navigation";
import { useAlertStore } from "@/store/alerts";
import { useShallow } from "zustand/react/shallow";
import type { Alert, Bed, Internacao, SurgicalInternacao } from "@/lib/simulation/types";

const STATUS_COLOR: Record<string, string> = {
  "Estável":      "var(--status-stable)",
  "Atenção":      "var(--status-attention)",
  "Risco Elevado":"var(--status-elevated)",
  "Crítico":      "var(--status-critical)",
};

const ALERT_META: Record<string, { icon: string; color: string; label: string }> = {
  "sinal-vital":   { icon: "alert-triangle", color: "var(--status-critical)",  label: "Sinal Vital Crítico"     },
  "medicacao":     { icon: "pill",           color: "var(--status-attention)", label: "Medicação Atrasada"       },
  "alta":          { icon: "home",           color: "var(--accent)",           label: "Previsão de Alta"         },
  "bomba-infusao": { icon: "device-heart-monitor", color: "var(--status-elevated)", label: "Alarme Bomba de Infusão" },
};

function formatElapsed(admittedAt: number): string {
  const totalMin = Math.floor((Date.now() - admittedAt) / 60_000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return min > 0 ? `${h}h ${min}min` : `${h}h`;
  return `${totalMin}min`;
}

function AlertBadge({ alert }: { alert: Alert }) {
  const meta = ALERT_META[alert.type];
  if (!meta) return null;
  return (
    <span
      title={meta.label}
      className="text-xs px-1 rounded animate-pulse select-none inline-flex items-center"
      style={{ background: `${meta.color}28`, color: meta.color }}
    >
      <i className={`ti ti-${meta.icon}`} style={{ fontSize: 11 }} />
    </span>
  );
}

interface Props {
  bed: Bed;
  internacao: Internacao | SurgicalInternacao | null;
}

export function BedCard({ bed, internacao }: Props) {
  const router = useRouter();
  const alerts = useAlertStore(useShallow((s) =>
    internacao ? s.active.filter((a) => a.internacaoId === internacao.id) : []
  ));

  if (!internacao) {
    return (
      <div
        className="rounded-lg p-4 flex flex-col gap-1 min-h-[100px] justify-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{bed.label}</span>
        <span className="text-sm" style={{ color: "var(--muted)" }}>Leito Disponível</span>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[internacao.currentStatus] ?? "var(--muted)";
  const isCritical  = internacao.currentStatus === "Crítico";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/patients/${internacao.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/patients/${internacao.id}`)}
      className={`rounded-lg p-4 flex flex-col gap-2 cursor-pointer select-none hover:bg-white/[0.03] focus-visible:outline-none transition-colors${isCritical ? " sk-crit-pulse" : ""}`}
      style={{
        background: "var(--surface)",
        border: `1px solid ${isCritical ? "rgba(240,62,62,0.7)" : `${statusColor}44`}`,
      }}
    >
      {/* Bed label + badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{bed.label}</span>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {internacao.hasPump && (
            <span
              title="Bomba de Infusão ativa"
              className="text-xs px-1 rounded select-none"
              style={{ background: "rgba(249,115,22,0.16)", color: "var(--status-elevated)" }}
            >
              ⊕
            </span>
          )}
          {alerts.map((a) => <AlertBadge key={a.id} alert={a} />)}
        </div>
      </div>

      {/* Patient info */}
      <div>
        <p className="text-sm font-medium leading-snug truncate">{internacao.patient.name}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {internacao.patient.age} anos&nbsp;·&nbsp;
          {internacao.patient.gender === "M" ? "Masculino" : "Feminino"}&nbsp;·&nbsp;
          {formatElapsed(internacao.patient.admittedAt)}
        </p>
      </div>

      {/* Admission reason */}
      <p className="text-xs leading-tight line-clamp-1" style={{ color: "var(--muted)" }}>
        {internacao.patient.admissionReason}
      </p>

      {/* EWS footer */}
      <div
        className="flex items-center justify-between pt-2 mt-auto"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--muted)" }}>EWS</span>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs tabular-nums"
          style={{
            background: `${statusColor}18`,
            border: `1px solid ${statusColor}55`,
            color: statusColor,
          }}
        >
          {internacao.currentEws}&nbsp;{internacao.currentStatus}
        </span>
      </div>
    </div>
  );
}
