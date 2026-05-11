"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import NewProjectDialog from "@/components/projects/new-project-dialog";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/projects?search=${encodeURIComponent(search.trim())}`);
    }
  }, [search, router]);

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-foreground md:ml-0 ml-10">{title}</h1>
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="hidden sm:flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects & tasks..."
                className="pl-9 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring w-56 transition"
              />
            </div>
          </form>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </div>
      </header>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={() => {
          setShowNewProject(false);
          router.refresh();
        }}
      />
    </>
  );
}
