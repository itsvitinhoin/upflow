"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Ban,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  UserRoundCheck,
  UsersRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { appDateKey, appTimeInputValue, cn, mergeAppDateAndTime } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/types";

type EventType =
  | "meeting"
  | "client_call"
  | "internal_meeting"
  | "deadline"
  | "task"
  | "reminder";

type EventPerson = {
  id: string;
  name: string | null;
  email: string;
};

type EventReminder = {
  id: string;
  minutes_before: number;
  enabled?: boolean;
};

type EventAttachment = {
  id: string;
  kind: "file" | "link" | "document";
  name: string;
  url?: string | null;
  document_id?: string | null;
  document?: { id: string; title: string } | null;
  mime_type?: string | null;
  size_bytes?: number | null;
};

type FullCalendarEvent = CalendarEvent & {
  type: EventType;
  priority?: "low" | "medium" | "high";
  status?: "scheduled" | "cancelled";
  responsible_user_id?: string | null;
  responsible?: EventPerson | null;
  company_id?: string | null;
  company?: { id: string; name: string } | null;
  space_id?: string | null;
  space?: { id: string; name: string; icon?: string | null } | null;
  reminders?: EventReminder[];
  attachments?: EventAttachment[];
  cancelled_at?: string | null;
};

type ProjectOption = {
  id: string;
  name: string;
  company_id?: string | null;
  space_id?: string | null;
};

type EntityOption = {
  id: string;
  name: string;
  icon?: string | null;
};

type DocumentOption = {
  id: string;
  title: string;
  project_id?: string | null;
};

type PagePayload<T> = { items?: T[]; projects?: T[]; companies?: T[]; spaces?: T[]; docs?: T[] };

export type CalendarEditorUser = EventPerson;

type EventEditorSheetProps = {
  event: CalendarEvent;
  people: CalendarEditorUser[];
  onClose: () => void;
  onChanged: (event: CalendarEvent) => void;
  onDeleted: (eventId: string) => void;
  onDuplicated: (event: CalendarEvent) => void;
};

const REMINDER_PRESETS = [5, 15, 60];

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: "meeting", label: "Meeting" },
  { value: "client_call", label: "Client call" },
  { value: "internal_meeting", label: "Internal meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "task", label: "Task" },
];

function pageItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as PagePayload<T>;
  return value.items ?? value.projects ?? value.companies ?? value.spaces ?? value.docs ?? [];
}

function dateForInput(value: string) {
  return appDateKey(value);
}

function timeForInput(value: string) {
  return appTimeInputValue(value);
}

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000);
}

function dateTimeFromInputs(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || !/^\d{2}:\d{2}$/.test(time)) return null;
  const result = mergeAppDateAndTime(new Date(year, month - 1, day), time);
  return Number.isNaN(result.getTime()) ? null : result;
}

function reminderLabel(minutes: number) {
  if (minutes === 5) return "5 minutes before";
  if (minutes === 15) return "15 minutes before";
  if (minutes === 60) return "1 hour before";
  if (minutes % 60 === 0) return String(minutes / 60) + " hours before";
  return String(minutes) + " minutes before";
}

