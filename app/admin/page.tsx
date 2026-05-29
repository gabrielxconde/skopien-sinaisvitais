"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useSidebarStore } from "@/store/sidebar";
import { useSimulationStore } from "@/store/simulation";
import { useShallow } from "zustand/react/shallow";
import { useAlertStore } from "@/store/alerts";
import { useAdminStore, ADMIN_TABS } from "@/store/admin";

// ─── static demo data ───────────────────────────────────────────────────────

const PS_DOOR_TIME = [
  { day: "Seg", min: 22 },
  { day: "Ter", min: 31 },
  { day: "Qua", min: 18 },
  { day: "Qui", min: 27 },
  { day: "Sex", min: 35 },
  { day: "Sáb", min: 29 },
  { day: "Dom", min: 24 },
];

const PS_LOS_FAIXA = [
  { faixa: "0–18",  h: 2.1 },
  { faixa: "18–40", h: 3.4 },
  { faixa: "40–60", h: 4.8 },
  { faixa: "60–80", h: 6.2 },
  { faixa: "80+",   h: 8.9 },
];

const PS_BOARDING = Array.from({ length: 24 }, (_, i) => ({
  hora: `${i.toString().padStart(2, "0")}h`,
  boarding: Math.max(0, Math.round(1.5 + Math.sin((i - 14) * 0.4) * 2.2 + (i > 18 ? 1 : 0))),
  livres:   Math.max(0, Math.round(4  - Math.sin((i - 10) * 0.35) * 2)),
}));

const PS_SHIFTS = [
  { turno: "Manhã",     hora: "07:00–13:00", atend: 38, crit: 3, status: "OK"      },
  { turno: "Tarde",     hora: "13:00–19:00", atend: 51, crit: 7, status: "Crítico" },
  { turno: "Noite",     hora: "19:00–01:00", atend: 29, crit: 2, status: "OK"      },
  { turno: "Madrugada", hora: "01:00–07:00", atend: 14, crit: 1, status: "OK"      },
];

const ENF_READMISSAO = [
  { esp: "Clín. Médica",  pct: 8.2  },
  { esp: "Cardiologia",   pct: 12.1 },
  { esp: "Ortopedia",     pct: 4.3  },
  { esp: "Neurologia",    pct: 9.7  },
  { esp: "Pneumologia",   pct: 11.4 },
];

const ENF_GAP_ALTA = [
  { day: "Seg", gap: 1.4 },
  { day: "Ter", gap: 2.1 },
  { day: "Qua", gap: 1.8 },
  { day: "Qui", gap: 2.6 },
  { day: "Sex", gap: 1.2 },
  { day: "Sáb", gap: 1.9 },
  { day: "Dom", gap: 2.3 },
];

// UTI
const UTI_LOS = [
  { day: "Seg", dias: 5.2 },
  { day: "Ter", dias: 6.1 },
  { day: "Qua", dias: 4.8 },
  { day: "Qui", dias: 7.3 },
  { day: "Sex", dias: 6.4 },
  { day: "Sáb", dias: 5.9 },
  { day: "Dom", dias: 6.8 },
];

const UTI_SMR = [
  { day: "Seg", smr: 0.91 },
  { day: "Ter", smr: 0.88 },
  { day: "Qua", smr: 1.02 },
  { day: "Qui", smr: 0.95 },
  { day: "Sex", smr: 0.84 },
  { day: "Sáb", smr: 0.97 },
  { day: "Dom", smr: 0.79 },
];

// CC
const CC_CANCELAMENTOS = [
  { motivo: "Paciente",  n: 12 },
  { motivo: "Cirurgião", n: 8  },
  { motivo: "Anestesia", n: 5  },
  { motivo: "Material",  n: 9  },
  { motivo: "Infecção",  n: 3  },
  { motivo: "Outros",    n: 4  },
];

const CC_OCUPACAO_TURNO = [
  { day: "Seg", manha: 82, tarde: 91, noite: 48 },
  { day: "Ter", manha: 75, tarde: 88, noite: 52 },
  { day: "Qua", manha: 90, tarde: 95, noite: 41 },
  { day: "Qui", manha: 85, tarde: 79, noite: 55 },
  { day: "Sex", manha: 93, tarde: 97, noite: 38 },
  { day: "Sáb", manha: 60, tarde: 72, noite: 30 },
  { day: "Dom", manha: 44, tarde: 58, noite: 22 },
];

