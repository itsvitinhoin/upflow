"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Building2 } from "lucide-react";

export const COMPANIES_KEY = "upflow.companies";

export type Company = {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  notes?: string;
  created_at: string;
};

export function loadCompanies(): Company[] {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    return raw ? (JSON.parse(raw) as Company[]) : [];
  } catch {
    return [];
  }
}

export default function CreateCompanyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    const company: Company = {
      id: `c_${Date.now()}`,
      name: name.trim(),
      domain: domain.trim() || undefined,
      industry: industry.trim() || undefined,
      notes: notes.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    try {
      const existing = loadCompanies();
      localStorage.setItem(COMPANIES_KEY, JSON.stringify([company, ...existing]));
    } catch {}
    toast.success(`Created ${company.name}`);
    onCreated?.(company);
    setName("");
    setDomain("");
    setIndustry("");
    setNotes("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-upflow-warning/20 text-upflow-warning flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Create company</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Industry</label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="SaaS"
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional context…"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
