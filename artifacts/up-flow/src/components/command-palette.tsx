"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Folder,
  Inbox,
  Calendar,
  FileText,
  Users,
  Clock,
  Plus,
  Hash,
  CheckSquare,
} from "lucide-react";
import NewProjectDialog from "@/components/projects/new-project-dialog";

interface PaletteProject {
  id: string;
  name: string;
}
interface PaletteSpace {
  id: string;
  name: string;
}
interface PaletteTask {
  id: string;
  title: string;
  project?: { id: string; name: string } | null;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projects, setProjects] = useState<PaletteProject[]>([]);
  const [spaces, setSpaces] = useState<PaletteSpace[]>([]);
  const [tasks, setTasks] = useState<PaletteTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        const editable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t?.isContentEditable;
        if (editable) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const loadData = useCallback(async () => {
    if (loaded) return;
    try {
      const [pRes, sRes, tRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/spaces"),
        fetch("/api/tasks?mine=true"),
      ]);
      if (pRes.ok) setProjects((await pRes.json()).items ?? []);
      if (sRes.ok) setSpaces((await sRes.json()).items ?? []);
      if (tRes.ok) setTasks(((await tRes.json()).items ?? []).slice(0, 20));
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [loaded]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command, page, project, or task…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                setShowNewProject(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>New Project</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/inbox")}>
              <Inbox className="mr-2 h-4 w-4" />
              <span>Inbox</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/projects")}>
              <Folder className="mr-2 h-4 w-4" />
              <span>Projects</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/calendar")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/docs")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Docs</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/team")}>
              <Users className="mr-2 h-4 w-4" />
              <span>Team</span>
            </CommandItem>
            <CommandItem onSelect={() => go("/time")}>
              <Clock className="mr-2 h-4 w-4" />
              <span>Time</span>
            </CommandItem>
          </CommandGroup>

          {spaces.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Spaces">
                {spaces.map((s) => (
                  <CommandItem
                    key={s.id}
                    onSelect={() => go(`/projects?space=${s.id}`)}
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    <span>{s.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {projects.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Projects">
                {projects.slice(0, 25).map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => go(`/projects/${p.id}`)}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {tasks.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="My Tasks">
                {tasks.map((t) => (
                  <CommandItem
                    key={t.id}
                    onSelect={() =>
                      go(
                        t.project
                          ? `/projects/${t.project.id}?task=${t.id}`
                          : `/projects`
                      )
                    }
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span className="truncate">{t.title}</span>
                    {t.project?.name && (
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">
                        {t.project.name}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onCreated={(project) => {
          setShowNewProject(false);
          router.push(`/projects/${project.id}`);
        }}
      />
    </>
  );
}