const CC_ADERENCIA = [
  { sem: "S–4", pct: 87 },
  { sem: "S–3", pct: 91 },
  { sem: "S–2", pct: 84 },
  { sem: "S–1", pct: 89 },
];

// Alertas — professionals table (static)
const PROF_TABLE = [
  { nome: "Dr. Carlos Mendes",      respondidos: 14, tempoMedio: "4 min" },
  { nome: "Enf. Ana Souza",         respondidos: 22, tempoMedio: "2 min" },
  { nome: "Dr. Beatriz Lima",       respondidos:  9, tempoMedio: "7 min" },
  { nome: "Enf. Rodrigo Ferreira",  respondidos: 17, tempoMedio: "3 min" },
];

const UNIT_LABEL: Record<string, string> = {
  "pronto-socorro":   "Pronto Socorro",
  "enfermaria":       "Enfermaria",
  "uti":              "UTI",
  "centro-cirurgico": "Centro Cirúrgico",
};

// ─── shared primitives ───────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--foreground)",
};

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent ? "var(--status-critical)" : "var(--foreground)" }}
      >
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: "var(--muted)" }}>{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
      {children}
    </h2>
  );
}

function ChartBox({ title, children, height = 160 }: { title: string; children: React.ReactNode; height?: number }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "var(--muted)" }}>{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

// ─── PS Dashboard ─────────────────────────────────────────────────────────────

function PSDashboard() {
  const beds       = useSimulationStore(useShallow((s) => s.beds.filter((b) => b.unit === "pronto-socorro")));
  const occupied   = beds.filter((b) => b.internacaoId).length;
  const total      = beds.length;

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Indicadores — Pronto Socorro</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Tempo de Porta" value="27 min" sub="média hoje" />
          <KpiCard label="LOS PS" value="4,2 h" sub="média hoje" />
          <KpiCard label="Taxa de Internação" value="34%" sub="dos atendimentos" />
          <KpiCard label="Boarding Médio" value="2,1 h" sub={`${occupied}/${total} leitos ocupados`} accent={occupied / total > 0.85} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartBox title="Tempo de Porta — 7 dias (min)">
          <AreaChart data={PS_DOOR_TIME} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gtDoor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 50]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} min`, "Tempo de Porta"]} />
            <Area type="monotone" dataKey="min" stroke="#3b82f6" fill="url(#gtDoor)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ChartBox>

        <ChartBox title="LOS por Faixa Etária (h)">
          <BarChart data={PS_LOS_FAIXA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="faixa" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 12]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} h`, "LOS médio"]} />
            <Bar dataKey="h" fill="#8b5cf6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>

        <ChartBox title="Boarding × Leitos Livres — 24h">
          <ComposedChart data={PS_BOARDING} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="hora" tick={{ fill: "var(--muted)", fontSize: 9 }} interval={5} />
            <YAxis yAxisId="left"  tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 8]} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 8]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10, color: "var(--muted)" }} />
            <Bar   yAxisId="left"  dataKey="boarding" name="Boarding" fill="#ef4444" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Line  yAxisId="right" dataKey="livres"   name="Livres"   stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ChartBox>
      </div>

      <div>
        <SectionTitle>Desempenho por Turno — Hoje</SectionTitle>
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Turno", "Horário", "Atendimentos", "Críticos", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PS_SHIFTS.map((row, i) => (
                <tr key={row.turno} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, background: "var(--surface)" }}>
                  <td className="px-4 py-3 font-medium">{row.turno}</td>
                  <td className="px-4 py-3" style={{ color: "var(--muted)" }}>{row.hora}</td>
                  <td className="px-4 py-3 tabular-nums">{row.atend}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: row.crit > 4 ? "var(--status-critical)" : "var(--foreground)" }}>{row.crit}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: row.status === "Crítico" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                        color:      row.status === "Crítico" ? "var(--status-critical)" : "var(--status-stable)",
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ENF Dashboard ────────────────────────────────────────────────────────────

