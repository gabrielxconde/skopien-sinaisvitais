"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { VitalCard } from "@/components/VitalCard";
import { VitalsChart } from "@/components/VitalsChart";
import { VitalsHeatmap } from "@/components/VitalsHeatmap";
import { EWSForecastChart } from "@/components/EWSForecastChart";
import { CameraPlayer } from "@/components/CameraPlayer";
import { Icon } from "@/components/ui/Icon";
import { useSimulationStore } from "@/store/simulation";
import { useSidebarStore } from "@/store/sidebar";
import { computeSlots, currentSlotValues } from "@/lib/simulation/vitals";
import { calculateEWS } from "@/lib/ews";
import type { Internacao, SurgicalInternacao } from "@/lib/simulation/types";

// ─── Shared config ────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  "pronto-socorro":    "Pronto Socorro",
  "enfermaria":        "Enfermaria",
  "uti":               "UTI",
  "centro-cirurgico":  "Centro Cirúrgico",
};

function formatElapsed(admittedAt: number): string {
  const totalMin = Math.floor((Date.now() - admittedAt) / 60_000);
  const h = Math.floor(totalMin / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h`;
  return `${totalMin}min`;
}

function formatAdmissionDate(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

const SLOT_OPTS  = [{ label: "5min", min: 5 }, { label: "15min", min: 15 }, { label: "1h", min: 60 }] as const;
const WINDOW_OPTS = [{ label: "1h", ms: 3_600_000 }, { label: "3h", ms: 10_800_000 }] as const;

const VITALS = [
  { key: "fr"   as const, label: "FR",   unit: "rpm"  },
  { key: "spo2" as const, label: "SpO₂", unit: "%"    },
  { key: "pas"  as const, label: "PAS",  unit: "mmHg" },
  { key: "fc"   as const, label: "FC",   unit: "bpm"  },
  { key: "temp" as const, label: "TEMP", unit: "°C"   },
] as const;

const STATUS_COLOR: Record<string, string> = {
  "Estável":       "var(--status-stable)",
  "Atenção":       "var(--status-attention)",
  "Risco Elevado": "var(--status-elevated)",
  "Crítico":       "var(--status-critical)",
};

const SCORE_COLOR = [
  "var(--status-stable)",
  "var(--status-attention)",
  "var(--status-elevated)",
  "var(--status-critical)",
];

const MANCHESTER_STYLE: Record<string, { bg: string; text: string }> = {
  "Vermelho": { bg: "#ef444420", text: "#ef4444" },
  "Laranja":  { bg: "#f9731620", text: "#f97316" },
  "Amarelo":  { bg: "#eab30820", text: "#eab308" },
  "Verde":    { bg: "#22c55e20", text: "#22c55e" },
  "Azul":     { bg: "#3b82f620", text: "#3b82f6" },
};

function probColor(p: number): string {
  if (p >= 70) return "var(--status-elevated)";
  if (p >= 50) return "var(--status-attention)";
  return "var(--status-stable)";
}

// ─── Selector button ─────────────────────────────────────────────────────────

function SelBtn({ active, onClick, disabled, children }: {
  active?: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        background: active ? "var(--accent)" : "rgba(255,255,255,0.06)",
        color: active ? "#fff" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

// ─── Shared controls bar (slot + window) ─────────────────────────────────────

function ControlsBar({ slotMin, setSlotMin, windowMs, setWindowMs }: {
  slotMin: number;
  setSlotMin: (v: number) => void;
  windowMs: number;
  setWindowMs: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center gap-5 px-6 py-3 flex-wrap"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--muted)" }}>Slot</span>
        {SLOT_OPTS.map((o) => (
          <SelBtn key={o.min} active={slotMin === o.min} onClick={() => setSlotMin(o.min)}>
            {o.label}
          </SelBtn>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--muted)" }}>Janela</span>
        {WINDOW_OPTS.map((o) => (
          <SelBtn key={o.ms} active={windowMs === o.ms} onClick={() => setWindowMs(o.ms)}>
            {o.label}
          </SelBtn>
        ))}
        <SelBtn disabled>Custom</SelBtn>
      </div>
    </div>
  );
}

// ─── Tab: Sinais Vitais ───────────────────────────────────────────────────────

function SinaisVitaisTab({ internacao, slotMin, windowMs }: {
  internacao: Internacao | SurgicalInternacao;
  slotMin: number;
  windowMs: number;
}) {
  const [view, setView] = useState<"graficos" | "heatmap">("graficos");

  const rawHistory = useSimulationStore((s) => s.internacoes[internacao.id]?.rawHistory ?? []);
  const slots   = computeSlots(rawHistory, slotMin, windowMs, Date.now());
  const current = currentSlotValues(rawHistory, slotMin, Date.now());
  const ews     = calculateEWS(current);

  const minMax = Object.fromEntries(
    VITALS.map((v) => {
      const vals = slots.map((s) => s[v.key]).filter((x) => x != null) as number[];
      return [v.key, vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : undefined];
    })
  ) as Record<string, { min: number; max: number } | undefined>;

  return (
    <div className="flex flex-col gap-5">
      {/* View toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--muted)" }}>Visualização</span>
        <SelBtn active={view === "graficos"} onClick={() => setView("graficos")}>Gráficos</SelBtn>
        <SelBtn active={view === "heatmap"}  onClick={() => setView("heatmap")}>Heatmap</SelBtn>
      </div>

      {/* Vital cards */}
      <div className="flex gap-3">
        {VITALS.map((v) => (
          <VitalCard
            key={v.key}
            label={v.label}
            unit={v.unit}
            value={current[v.key]}
            score={ews.scores[v.key]}
            min={minMax[v.key]?.min}
            max={minMax[v.key]?.max}
          />
        ))}
      </div>

      {view === "graficos" ? <VitalsChart slots={slots} /> : <VitalsHeatmap slots={slots} />}
    </div>
  );
}

// ─── Tab: Predição EWS ───────────────────────────────────────────────────────

function EWSTab({ internacao, slotMin, windowMs }: {
  internacao: Internacao | SurgicalInternacao;
  slotMin: number;
  windowMs: number;
}) {
  const rawHistory = useSimulationStore((s) => s.internacoes[internacao.id]?.rawHistory ?? []);
  const slots = computeSlots(rawHistory, slotMin, windowMs, Date.now());

  return (
    <EWSForecastChart
      internacao={internacao}
      slots={slots}
      windowMs={windowMs}
    />
  );
}

// ─── Tab: Predição de Internação ─────────────────────────────────────────────

function InternacaoTab({ internacao, slotMin }: {
  internacao: Internacao | SurgicalInternacao;
  slotMin: number;
}) {
  const rawHistory = useSimulationStore((s) => s.internacoes[internacao.id]?.rawHistory ?? []);
  const current = currentSlotValues(rawHistory, slotMin, Date.now());
  const ews = calculateEWS(current);

  const prob  = internacao.admissionProbability;
  const color = probColor(prob);
  const ms    = MANCHESTER_STYLE[internacao.manchesterClass] ?? MANCHESTER_STYLE["Amarelo"];

  const GAUGE_R = 58;
  const CX = 80, CY = 80;
  const CIRC = 2 * Math.PI * GAUGE_R;
  const arc  = (prob / 100) * CIRC;

  const factors: { label: string; value: React.ReactNode }[] = [
    {
      label: "Classificação de Manchester",
      value: (
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ background: ms.bg, color: ms.text }}
        >
          {internacao.manchesterClass}
        </span>
      ),
    },
    {
      label: "Escore EWS atual",
      value: (
        <span style={{ color: STATUS_COLOR[internacao.currentStatus] ?? "var(--muted)" }}>
          {internacao.currentEws}&nbsp;·&nbsp;{internacao.currentStatus}
        </span>
      ),
    },
    { label: "Idade", value: `${internacao.patient.age} anos` },
    { label: "Gênero", value: internacao.patient.gender === "M" ? "Masculino" : "Feminino" },
    { label: "Motivo de Admissão", value: internacao.patient.admissionReason },
    ...VITALS.map((v) => ({
      label: v.label,
      value: (
        <span style={{ color: SCORE_COLOR[Math.min(ews.scores[v.key], 3)] }}>
          {current[v.key]}&nbsp;{v.unit}
        </span>
      ),
    })),
  ];

  return (
    <div className="flex gap-8 items-start">
      {/* Circular gauge */}
      <div className="flex flex-col items-center gap-4 shrink-0">
        <svg width={160} height={160}>
          <circle cx={CX} cy={CY} r={GAUGE_R} fill="none" stroke="var(--border)" strokeWidth={12} />
          <circle
            cx={CX} cy={CY} r={GAUGE_R}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${CIRC}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          <text x={CX} y={CY - 6} textAnchor="middle" fontSize={34} fontWeight="700" fill={color}>
            {prob}
          </text>
          <text x={CX} y={CY + 16} textAnchor="middle" fontSize={13} fill="#888">
            %
          </text>
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium">Prob. de Internação</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {prob >= 70 ? "Risco elevado" : prob >= 50 ? "Risco moderado" : "Risco baixo"}
          </p>
        </div>
      </div>

      {/* Factors list */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium mb-3">Fatores Contribuintes</p>
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {factors.map((f, i) => (
            <div
              key={f.label}
              className="flex items-center justify-between px-4 py-2.5 gap-6"
              style={{
                background: i % 2 === 0 ? "var(--surface)" : "rgba(255,255,255,0.015)",
                borderBottom: i < factors.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span className="text-sm shrink-0" style={{ color: "var(--muted)" }}>{f.label}</span>
              <span className="text-sm font-medium text-right">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Patient content ─────────────────────────────────────────────────────────

type Tab = "sinais-vitais" | "ews" | "internacao";

const TAB_LABELS: Record<Tab, string> = {
  "sinais-vitais": "Sinais Vitais",
  "ews":           "Predição EWS",
  "internacao":    "Predição de Internação",
};

function PatientContent({ id }: { id: string }) {
  const router = useRouter();

  const [tab, setTab]                 = useState<Tab>("sinais-vitais");
  const [slotMin, setSlotMin]         = useState(15);
  const [windowMs, setWindowMs]       = useState(10_800_000);
  const [camOpen, setCamOpen]         = useState(false);
  const [camFullscreen, setCamFullscreen] = useState(false);

  const internacao = useSimulationStore((s) => s.internacoes[id] ?? null);
  const bed = useSimulationStore((s) => s.beds.find((b) => b.internacaoId === id) ?? null);

  if (!internacao) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: "var(--muted)" }}>Internação não encontrada.</p>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[internacao.currentStatus] ?? "var(--muted)";
  const proxyUrl = process.env.NEXT_PUBLIC_CAMERA_PROXY_URL;
  const isLiveCamera = bed?.label === "UTI-01" && !!proxyUrl;
  const streamUrl = `${proxyUrl}/stream/index.m3u8`;

  const metaItems = [
    `${internacao.patient.age} anos`,
    internacao.patient.gender === "M" ? "Masculino" : "Feminino",
    internacao.patient.admissionReason,
    `Admissão: ${formatAdmissionDate(internacao.patient.admittedAt)}`,
  ];

  return (
    <div className="flex flex-col min-h-0" style={{ background: "var(--background)" }}>

      {/* ── Patient header ── */}
      <div className="px-6 pt-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Name + EWS badge */}
        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
          <button
            onClick={() => router.push(`/units/${internacao.unit}`)}
            className="text-base hover:opacity-70 transition-opacity shrink-0"
            style={{ color: "var(--muted)" }}
            aria-label={`Voltar para ${UNIT_LABELS[internacao.unit] ?? internacao.unit}`}
          >
            ←
          </button>
          <h1 className="text-xl font-semibold">{internacao.patient.name}</h1>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs tabular-nums"
            style={{
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}55`,
              color: statusColor,
            }}
          >
            EWS {internacao.currentEws} · {internacao.currentStatus}
          </span>
        </div>

        {/* Compact metadata row */}
        <div
          className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm pl-6"
          style={{ color: "var(--muted)" }}
        >
          {metaItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>·</span>}
              <span>{item}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span>·</span>
            <span style={{ color: "var(--foreground)" }}>
              ⏱ Internado há {formatElapsed(internacao.patient.admittedAt)}
            </span>
          </span>
        </div>
      </div>

      {/* ── Camera collapsible ── */}
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setCamOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 text-sm hover:bg-white/[0.02] transition-colors"
          style={{ background: "var(--surface)" }}
        >
          <div className="flex items-center gap-2.5" style={{ color: "var(--muted)" }}>
            <Icon name="video" size={15} color="currentColor" />
            <span>Câmera do {bed?.label ?? "Leito"} — Detecção automática</span>
          </div>
          <div className="flex items-center gap-3">
            {isLiveCamera && (
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--status-stable)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "var(--status-stable)" }}
                />
                LIVE
              </span>
            )}
            <Icon
              name={camOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color="var(--muted)"
            />
          </div>
        </button>

        {camOpen && (
          <div
            className="relative overflow-hidden"
            style={{ height: 240, background: "#000" }}
          >
            {isLiveCamera ? (
              <>
                <CameraPlayer streamUrl={streamUrl} />
                <button
                  onClick={() => setCamFullscreen(true)}
                  className="absolute bottom-3 right-3 text-xs px-2.5 py-1 rounded transition-opacity hover:opacity-80"
                  style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
                >
                  ⛶ Expandir
                </button>
              </>
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-1.5"
                style={{ color: "var(--muted)" }}
              >
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-xs">Câmera Indisponível</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera fullscreen modal */}
      {camFullscreen && isLiveCamera && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setCamFullscreen(false)}
        >
          <div
            className="relative rounded-xl overflow-hidden"
            style={{ width: "min(900px, 90vw)", aspectRatio: "16/9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <CameraPlayer streamUrl={streamUrl} />
            <button
              onClick={() => setCamFullscreen(false)}
              className="absolute top-3 right-3 rounded-full w-8 h-8 flex items-center justify-center text-sm transition-opacity hover:opacity-80"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Tab nav ── */}
      <div className="flex px-6" style={{ borderBottom: "1px solid var(--border)" }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-3 text-sm transition-colors"
              style={{
                color: active ? "var(--foreground)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* ── Shared controls (slot + window) ── */}
      <ControlsBar
        slotMin={slotMin}
        setSlotMin={setSlotMin}
        windowMs={windowMs}
        setWindowMs={setWindowMs}
      />

      {/* ── Tab content ── */}
      <div className="flex-1 p-6">
        {tab === "sinais-vitais" && (
          <SinaisVitaisTab internacao={internacao} slotMin={slotMin} windowMs={windowMs} />
        )}
        {tab === "ews" && (
          <EWSTab internacao={internacao} slotMin={slotMin} windowMs={windowMs} />
        )}
        {tab === "internacao" && (
          <InternacaoTab internacao={internacao} slotMin={slotMin} />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
          }}
        >
          <TopBar />
          <PatientContent id={id} />
        </main>
      </div>
    </AuthGuard>
  );
}