function attachmentHref(eventId: string, attachment: EventAttachment) {
  if (attachment.kind === "file") {
    return "/api/calendar/events/" + eventId + "/attachments/" + attachment.id + "/download";
  }
  if (attachment.kind === "document") {
    const id = attachment.document?.id ?? attachment.document_id;
    return id ? "/docs/" + id : "#";
  }
  return attachment.url || "#";
}

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-foreground"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/40 p-4 dark:border-white/10 dark:bg-white/[0.025]">
      <div className="mb-4 flex gap-2.5">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function EventEditorSheet({
  event,
  people,
  onClose,
  onChanged,
  onDeleted,
  onDuplicated,
}: EventEditorSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<FullCalendarEvent>(event as FullCalendarEvent);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [eventType, setEventType] = useState<EventType>((event as FullCalendarEvent).type ?? "meeting");
  const [startDate, setStartDate] = useState(dateForInput(event.starts_at));
  const [startTime, setStartTime] = useState(timeForInput(event.starts_at));
  const initialEnd = event.ends_at ? new Date(event.ends_at) : addMinutes(event.starts_at, 30);
  const [endDate, setEndDate] = useState(appDateKey(initialEnd));
  const [endTime, setEndTime] = useState(appTimeInputValue(initialEnd));
  const [location, setLocation] = useState(event.location ?? "");
  const [meetingUrl, setMeetingUrl] = useState(event.meeting_url ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    (event as FullCalendarEvent).priority ?? "medium",
  );
  const [responsibleUserId, setResponsibleUserId] = useState(
    (event as FullCalendarEvent).responsible_user_id ?? "",
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    event.attendees?.map((attendee) => attendee.user_id) ?? [],
  );
  const [companyId, setCompanyId] = useState((event as FullCalendarEvent).company_id ?? "");
  const [projectId, setProjectId] = useState(event.project_id ?? "");
  const [spaceId, setSpaceId] = useState((event as FullCalendarEvent).space_id ?? "");
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [companies, setCompanies] = useState<EntityOption[]>([]);
  const [spaces, setSpaces] = useState<EntityOption[]>([]);
  const [docs, setDocs] = useState<DocumentOption[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [customReminder, setCustomReminder] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const hydrate = useCallback((source: FullCalendarEvent) => {
    const end = source.ends_at ? new Date(source.ends_at) : addMinutes(source.starts_at, 30);
    setDetail(source);
    setTitle(source.title);
    setDescription(source.description ?? "");
    setEventType(source.type ?? "meeting");
    setStartDate(dateForInput(source.starts_at));
    setStartTime(timeForInput(source.starts_at));
    setEndDate(appDateKey(end));
    setEndTime(appTimeInputValue(end));
    setLocation(source.location ?? "");
    setMeetingUrl(source.meeting_url ?? "");
    setPriority(source.priority ?? "medium");
    setResponsibleUserId(source.responsible_user_id ?? source.responsible?.id ?? "");
    setAttendeeIds(source.attendees?.map((attendee) => attendee.user_id) ?? []);
    setCompanyId(source.company_id ?? source.company?.id ?? "");
    setProjectId(source.project_id ?? source.project?.id ?? "");
    setSpaceId(source.space_id ?? source.space?.id ?? "");
    setReminderMinutes(
      (source.reminders ?? [])
        .filter((reminder) => reminder.enabled !== false)
        .map((reminder) => reminder.minutes_before)
        .sort((a, b) => a - b),
    );
    setAttachments(source.attachments ?? []);
    setDirty(false);
  }, []);

  useEffect(() => {
    let active = true;
    hydrate(event as FullCalendarEvent);
    async function load() {
      setLoading(true);
      try {
        const [detailResponse, projectsResponse, companiesResponse, spacesResponse, docsResponse] =
          await Promise.all([
            fetch("/api/calendar/events/" + event.id),
            fetch("/api/projects?limit=200"),
            fetch("/api/companies?limit=100"),
            fetch("/api/spaces?limit=200"),
            fetch("/api/docs?limit=200"),
          ]);
        const [detailPayload, projectsPayload, companiesPayload, spacesPayload, docsPayload] =
          await Promise.all([
            detailResponse.ok ? detailResponse.json() : Promise.resolve(event),
            projectsResponse.ok ? projectsResponse.json() : Promise.resolve({ items: [] }),
            companiesResponse.ok ? companiesResponse.json() : Promise.resolve({ items: [] }),
            spacesResponse.ok ? spacesResponse.json() : Promise.resolve({ items: [] }),
            docsResponse.ok ? docsResponse.json() : Promise.resolve({ items: [] }),
          ]);
        if (!active) return;
        hydrate(detailPayload as FullCalendarEvent);
        setProjects(pageItems<ProjectOption>(projectsPayload));
        setCompanies(pageItems<EntityOption>(companiesPayload));
        setSpaces(pageItems<EntityOption>(spacesPayload));
        setDocs(pageItems<DocumentOption>(docsPayload));
      } catch {
        if (active) toast.error("Could not load the full event details.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [event, hydrate]);

  const filteredPeople = useMemo(() => {
    const needle = participantSearch.trim().toLocaleLowerCase();
    if (!needle) return people;
    return people.filter((person) =>
      (person.name || person.email).toLocaleLowerCase().includes(needle),
    );
  }, [participantSearch, people]);

  const selectedPeople = useMemo(
    () =>
      attendeeIds
        .map((id) => people.find((person) => person.id === id))
        .filter((person): person is CalendarEditorUser => Boolean(person)),
    [attendeeIds, people],
  );

  const requestClose = () => {
    if (dirty && !window.confirm("Discard your unsaved event changes?")) return;
    onClose();
  };

  const markDirty = () => setDirty(true);

  const toggleAttendee = (userId: string) => {
    setAttendeeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
    markDirty();
  };

  const changeResponsible = (userId: string) => {
    setResponsibleUserId(userId);
    if (userId) {
      setAttendeeIds((current) =>
        current.includes(userId) ? current : [...current, userId],
      );
    }
    markDirty();
  };

  const toggleReminder = (minutes: number) => {
    setReminderMinutes((current) =>
      current.includes(minutes)
        ? current.filter((value) => value !== minutes)
        : [...current, minutes].sort((a, b) => a - b),
    );
    markDirty();
  };

  const addCustomReminder = () => {
    const minutes = Number.parseInt(customReminder, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 43_200) {
      toast.error("Enter a reminder between 1 minute and 30 days.");
      return;
    }
    setReminderMinutes((current) =>
      current.includes(minutes)
        ? current
        : [...current, minutes].sort((a, b) => a - b),
    );
    setCustomReminder("");
    markDirty();
  };

  const save = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    const startsAt = dateTimeFromInputs(startDate, startTime);
    const endsAt = dateTimeFromInputs(endDate, endTime);
    if (!title.trim()) {
      toast.error("Event title is required.");
      return;
    }
    if (!startsAt || !endsAt) {
      toast.error("Enter a valid event date and time.");
      return;
    }
    if (endsAt <= startsAt) {
      toast.error("End time must be after start time.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type: eventType,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: location.trim() || null,
          meeting_url: meetingUrl.trim() || null,
          priority,
          responsible_user_id: responsibleUserId || null,
          attendee_ids: attendeeIds,
          company_id: companyId || null,
          project_id: projectId || null,
          space_id: spaceId || null,
          reminder_minutes: reminderMinutes,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not save the event.");
      }
      const updated = (await response.json()) as FullCalendarEvent;
      hydrate(updated);
      onChanged(updated);
      toast.success("Event changes saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the event.");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!window.confirm("Duplicate this event and its links, participants, and reminders?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id + "/duplicate", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not duplicate the event.");
      const duplicateEvent = (await response.json()) as CalendarEvent;
      onDuplicated(duplicateEvent);
      toast.success("Event duplicated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate the event.");
    } finally {
      setSaving(false);
    }
  };

  const cancelMeeting = async () => {
    if (!window.confirm("Cancel this event? It will remain in the calendar history.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id + "/cancel", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Could not cancel the event.");
      const updated = (await response.json()) as FullCalendarEvent;
      hydrate(updated);
      onChanged(updated);
      toast.success("Event cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the event.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!window.confirm("Delete this event permanently?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete the event.");
      onDeleted(event.id);
      toast.success("Event deleted.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the event.");
    } finally {
      setSaving(false);
    }
  };

  const addLink = async () => {
    if (!linkUrl.trim()) {
      toast.error("Enter a link to attach.");
      return;
    }
    setUploading(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id + "/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "link",
          name: linkName.trim() || linkUrl.trim(),
          url: linkUrl.trim(),
        }),
      });
      if (!response.ok) throw new Error("Could not attach the link.");
      const payload = (await response.json()) as { attachment?: EventAttachment } | EventAttachment;
      const attachment = "attachment" in payload ? payload.attachment ?? null : (payload as EventAttachment);
      if (attachment) setAttachments((current) => [...current, attachment]);
      setLinkName("");
      setLinkUrl("");
      toast.success("Link attached.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach the link.");
    } finally {
      setUploading(false);
    }
  };

  const addDocument = async () => {
    if (!documentId) return;
    setUploading(true);
    try {
      const response = await fetch("/api/calendar/events/" + event.id + "/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "document", document_id: documentId }),
      });
      if (!response.ok) throw new Error("Could not attach the document.");
      const payload = (await response.json()) as { attachment?: EventAttachment } | EventAttachment;
      const attachment = "attachment" in payload ? payload.attachment ?? null : (payload as EventAttachment);
      if (attachment) setAttachments((current) => [...current, attachment]);
      setDocumentId("");
      toast.success("Document attached.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not attach the document.");
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/calendar/events/" + event.id + "/attachments", {
        method: "POST",
        body: data,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not upload the file.");
      }
      const payload = (await response.json()) as { attachment?: EventAttachment } | EventAttachment;
      const attachment = "attachment" in payload ? payload.attachment ?? null : (payload as EventAttachment);
      if (attachment) setAttachments((current) => [...current, attachment]);
      toast.success("File attached.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = async (attachment: EventAttachment) => {
    if (!window.confirm("Remove this attachment from the event?")) return;
    setUploading(true);
    try {
      const response = await fetch(
        "/api/calendar/events/" + event.id + "/attachments/" + attachment.id,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Could not remove the attachment.");
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the attachment.");
    } finally {
      setUploading(false);
    }
  };

  const selectProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const project = projects.find((item) => item.id === nextProjectId);
    if (project?.company_id) setCompanyId(project.company_id);
    if (project?.space_id) setSpaceId(project.space_id);
    markDirty();
  };

  const cancelled = detail.status === "cancelled";
  const canCancel =
    !cancelled &&
    (eventType === "meeting" ||
      eventType === "client_call" ||
      eventType === "internal_meeting");

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <SheetContent
        side="right"
        data-calendar-event-editor
        className="flex h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[760px] sm:max-w-[760px] xl:w-[960px] xl:max-w-[960px]"
        onPointerDownOutside={(pointerEvent) => {
          if (saving || uploading) pointerEvent.preventDefault();
        }}
        onEscapeKeyDown={(keyboardEvent) => {
          if (saving || uploading) keyboardEvent.preventDefault();
        }}
      >
        <SheetHeader className="border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Full event management
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          </div>
          <SheetTitle>{cancelled ? "Cancelled event" : "Edit event"}</SheetTitle>
          <SheetDescription>
            Keep the schedule, people, related work, reminders, and materials together.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {cancelled ? (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-upflow-warning/40 bg-upflow-warning/10 p-3 text-sm text-foreground">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-upflow-warning" />
                <div>
                  <p className="font-semibold">This event is cancelled</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    It remains available for context, but active reminders are disabled.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <Section
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="Event information"
                  description="Set the schedule, location, and notes without leaving the calendar."
                >
                  <div className="space-y-4">
                    <Field label="Event title" htmlFor="event-title">
                      <Input
                        id="event-title"
                        value={title}
                        onChange={(inputEvent) => {
                          setTitle(inputEvent.target.value);
                          markDirty();
                        }}
                        autoFocus
                        className="h-11 text-base font-medium"
                      />
                    </Field>
                    <Field label="Description / notes" htmlFor="event-description">
                      <Textarea
                        id="event-description"
                        value={description}
                        onChange={(inputEvent) => {
                          setDescription(inputEvent.target.value);
                          markDirty();
                        }}
                        placeholder="Add context, agenda, outcomes, or preparation notes..."
                        rows={5}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Date" htmlFor="event-start-date">
                        <Input
                          id="event-start-date"
                          type="date"
                          value={startDate}
                          onChange={(inputEvent) => {
                            setStartDate(inputEvent.target.value);
                            if (!endDate) setEndDate(inputEvent.target.value);
                            markDirty();
                          }}
                        />
                      </Field>
                      <Field label="Start time" htmlFor="event-start-time">
                        <Input
                          id="event-start-time"
                          type="time"
                          value={startTime}
                          onChange={(inputEvent) => {
                            setStartTime(inputEvent.target.value);
                            markDirty();
                          }}
                        />
                      </Field>
                      <Field label="End date" htmlFor="event-end-date">
                        <Input
                          id="event-end-date"
                          type="date"
                          value={endDate}
                          onChange={(inputEvent) => {
                            setEndDate(inputEvent.target.value);
                            markDirty();
                          }}
                        />
                      </Field>
                      <Field label="End time" htmlFor="event-end-time">
                        <Input
                          id="event-end-time"
                          type="time"
                          value={endTime}
                          onChange={(inputEvent) => {
                            setEndTime(inputEvent.target.value);
                            markDirty();
                          }}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Location / meeting room" htmlFor="event-location">
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="event-location"
                            value={location}
                            onChange={(inputEvent) => {
                              setLocation(inputEvent.target.value);
                              markDirty();
                            }}
                            placeholder="Office, room, or address"
                            className="pl-9"
                          />
                        </div>
                      </Field>
                      <Field label="Meeting link" htmlFor="event-meeting-url">
                        <div className="relative">
                          <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="event-meeting-url"
                            type="url"
                            value={meetingUrl}
                            onChange={(inputEvent) => {
                              setMeetingUrl(inputEvent.target.value);
                              markDirty();
                            }}
                            placeholder="https://..."
                            className="pl-9"
                          />
                        </div>
                      </Field>
                    </div>
                  </div>
                </Section>

                <Section
                  icon={<UsersRound className="h-4 w-4" />}
                  title="Participants"
                  description="Assign one responsible owner and keep everyone involved in the loop."
                >
                  <div className="space-y-4">
                    <Field label="Responsible person" htmlFor="event-responsible">
                      <div className="relative">
                        <UserRoundCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <select
                          id="event-responsible"
                          value={responsibleUserId}
                          onChange={(inputEvent) => changeResponsible(inputEvent.target.value)}
                          className="flex h-10 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">No responsible person</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name || person.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Field>

                    <Field label="Add attendees" htmlFor="event-attendee-search">
                      <Input
                        id="event-attendee-search"
                        value={participantSearch}
                        onChange={(inputEvent) => setParticipantSearch(inputEvent.target.value)}
                        placeholder="Search workspace members..."
                      />
                      <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-border p-1 dark:border-white/10">
                        {filteredPeople.map((person) => {
                          const selected = attendeeIds.includes(person.id);
                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => toggleAttendee(person.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                                selected
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-accent",
                              )}
                            >
                              <span className="min-w-0 truncate">
                                {person.name || person.email}
                                <span className="ml-2 text-xs text-muted-foreground">{person.email}</span>
                              </span>
                              {selected ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <div>
                      <p className="mb-2 text-xs font-semibold text-foreground">
                        Participants ({selectedPeople.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPeople.length ? selectedPeople.map((person) => (
                          <span
                            key={person.id}
                            data-event-attendee={person.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
                          >
                            <span className="max-w-36 truncate">{person.name || person.email}</span>
                            {person.id === responsibleUserId ? (
                              <span className="text-[10px] font-semibold text-primary">Owner</span>
                            ) : (
                              <button
                                type="button"
                                aria-label={"Remove " + (person.name || person.email)}
                                onClick={() => toggleAttendee(person.id)}
                                className="rounded-full text-muted-foreground hover:text-upflow-danger"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        )) : (
                          <p className="text-xs text-muted-foreground">No attendees selected yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Section>

                <Section
                  icon={<Paperclip className="h-4 w-4" />}
                  title="Attachments"
                  description="Keep files, links, and related documents with the event."
                >
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      onChange={(inputEvent) => void uploadFile(inputEvent.target.files?.[0])}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="justify-start"
                      >
                        <Upload /> Add file
                      </Button>
                      <div className="flex gap-2 sm:col-span-2">
                        <Input
                          aria-label="Link label"
                          value={linkName}
                          onChange={(inputEvent) => setLinkName(inputEvent.target.value)}
                          placeholder="Link name"
                        />
                        <Input
                          aria-label="Link URL"
                          type="url"
                          value={linkUrl}
                          onChange={(inputEvent) => setLinkUrl(inputEvent.target.value)}
                          placeholder="https://..."
                        />
                        <Button type="button" variant="outline" onClick={() => void addLink()} disabled={uploading} aria-label="Add link" title="Add link">
                          <Link2 />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label="Attach related document"
                        value={documentId}
                        onChange={(inputEvent) => setDocumentId(inputEvent.target.value)}
                        className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Attach a related document…</option>
                        {docs.map((doc) => (
                          <option key={doc.id} value={doc.id}>{doc.title}</option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" onClick={() => void addDocument()} disabled={!documentId || uploading}>
                        <FileText /> Attach document
                      </Button>
                    </div>
                    {attachments.length ? (
                      <ul className="space-y-2">
                        {attachments.map((attachment) => (
                          <li
                            key={attachment.id}
                            data-event-attachment={attachment.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 dark:border-white/10"
                          >
                            {attachment.kind === "file" ? <Paperclip className="h-4 w-4 text-primary" /> : attachment.kind === "document" ? <FileText className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4 text-primary" />}
                            <a
                              href={attachmentHref(event.id, attachment)}
                              target={attachment.kind === "link" ? "_blank" : undefined}
                              rel={attachment.kind === "link" ? "noreferrer" : undefined}
                              className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary hover:underline"
                            >
                              {attachment.name}
                            </a>
                            <a
                              href={attachmentHref(event.id, attachment)}
                              aria-label={"Open " + attachment.name}
                              target={attachment.kind === "link" ? "_blank" : undefined}
                              rel={attachment.kind === "link" ? "noreferrer" : undefined}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              aria-label={"Remove " + attachment.name}
                              onClick={() => void removeAttachment(attachment)}
                              className="text-muted-foreground hover:text-upflow-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No files, links, or documents attached yet.</p>
                    )}
                  </div>
                </Section>
              </div>

              <aside className="space-y-5">
                <Section
                  icon={<Clock3 className="h-4 w-4" />}
                  title="Event settings"
                >
                  <div className="space-y-4">
                    <Field label="Event type" htmlFor="event-type">
                      <select
                        id="event-type"
                        value={eventType}
                        onChange={(inputEvent) => {
                          setEventType(inputEvent.target.value as EventType);
                          markDirty();
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {EVENT_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Priority" htmlFor="event-priority">
                      <select
                        id="event-priority"
                        value={priority}
                        onChange={(inputEvent) => {
                          setPriority(inputEvent.target.value as "low" | "medium" | "high");
                          markDirty();
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section
                  icon={<FolderKanban className="h-4 w-4" />}
                  title="Related work"
                  description="Connect the event to its client, project, and space."
                >
                  <div className="space-y-4">
                    <Field label="Related client" htmlFor="event-company">
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <select
                          id="event-company"
                          value={companyId}
                          onChange={(inputEvent) => {
                            setCompanyId(inputEvent.target.value);
                            markDirty();
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">No client linked</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                          ))}
                        </select>
                      </div>
                    </Field>
                    <Field label="Related project" htmlFor="event-project">
                      <select
                        id="event-project"
                        value={projectId}
                        onChange={(inputEvent) => selectProject(inputEvent.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">No project linked</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Related space" htmlFor="event-space">
                      <select
                        id="event-space"
                        value={spaceId}
                        onChange={(inputEvent) => {
                          setSpaceId(inputEvent.target.value);
                          markDirty();
                        }}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">No space linked</option>
                        {spaces.map((space) => (
                          <option key={space.id} value={space.id}>
                            {space.icon ? space.icon + " " : ""}{space.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section
                  icon={<BellRing className="h-4 w-4" />}
                  title="Notifications"
                  description="Save the reminder times for this event."
                >
                  <div className="space-y-3">
                    {REMINDER_PRESETS.map((minutes) => {
                      const selected = reminderMinutes.includes(minutes);
                      return (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => toggleReminder(minutes)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border text-foreground hover:bg-accent dark:border-white/10",
                          )}
                        >
                          {reminderLabel(minutes)}
                          {selected ? <Check className="h-4 w-4" /> : null}
                        </button>
                      );
                    })}
                    <div className="flex gap-2">
                      <Input
                        aria-label="Custom reminder minutes"
                        type="number"
                        min="1"
                        max="43200"
                        value={customReminder}
                        onChange={(inputEvent) => setCustomReminder(inputEvent.target.value)}
                        placeholder="Custom minutes"
                      />
                      <Button type="button" variant="outline" onClick={addCustomReminder}>
                        Add
                      </Button>
                    </div>
                    {reminderMinutes.filter((minutes) => !REMINDER_PRESETS.includes(minutes)).length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {reminderMinutes.filter((minutes) => !REMINDER_PRESETS.includes(minutes)).map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => toggleReminder(minutes)}
                            className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary"
                          >
                            {reminderLabel(minutes)} ×
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Section>

                <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground dark:border-white/10">
                  <p className="font-semibold text-foreground">Organizer</p>
                  <p className="mt-1">{detail.creator?.name || detail.creator?.email || "Workspace member"}</p>
                  {selectedPeople.length ? (
                    <p className="mt-2">{selectedPeople.length} participant{selectedPeople.length === 1 ? "" : "s"} included</p>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void deleteEvent()}
              disabled={saving || uploading}
              className="mr-auto border-upflow-danger/40 text-upflow-danger hover:bg-upflow-danger/10"
            >
              <Trash2 /> Delete event
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void duplicate()}
              disabled={saving || uploading}
            >
              <Copy /> Duplicate
            </Button>
            {canCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void cancelMeeting()}
                disabled={saving || uploading}
              >
                <Ban /> Cancel meeting
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={saving || uploading}
            >
              Close
            </Button>
            <Button type="submit" disabled={saving || uploading || loading}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save changes
            </Button>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}