function EnfDashboard() {
  const beds      = useSimulationStore(useShallow((s) => s.beds.filter((b) => b.unit === "enfermaria")));
  const occupied  = beds.filter((b) => b.internacaoId).length;
  const total     = beds.length;
  const occupancy = Math.round((occupied / total) * 100);

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Indicadores — Enfermaria</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="LOS Médio" value="4,3 dias" sub="últimos 30 dias" />
          <KpiCard label="Taxa de Ocupação" value={`${occupancy}%`} sub={`${occupied}/${total} leitos`} accent={occupancy > 90} />
          <KpiCard label="Readmissão 30d" value="8,2%" sub="abaixo da meta 10%" />
          <KpiCard label="Gap Alta" value="1,8 dias" sub="est. vs real" accent />
          <KpiCard label="Altas Hoje" value="3" sub="previstas: 5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartBox title="Taxa de Readmissão por Especialidade (%)" height={200}>
          <BarChart data={ENF_READMISSAO} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 16]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="esp" tick={{ fill: "var(--muted)", fontSize: 10 }} width={88} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Readmissão"]} />
            <Bar dataKey="pct" fill="#f59e0b" radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>

        <ChartBox title="Gap de Alta — últimos 7 dias (dias)" height={200}>
          <AreaChart data={ENF_GAP_ALTA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gtGap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 4]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} dias`, "Gap Alta"]} />
            <Area type="monotone" dataKey="gap" stroke="#f59e0b" fill="url(#gtGap)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ChartBox>
      </div>
    </div>
  );
}

// ─── UTI Dashboard ────────────────────────────────────────────────────────────

function UTIDashboard() {
  const beds      = useSimulationStore(useShallow((s) => s.beds.filter((b) => b.unit === "uti")));
  const occupied  = beds.filter((b) => b.internacaoId).length;
  const total     = beds.length;
  const occupancy = Math.round((occupied / total) * 100);

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Indicadores — UTI</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="LOS UTI" value="6,1 dias" sub="média hoje" />
          <KpiCard label="Taxa de Ocupação" value={`${occupancy}%`} sub={`${occupied}/${total} leitos`} accent={occupancy > 90} />
          <KpiCard label="Delay Pós-Alta" value="3,4 h" sub="aguardando leito ENF" accent />
          <KpiCard label="Mortalidade Ajustada" value="0,91" sub="SMR — abaixo de 1,0" />
          <KpiCard label="Taxa IRAS" value="2,1%" sub="meta: ≤ 3,0%" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartBox title="LOS UTI — últimos 7 dias (dias)" height={200}>
          <AreaChart data={UTI_LOS} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gtUtiLos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 10]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} dias`, "LOS UTI"]} />
            <Area type="monotone" dataKey="dias" stroke="#06b6d4" fill="url(#gtUtiLos)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ChartBox>

        <ChartBox title="SMR / Mortalidade Ajustada — últimos 7 dias" height={200}>
          <LineChart data={UTI_SMR} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0.6, 1.4]} tickCount={5} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}`, "SMR"]} />
            <Line type="monotone" dataKey="smr" stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: "#f97316" }} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>
    </div>
  );
}

// ─── CC Dashboard ─────────────────────────────────────────────────────────────

function CCDashboard() {
  const beds      = useSimulationStore(useShallow((s) => s.beds.filter((b) => b.unit === "centro-cirurgico")));
  const occupied  = beds.filter((b) => b.internacaoId).length;
  const total     = beds.length;
  const occupancy = Math.round((occupied / total) * 100);

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Indicadores — Centro Cirúrgico</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Ocupação de Sala" value={`${occupancy}%`} sub={`${occupied}/${total} salas`} />
          <KpiCard label="Sala Ociosa" value="18 min" sub="média entre cirurgias" accent />
          <KpiCard label="Turnover" value="22 min" sub="limpeza + setup" />
          <KpiCard label="Cancelamento" value="6,8%" sub="último mês" accent />
          <KpiCard label="Aderência ao Mapa" value="89%" sub="semana atual" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartBox title="Cancelamentos por Motivo — mês atual" height={200}>
          <BarChart data={CC_CANCELAMENTOS} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis type="category" dataKey="motivo" tick={{ fill: "var(--muted)", fontSize: 10 }} width={60} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}`, "Cancelamentos"]} />
            <Bar dataKey="n" fill="#ef4444" radius={[0, 3, 3, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>

        <ChartBox title="Ocupação por Turno — últimos 7 dias (%)" height={200}>
          <BarChart data={CC_OCUPACAO_TURNO} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`]} />
            <Legend wrapperStyle={{ fontSize: 10, color: "var(--muted)" }} />
            <Bar dataKey="manha" name="Manhã"  fill="#3b82f6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="tarde" name="Tarde"  fill="#8b5cf6" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="noite" name="Noite"  fill="#475569" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>

        <ChartBox title="Aderência ao Mapa Cirúrgico — últimas 4 semanas (%)" height={200}>
          <LineChart data={CC_ADERENCIA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="sem" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Aderência"]} />
            <Line type="monotone" dataKey="pct" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: "#22c55e" }} isAnimationActive={false} />
          </LineChart>
        </ChartBox>
      </div>
    </div>
  );
}

// ─── Alertas Dashboard ────────────────────────────────────────────────────────

const ALERT_TYPE_LABEL: Record<string, string> = {
  "sinal-vital":    "Sinais Vitais",
  "medicacao":      "Medicação",
  "alta":           "Previsão de Alta",
  "bomba-infusao":  "Bomba de Infusão",
};

function AlertasDashboard() {
  const active  = useAlertStore((s) => s.active);
  const history = useAlertStore((s) => s.history);

  const all = useMemo(() => [...active, ...history], [active, history]);
  const respondidos = history.filter((a) => a.status === "dismissed").length;

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of all) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return counts;
  }, [all]);

  const byUnit = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of all) counts[a.unit] = (counts[a.unit] ?? 0) + 1;
    return Object.entries(counts).map(([unit, n]) => ({ unit: UNIT_LABEL[unit] ?? unit, n }));
  }, [all]);

  return (
    <div className="space-y-8">
      <div>
        <SectionTitle>Indicadores — Central de Alertas</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total de Alertas" value={String(all.length)} sub="desde o início da sessão" />
          <KpiCard label="Pendentes" value={String(active.length)} accent={active.length > 0} sub="aguardando resposta" />
          <KpiCard label="Respondidos" value={String(respondidos)} sub="nesta sessão" />
          <KpiCard label="Tempo Médio Resp." value="3 min" sub="estimado" />
        </div>
      </div>

      <div>
        <SectionTitle>Alertas por Tipo</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(ALERT_TYPE_LABEL).map(([type, label]) => (
            <KpiCard key={type} label={label} value={String(byType[type] ?? 0)} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartBox title="Volume de Alertas por Unidade" height={180}>
          <BarChart data={byUnit.length > 0 ? byUnit : [{ unit: "–", n: 0 }]} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="unit" tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}`, "Alertas"]} />
            <Bar dataKey="n" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartBox>

        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-medium px-4 pt-4 pb-3" style={{ color: "var(--muted)" }}>
            Resposta por Profissional
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Profissional", "Respondidos", "Tempo Médio"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROF_TABLE.map((row, i) => (
                <tr key={row.nome} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, background: "var(--surface)" }}>
                  <td className="px-4 py-2.5 font-medium">{row.nome}</td>
                  <td className="px-4 py-2.5 tabular-nums">{row.respondidos}</td>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--muted)" }}>{row.tempoMedio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const tab      = useAdminStore((s) => s.tab);
  const setTab   = useAdminStore((s) => s.setTab);
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main
          className="flex-1 overflow-y-auto flex flex-col"
          style={{
            marginLeft: collapsed ? 56 : 224,
            transition: "margin-left 200ms ease",
            minHeight: "100vh",
            background: "var(--background)",
          }}
        >
          <TopBar />
          <div className="p-6 flex-1">
          <h1 className="text-lg font-semibold mb-1">Visão Administrativa</h1>
          <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>
            Indicadores gerenciais por unidade
          </p>

          {/* Tab navigation */}
          <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
            {ADMIN_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                style={{
                  color:        tab === t.id ? "var(--accent)"           : "var(--muted)",
                  borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "ps"      && <PSDashboard    />}
          {tab === "enf"     && <EnfDashboard   />}
          {tab === "uti"     && <UTIDashboard   />}
          {tab === "cc"      && <CCDashboard    />}
          {tab === "alertas" && <AlertasDashboard />}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
