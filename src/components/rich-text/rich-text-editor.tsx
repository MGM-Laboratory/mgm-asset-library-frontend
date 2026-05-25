'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Youtube from '@tiptap/extension-youtube';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Table as TableIcon,
  Minus,
  Loader2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '@/components/ui/modal';
import { Input, Field } from '@/components/ui/input';
import { TipTapRenderer } from './tiptap-renderer';
import { uploadEditorMedia } from './editor-media-upload';
import { toast } from '@/components/ui/toaster';
import type { TipTapDoc, TipTapNode } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export type RichTextMode = 'full' | 'lite';

interface RichTextEditorProps {
  value?: TipTapDoc | null;
  onChange: (doc: TipTapDoc) => void;
  mode?: RichTextMode;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  autoFocus?: boolean;
  footer?: ReactNode;
}

const FULL_PLACEHOLDER = 'Write the long-form description of your asset…';
const LITE_PLACEHOLDER = 'Write a comment…';

/**
 * Allowed nodes for Lite mode (comments, release notes). Mirrors backend
 * sanitization. Any disallowed nodes are stripped before submit by the
 * caller via `stripDisallowedLiteNodes`.
 */
export const LITE_ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'codeBlock',
]);
export const LITE_ALLOWED_MARKS = new Set(['bold', 'italic', 'code', 'link']);

function buildExtensions(mode: RichTextMode, placeholder: string) {
  const base = [
    StarterKit.configure({
      heading: mode === 'full' ? { levels: [1, 2, 3] } : false,
      codeBlock: mode === 'full' ? undefined : { HTMLAttributes: { class: 'tiptap-code' } },
      blockquote: mode === 'full' ? undefined : false,
      horizontalRule: mode === 'full' ? undefined : false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['https', 'http', 'mailto'],
      HTMLAttributes: { rel: 'noopener nofollow', target: '_blank' },
    }),
    Placeholder.configure({ placeholder }),
  ];
  if (mode === 'full') {
    return [
      ...base,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ controls: true, nocookie: true, modestBranding: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ];
  }
  return base;
}

