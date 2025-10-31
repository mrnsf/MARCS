import React, { useState, useCallback } from 'react';
import { Plus, FileText, Edit, Trash2, Sparkles, Search, Tag, Folder, SortAsc } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { formatDate } from '../../lib/utils';
import type { NoteData } from '../../lib/storage/types';

interface NotesViewProps {
  notes: NoteData[];
  onCreateNote: () => void;
  onEditNote: (note: NoteData) => void;
  onDeleteNote: (id: string) => void;
  onSummarizeNote: (id: string) => void;
}

export function NotesView({
  notes,
  onCreateNote,
  onEditNote,
  onDeleteNote,
  onSummarizeNote
}: NotesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');

  // Get all unique tags from notes
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filter and sort notes
  const filteredNotes = React.useMemo(() => {
    let filtered = notes;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        note =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by selected tag
    if (selectedTag) {
      filtered = filtered.filter(note => note.tags.includes(selectedTag));
    }

    // Sort notes
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return b[sortBy] - a[sortBy];
    });

    return filtered;
  }, [notes, searchQuery, selectedTag, sortBy]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with create button and search */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Notes</h1>
          <Button onClick={onCreateNote}>
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'title')}
              className="px-3 py-2 border rounded-md text-sm bg-white"
            >
              <option value="updated">Last Updated</option>
              <option value="created">Date Created</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedTag === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Notes
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 text-sm text-gray-500">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          {selectedTag && ` in "${selectedTag}"`}
        </div>
      </div>

      {/* Notes grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {notes.length === 0 ? 'No Notes Yet' : 'No Notes Found'}
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              {notes.length === 0
                ? 'Create your first note to get started. All notes are stored locally on your device.'
                : 'Try adjusting your search or filters.'}
            </p>
            {notes.length === 0 && (
              <Button onClick={onCreateNote}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => onEditNote(note)}
                onDelete={() => onDeleteNote(note.id)}
                onSummarize={() => onSummarizeNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: NoteData;
  onEdit: () => void;
  onDelete: () => void;
  onSummarize: () => void;
}

function NoteCard({ note, onEdit, onDelete, onSummarize }: NoteCardProps) {
  // Get content preview (first 150 characters)
  const contentPreview = note.content.length > 150
    ? note.content.substring(0, 150) + '...'
    : note.content;

  // Check if note has AI summary
  const hasSummary = Boolean(note.summary);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={onEdit}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate mb-1">{note.title || 'Untitled Note'}</CardTitle>
            <div className="flex items-center text-xs text-gray-500 gap-2">
              <span>{formatDate(new Date(note.updated))}</span>
              <span>•</span>
              <span>{note.wordCount} words</span>
            </div>
          </div>
          {hasSummary && (
            <div className="ml-2" title="AI Summary Available">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Content preview */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-3 whitespace-pre-wrap">
          {contentPreview}
        </p>

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {note.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700"
                onClick={(e) => e.stopPropagation()}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Folder */}
        {note.folder && (
          <div className="text-xs text-gray-500 mb-3 flex items-center">
            <Folder className="h-3 w-3 mr-1" />
            {note.folder}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onSummarize();
            }}
            className="flex-1"
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Summarize
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this note?')) {
                onDelete();
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
