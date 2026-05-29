"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useAlertStore } from "@/store/alerts";
import { AlertsPanel } from "./AlertsPanel";
import { Icon } from "./ui/Icon";

const HOSPITAL_NAME = "Hospital Demo Skopien";

const PROFILE_LABELS: Record<string, string> = {
  assistencial: "Profissional Assistencial",
  gestor: "Gestor",
  executivo: "Executivo",
};

function formatDate(): string {
  const str = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TopBar() {
  const logout = useAuthStore((s) => s.logout);
  const profile = useAuthStore((s) => s.profile);
  const router = useRouter();
  const activeCount = useAlertStore((s) => s.activeCount);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setDateStr(formatDate());
  }, []);

  const profileLabel = profile ? (PROFILE_LABELS[profile] ?? profile) : "";

  return (
    <>
      <div
        className="flex items-center justify-between px-6 h-14 shrink-0"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left: hospital name + date */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{HOSPITAL_NAME}</span>
          {dateStr && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {dateStr}
            </span>
          )}
        </div>

        {/* Right: profile + alerts + logout */}
        <div className="flex items-center gap-0.5">
          {/* Profile */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-sm"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="user-circle" size={15} color="currentColor" />
            <span className="text-xs">{profileLabel}</span>
          </div>

          {/* Alerts bell */}
          <button
            onClick={() => setPanelOpen(true)}
            aria-label="Abrir painel de alertas"
            className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              activeCount > 0 ? "sk-alert-blink" : "hover:bg-white/5"
            }`}
            style={{
              color: activeCount > 0 ? "var(--status-critical)" : "var(--muted)",
            }}
          >
            <Icon name="bell-ringing" size={17} color="currentColor" />
            {activeCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                style={{ background: "var(--status-critical)", color: "#fff" }}
              >
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            aria-label="Sair da sessão"
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="logout" size={17} color="currentColor" />
          </button>
        </div>
      </div>

      {/* Alert panel overlay */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={() => setPanelOpen(false)}
          />
          <AlertsPanel onClose={() => setPanelOpen(false)} />
        </>
      )}
    </>
  );
}