export function RichTextEditor({
  value,
  onChange,
  mode = 'full',
  placeholder,
  minHeight = mode === 'full' ? 360 : 120,
  maxHeight,
  className,
  autoFocus,
  footer,
}: RichTextEditorProps) {
  const t = useTranslations('editor');
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busyUploading, setBusyUploading] = useState(false);

  const extensions = useMemo(
    () => buildExtensions(mode, placeholder ?? (mode === 'full' ? FULL_PLACEHOLDER : LITE_PLACEHOLDER)),
    [mode, placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value ?? undefined,
    autofocus: autoFocus,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-prose max-w-none focus:outline-none px-4 py-3',
          'prose-headings:font-display',
        ),
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const it of Array.from(items)) {
          if (it.type.startsWith('image/')) {
            const file = it.getAsFile();
            if (file) {
              void handleImageUpload(file);
              event.preventDefault();
              return true;
            }
          }
        }
        return false;
      },
      handleDrop(_view, event) {
        const files = (event as DragEvent).dataTransfer?.files;
        if (files && files.length > 0) {
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              void handleImageUpload(file);
              event.preventDefault();
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as TipTapDoc;
      const sanitized = mode === 'lite' ? stripDisallowedLiteNodes(json) : json;
      onChange(sanitized);
    },
  });

  // We intentionally do NOT re-sync `value` → editor.setContent here. TipTap
  // is uncontrolled after mount; resyncing every keystroke caused mid-typing
  // reverts when the parent state lagged behind the editor's own snapshot.
  // Parents that genuinely need to swap content (e.g. language tabs) should
  // remount via `key` instead of relying on prop drift.

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (file.size > 24 * 1024 * 1024) {
        toast.error('Image is too large (max 24 MB).');
        return;
      }
      setBusyUploading(true);
      try {
        const { viewUrl } = await uploadEditorMedia(file, accessToken);
        editor.chain().focus().setImage({ src: viewUrl, alt: file.name }).run();
      } catch (err) {
        toast.error('Image upload failed', {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setBusyUploading(false);
      }
    },
    [editor, accessToken],
  );

  if (!editor) {
    return (
      <div
        className={cn('border border-line rounded-[14px] bg-surface', className)}
        style={{ minHeight }}
        aria-busy
      />
    );
  }

  return (
    <div
      className={cn(
        'rich-text-editor flex flex-col rounded-[14px] border border-line bg-surface focus-within:border-ink/30 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 transition-colors duration-120',
        className,
      )}
    >
      <Toolbar
        editor={editor}
        mode={mode}
        busyUploading={busyUploading}
        onPreview={() => setPreviewOpen(true)}
        onLink={() => setLinkOpen(true)}
        onImage={() => fileInputRef.current?.click()}
        onEmbed={() => setEmbedOpen(true)}
      />
      <div
        className="relative overflow-y-auto"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent editor={editor} />
        {busyUploading ? (
          <div
            aria-live="polite"
            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-ink text-white text-[12px] font-medium px-2.5 h-7 shadow-2"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
            Uploading…
          </div>
        ) : null}
      </div>
      {footer}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void handleImageUpload(file);
        }}
      />

      {linkOpen ? (
        <LinkPromptModal
          open
          onOpenChange={setLinkOpen}
          initial={editor.getAttributes('link').href as string | undefined}
          onSubmit={(href) => {
            const chain = editor.chain().focus();
            if (!href) chain.unsetLink().run();
            else chain.extendMarkRange('link').setLink({ href }).run();
          }}
        />
      ) : null}
      {embedOpen ? (
        <EmbedPromptModal
          open
          onOpenChange={setEmbedOpen}
          onSubmit={(url) => editor.commands.setYoutubeVideo({ src: url })}
        />
      ) : null}
      {previewOpen ? (
        <Modal open onOpenChange={setPreviewOpen}>
          <ModalContent size="lg">
            <ModalHeader>
              <ModalTitle>{t('preview')}</ModalTitle>
            </ModalHeader>
            <TipTapRenderer
              doc={editor.getJSON() as TipTapDoc}
              variant={mode === 'full' ? 'full' : 'lite'}
            />
          </ModalContent>
        </Modal>
      ) : null}
    </div>
  );
}

/* =====================================================================
 * Toolbar
 * ===================================================================== */

interface ToolbarProps {
  editor: Editor;
  mode: RichTextMode;
  busyUploading: boolean;
  onPreview: () => void;
  onLink: () => void;
  onImage: () => void;
  onEmbed: () => void;
}

