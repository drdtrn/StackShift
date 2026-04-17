"use client";

import { useState } from "react";

export default function ColoursPage() {
  const [isDark, setIsDark] = useState(true);

  return (
    <div 
      className={isDark ? "dark" : "light"} 
      data-testid="theme-wrapper"
    >
      <div 
        style={{ backgroundColor: 'var(--canvas)', minHeight: '100vh' }} 
        className="p-10 font-sans transition-colors duration-200"
      >
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <h1 style={{ color: 'var(--primary)' }} className="text-2xl font-bold">
            StackSift — Design Token Verification
          </h1>
          <button
            onClick={() => setIsDark(!isDark)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold cursor-pointer"
          >
            {isDark ? "Switch to Light" : "Switch to Dark"}
          </button>
        </div>

        {/* Severity Section */}
        <h2 style={{ color: 'var(--muted)' }} className="text-[11px] font-bold uppercase tracking-widest mb-4">Severity — System</h2>
        <div className="flex flex-wrap gap-6 mb-10">
          {SEVERITY.map((s) => (
            <div key={s.level} className="flex flex-col gap-2 items-center">
              <div 
                className="w-16 h-10 rounded-md border border-white/10" 
                style={{ backgroundColor: `var(--${s.id})` }} 
              />
              <span 
                className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border"
                style={{ 
                  backgroundColor: `var(--${s.id}-bg)`,
                  color: `var(--${s.id})`,
                  borderColor: `var(--${s.id})`
                }}
              >
                {s.level}
              </span>
            </div>
          ))}
        </div>

        {/* Typography Section (Restored for Test) */}
        <h2 style={{ color: 'var(--muted)' }} className="text-[11px] font-bold uppercase tracking-widest mb-4">Typography</h2>
        <div className="bg-surface border border-line rounded-md p-6 max-w-xl mb-10">
          <p className="text-primary text-sm font-mono bg-canvas p-3 rounded border border-line">
            [INFO] 2026-04-03: System check complete.
          </p>
        </div>

        {/* Surface Tokens */}
        <h2 style={{ color: 'var(--muted)' }} className="text-[11px] font-bold uppercase tracking-widest mb-4">Surface Tokens</h2>
        <div className="flex flex-wrap gap-4 mb-10">
          {['canvas', 'surface', 'elevated'].map((t) => (
            <div key={t} className="flex flex-col gap-1">
              <div 
                className="w-20 h-14 rounded-md border" 
                style={{ backgroundColor: `var(--${t})`, borderColor: 'var(--line)' }} 
              />
              <span style={{ color: 'var(--primary)' }} className="text-xs font-medium">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SEVERITY = [
  { level: "CRITICAL", id: "critical" },
  { level: "HIGH",     id: "high" },
  { level: "MEDIUM",   id: "medium" },
  { level: "LOW",      id: "low" },
  { level: "INFO",     id: "info" },
];
