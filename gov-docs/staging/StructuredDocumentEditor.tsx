import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

type EditorProps = {
  initialHTML: string;
  readOnly?: boolean;
  onChange?: (html: string, json: object) => void;
};

// Staging-only implementation. Do not mount against production until
// HTML-to-ProseMirror migration and access-control tests are complete.
export function StructuredDocumentEditor({ initialHTML, readOnly = false, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: initialHTML,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML(), editor.getJSON()),
  });
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);
  if (!editor) return <p role="status">편집기 준비 중…</p>;
  const disabled = !editor.isEditable;
  return (
    <section aria-label="문서 편집기">
      <div role="toolbar" aria-label="문서 및 표 편집">
        <button disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>굵게</button>
        <button disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>기울임</button>
        <button disabled={disabled} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: false }).run()}>표 삽입</button>
        <button disabled={disabled || !editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}>행 추가</button>
        <button disabled={disabled || !editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}>열 추가</button>
        <button disabled={disabled || !editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}>셀 병합</button>
        <button disabled={disabled || !editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}>셀 분할</button>
        <button disabled={disabled || !editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}>행 삭제</button>
        <button disabled={disabled || !editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}>열 삭제</button>
      </div>
      <EditorContent editor={editor} />
    </section>
  );
}
