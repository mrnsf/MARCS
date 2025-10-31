import React, { useState, useEffect, useCallback } from 'react';
import { Save, X, Sparkles, Eye, EyeOff, Tag, Folder, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import type { NoteData } from '../../lib/storage/types';

interface NoteEditorProps {
  note: NoteData | null;
  onSave: (note: Partial<NoteData>) => void;
  onClose: () => void;
  onSummarize: () => void;
  isSummarizing?: boolean;
}

export function NoteEditor({
  note,
  onSave,
  onClose,
  onSummarize,
  isSummarizing = false
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [folder, setFolder] = useState(note?.folder || '');
  const [showPreview, setShowPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Calculate word count
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

  // Mark as having unsaved changes when content changes
  useEffect(() => {
    if (note) {
      const changed =
        title !== note.title ||
        content !== note.content ||
        JSON.stringify(tags) !== JSON.stringify(note.tags) ||
        folder !== (note.folder || '');
      setHasUnsavedChanges(changed);
    } else {
      setHasUnsavedChanges(title.length > 0 || content.length > 0);
    }
  }, [title, content, tags, folder, note]);

  const handleSave = useCallback(() => {
    const timestamp = Date.now();
    const noteData: Partial<NoteData> = {
      id: note?.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'Untitled Note',
      content,
      tags,
      folder: folder || undefined,
      wordCount,
      created: note?.created || timestamp,
      updated: timestamp,
      summary: note?.summary,
      metadata: {
        ...(note?.metadata || {}),
      }
    };

    onSave(noteData);
    setHasUnsavedChanges(false);
  }, [note, title, content, tags, folder, wordCount, onSave]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleAddTag = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  }, [tags]);

  // Simple markdown rendering (basic)
  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-bold mt-4 mb-2">{line.replace('### ', '')}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-bold mt-4 mb-2">{line.replace('## ', '')}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h1>;
        }

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="ml-4">
              {line.replace(/^[-*]\s/, '')}
            </li>
          );
        }

        // Code blocks
        if (line.startsWith('```')) {
          return null; // Handle code blocks separately if needed
        }

        // Bold and italic (simple regex)
        let processed = line;
        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
        processed = processed.replace(/`(.+?)`/g, '<code className="bg-gray-100 px-1 rounded">$1</code>');

        // Links
        processed = processed.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" className="text-blue-500 underline">$1</a>');

        // Empty lines
        if (line.trim() === '') {
          return <br key={idx} />;
        }

        return (
          <p key={idx} className="mb-2" dangerouslySetInnerHTML={{ __html: processed }} />
        );
      });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">
              {note ? 'Edit Note' : 'New Note'}
            </h2>
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-500">• Unsaved changes</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Preview
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onSummarize}
              disabled={isSummarizing || content.trim().length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isSummarizing ? 'Summarizing...' : 'Summarize'}
            </Button>

            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>

            <Button variant="outline" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <Input
          type="text"
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-bold border-none px-0 focus:ring-0 mb-3"
        />

        {/* Meta info bar */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{wordCount} words</span>
          {note && (
            <>
              <span>•</span>
              <span>Created {new Date(note.created).toLocaleDateString()}</span>
            </>
          )}
          {tags.length > 0 && (
            <>
              <span>•</span>
              <span>{tags.length} {tags.length === 1 ? 'tag' : 'tags'}</span>
            </>
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Editor */}
        <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col border-r`}>
          <div className="flex-1 p-6 overflow-y-auto">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your note... (Markdown supported)"
              className="w-full h-full resize-none border-none focus:ring-0 font-mono text-sm"
              style={{ minHeight: '100%' }}
            />
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
              Preview
            </div>
            <div className="flex-1 p-6 overflow-y-auto prose prose-sm max-w-none">
              {content ? (
                <div className="space-y-2">
                  {renderMarkdown(content)}
                </div>
              ) : (
                <p className="text-gray-400 italic">Nothing to preview yet...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with tags and folder */}
      <div className="border-t px-6 py-4 bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Tags */}
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Tag className="h-4 w-4" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 text-sm rounded bg-blue-100 text-blue-700"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <Input
              type="text"
              placeholder="Add tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="text-sm"
            />
          </div>

          {/* Folder */}
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-2">
              <Folder className="h-4 w-4" />
              Folder
            </label>
            <Input
              type="text"
              placeholder="Folder name (optional)"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        {/* AI Summary display */}
        {note?.summary && (
          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-purple-700">AI Summary</span>
            </div>
            <p className="text-sm text-gray-700">{note.summary}</p>
            <div className="mt-2 text-xs text-gray-500">
              Generated {note.metadata.summaryGenerated ? new Date(note.metadata.summaryGenerated).toLocaleString() : 'recently'}
              {note.metadata.summaryModel && ` using ${note.metadata.summaryModel}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