function Toolbar({ editor, mode, onPreview, onLink, onImage, onEmbed }: ToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-surface/95 backdrop-blur-[6px] p-1.5 rounded-t-[14px]">
      {mode === 'full' ? (
        <>
          <BlockDropdown editor={editor} />
          <Divider />
        </>
      ) : null}
      <ToolButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="Bold (⌘B)"
        icon={Bold}
      />
      <ToolButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="Italic (⌘I)"
        icon={Italic}
      />
      {mode === 'full' ? (
        <>
          <ToolButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            label="Underline (⌘U)"
            icon={UnderlineIcon}
          />
          <ToolButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            label="Strikethrough"
            icon={Strikethrough}
          />
        </>
      ) : null}
      <ToolButton
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="Inline code"
        icon={Code}
      />
      <ToolButton active={editor.isActive('link')} onClick={onLink} label="Link (⌘K)" icon={LinkIcon} />
      <Divider />
      <ToolButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="Bullet list"
        icon={List}
      />
      <ToolButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="Numbered list"
        icon={ListOrdered}
      />
      {mode === 'full' ? (
        <>
          <Divider />
          <ToolButton onClick={onImage} label="Insert image" icon={ImageIcon} />
          <ToolButton onClick={onEmbed} label="Embed YouTube" icon={YoutubeIcon} />
          <ToolButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
            label="Insert table"
            icon={TableIcon}
          />
          <ToolButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            label="Divider"
            icon={Minus}
          />
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-caption text-ink-4 geist-tnum hidden sm:inline">
          {editor.storage.characterCount?.characters?.() ?? plainTextLength(editor)} chars
        </span>
        <Button size="sm" variant="ghost" onClick={onPreview} leadingIcon={<Type className="h-4 w-4" strokeWidth={2.25} />}>
          Preview
        </Button>
      </div>
    </div>
  );
}

function BlockDropdown({ editor }: { editor: Editor }) {
  const options: { label: string; check: () => boolean; apply: () => void; icon: typeof Heading1 }[] = [
    {
      label: 'Paragraph',
      icon: Type,
      check: () => editor.isActive('paragraph') && !editor.isActive('heading'),
      apply: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: 'H1',
      icon: Heading1,
      check: () => editor.isActive('heading', { level: 1 }),
      apply: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'H2',
      icon: Heading2,
      check: () => editor.isActive('heading', { level: 2 }),
      apply: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'H3',
      icon: Heading3,
      check: () => editor.isActive('heading', { level: 3 }),
      apply: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Quote',
      icon: Quote,
      check: () => editor.isActive('blockquote'),
      apply: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Code',
      icon: Code,
      check: () => editor.isActive('codeBlock'),
      apply: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ];
  const active = options.find((o) => o.check()) ?? options[0]!;
  return (
    <select
      value={active.label}
      onChange={(e) => options.find((o) => o.label === e.target.value)?.apply()}
      aria-label="Block type"
      className="h-7 rounded-[8px] border border-line bg-surface text-[12.5px] px-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      {options.map((o) => (
        <option key={o.label} value={o.label}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Bold;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-2 hover:bg-surface-muted hover:text-ink transition-colors duration-120',
        active && 'bg-ink text-white hover:bg-ink hover:text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}

function plainTextLength(editor: Editor): number {
  return editor.getText().length;
}

/* =====================================================================
 * Link + embed modals
 * ===================================================================== */

function LinkPromptModal({
  open,
  onOpenChange,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (href: string) => void;
  initial?: string;
}) {
  const [href, setHref] = useState(initial ?? '');
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Insert link</ModalTitle>
        </ModalHeader>
        <Field id="link-href" label="URL">
          <Input
            id="link-href"
            type="url"
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <ModalFooter>
          {initial ? (
            <Button
              variant="ghost"
              onClick={() => {
                onSubmit('');
                onOpenChange(false);
              }}
            >
              Remove link
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit(href.trim());
              onOpenChange(false);
            }}
            disabled={!isValidUrl(href)}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function EmbedPromptModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const valid = /youtu(be\.com|\.be)/.test(url);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Embed YouTube</ModalTitle>
        </ModalHeader>
        <Field
          id="embed-url"
          label="YouTube URL"
          helper="Only YouTube and Vimeo links are accepted for security."
        >
          <Input
            id="embed-url"
            type="url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSubmit(url.trim());
              onOpenChange(false);
            }}
          >
            Embed
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/* =====================================================================
 * Lite sanitization (mirrors backend)
 * ===================================================================== */

export function stripDisallowedLiteNodes(doc: TipTapDoc): TipTapDoc {
  return {
    type: 'doc',
    content: (doc.content ?? [])
      .map(filterLiteNode)
      .filter((n): n is NonNullable<typeof n> => n !== null),
  };
}

function filterLiteNode(node: TipTapNode): TipTapNode | null {
  if (!LITE_ALLOWED_NODES.has(node.type)) return null;
  const marks = node.marks?.filter((m) => LITE_ALLOWED_MARKS.has(m.type));
  const content = node.content
    ?.map(filterLiteNode)
    .filter((n): n is TipTapNode => n !== null);
  return {
    ...node,
    marks: marks?.length ? marks : undefined,
    content: content?.length ? content : node.content ? [] : undefined,
  };
}

// Silence unused — only re-exported for tests
export { Extension };
