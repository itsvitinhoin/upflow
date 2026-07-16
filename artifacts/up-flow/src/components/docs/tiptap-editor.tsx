"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, Italic, List, ListOrdered, Code, FileCode,
  Heading2, Heading3, Undo, Redo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface TiptapEditorProps {
  content: unknown;
  onChange: (content: unknown) => void;
  editable?: boolean;
}

export default function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const { t } = useLanguage();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: (content as object) || "",
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "ProseMirror focus:outline-none text-foreground min-h-[350px]",
        "data-testid": "doc-editor",
      },
    },
  });

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {editable && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border bg-muted/30 flex-wrap">
          <ToolbarButton
            title={t("docs.undo")}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("docs.redo")}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            title={t("docs.heading2")}
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("docs.heading3")}
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            title={t("docs.bold")}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("docs.italic")}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            title={t("docs.inlineCode")}
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("docs.codeBlock")}
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <FileCode className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarButton
            title={t("docs.bulletList")}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title={t("docs.orderedList")}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}
      <div className="px-6 py-4 min-h-[400px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
