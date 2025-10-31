import React, { useState, useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { ChatInterface } from './components/chat/ChatInterface';
import { DocumentProcessor } from './components/document/DocumentProcessor';
import { NotesView } from './components/notes/NotesView';
import { NoteEditor } from './components/notes/NoteEditor';
import ModelManager from './components/ModelManager';
import { useAI } from './hooks/useAI';
import { getStorageManager } from './lib/storage';
import { FileSystemFile } from './lib/fileSystem';
import { analyzeDocument } from './lib/documentAnalyzer';
import type { ChatMessage } from './lib/ai/types';
import type { DocumentData, NoteData, ModelData } from './lib/storage/types';
import { toast } from 'sonner';

const StorageManager = getStorageManager();

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'notes' | 'documents' | 'models' | 'settings'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  
  // Use the AI hook
  const { 
    initialized: aiInitialized, 
    generateText, 
    analyzeDocument: aiAnalyzeDocument,
    getRecommendedModel,
    isModelLoaded 
  } = useAI();

  // Initialize services
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await StorageManager.initialize();

        // Load existing data
        const [existingMessages, existingNotes, existingDocuments] = await Promise.all([
          StorageManager.getAllConversations(),
          StorageManager.getAllNotes(),
          StorageManager.getAllDocuments()
        ]);

        if (existingMessages.length > 0) {
          // Load the most recent conversation
          const recentConversation = existingMessages[0];
          const conversationMessages = await StorageManager.getConversationMessages(recentConversation.id);
          setMessages(conversationMessages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp
          })));
        }

        setNotes(existingNotes);
        setDocuments(existingDocuments);
        
        // Set recommended model for chat
        const recommendedModel = getRecommendedModel('chat');
        if (recommendedModel) {
          setCurrentModel(recommendedModel);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        toast.error('Failed to initialize application');
      }
    };

    initializeApp();
  }, [getRecommendedModel]);

  // Chat handlers
  const handleSendMessage = async (content: string) => {
    if (!currentModel) {
      toast.error('Please load an AI model first');
      return;
    }

    if (!isModelLoaded(currentModel)) {
      toast.error(`Model ${currentModel} is not loaded. Please load it first.`);
      return;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Create a prompt from the conversation history
      const conversationPrompt = [...messages, userMessage]
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n') + '\n\nAssistant:';

      const response = await generateText(currentModel, conversationPrompt, {
        maxTokens: 1000,
        temperature: 0.7
      });

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to storage
      const allMessages = [...messages, userMessage, assistantMessage];
      await StorageManager.saveConversation({
        id: 'default',
        title: 'Chat Session',
        model: currentModel,
        messages: allMessages.map(msg => ({
          id: `${Date.now()}-${Math.random()}`,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp || Date.now()
        })),
        created: messages.length === 0 ? Date.now() : (await StorageManager.getConversation('default'))?.created || Date.now(),
        updated: Date.now()
      });
    } catch (error) {
      console.error('Failed to get AI response:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to generate AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    await StorageManager.clearConversations();
  };

  // Document handlers
  const handleUploadFiles = async (files: FileList) => {
    setIsProcessing(true);
    
    try {
      const newDocuments: DocumentData[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();

        const timestamp = Date.now();
        const document: DocumentData = {
          id: `doc-${Date.now()}-${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          content,
          created: timestamp,
          updated: timestamp
        };

        await StorageManager.saveDocument(document);
        newDocuments.push(document);
      }
      
      setDocuments(prev => [...prev, ...newDocuments]);
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    await StorageManager.deleteDocument(id);
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleAnalyzeDocument = async (id: string) => {
    const document = documents.find(doc => doc.id === id);
    if (!document) return;

    const analysisModel = getRecommendedModel('analysis');
    if (!analysisModel) {
      toast.error('No suitable model available for document analysis');
      return;
    }

    if (!isModelLoaded(analysisModel)) {
      toast.error(`Analysis model ${analysisModel} is not loaded. Please load it first.`);
      return;
    }

    setIsProcessing(true);
    
    try {
      const analysis = await aiAnalyzeDocument(analysisModel, document.content, {
        type: 'summary'
      });

      const updatedDocument = {
        ...document,
        updated: Date.now(),
        metadata: {
          ...document.metadata,
          analysis: analysis.results?.summary || 'Analysis completed',
          summary: (analysis.results?.summary || 'Analysis completed').substring(0, 200)
        }
      };

      await StorageManager.saveDocument(updatedDocument);
      setDocuments(prev => prev.map(doc => doc.id === id ? updatedDocument : doc));
      toast.success('Document analyzed successfully');
    } catch (error) {
      console.error('Failed to analyze document:', error);
      toast.error('Failed to analyze document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDocument = (document: DocumentData) => {
    // For now, just log the document - in a real app, you'd open a modal or new view
    console.log('Viewing document:', document);
  };

  // File System Access handlers
  const handleFileSystemUpload = async (files: FileSystemFile[]) => {
    setIsProcessing(true);
    
    try {
      const newDocuments: DocumentData[] = [];
      
      for (const file of files) {
        const content = typeof file.content === 'string' ? file.content : new TextDecoder().decode(file.content);

        // Analyze the document
        const analysis = await analyzeDocument(file);

        const timestamp = Date.now();
        const document: DocumentData = {
          id: `doc-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          content,
          created: timestamp,
          updated: timestamp,
          metadata: {
            analysis: analysis.summary,
            summary: analysis.summary.substring(0, 200)
          }
        };

        await StorageManager.saveDocument(document);
        newDocuments.push(document);
      }
      
      setDocuments(prev => [...prev, ...newDocuments]);
    } catch (error) {
      console.error('Failed to process File System files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectoryUpload = async (directory: any) => {
    setIsProcessing(true);
    
    try {
      const processDirectory = async (dir: any): Promise<FileSystemFile[]> => {
        const allFiles: FileSystemFile[] = [];
        
        // Add files from current directory
        allFiles.push(...dir.files);
        
        // Recursively process subdirectories
        for (const subdir of dir.subdirectories) {
          const subdirFiles = await processDirectory(subdir);
          allFiles.push(...subdirFiles);
        }
        
        return allFiles;
      };
      
      const allFiles = await processDirectory(directory);
      await handleFileSystemUpload(allFiles);
    } catch (error) {
      console.error('Failed to process directory:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Note handlers
  const handleCreateNote = () => {
    setIsCreatingNote(true);
    setEditingNote(null);
  };

  const handleEditNote = (note: NoteData) => {
    setEditingNote(note);
    setIsCreatingNote(false);
  };

  const handleSaveNote = async (noteData: Partial<NoteData>) => {
    try {
      const fullNote: NoteData = {
        id: noteData.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: noteData.title || 'Untitled Note',
        content: noteData.content || '',
        tags: noteData.tags || [],
        folder: noteData.folder,
        summary: noteData.summary,
        wordCount: noteData.wordCount || 0,
        created: noteData.created || Date.now(),
        updated: Date.now(),
        metadata: noteData.metadata || {}
      };

      await StorageManager.saveNote(fullNote);

      // Update notes list
      setNotes(prev => {
        const existing = prev.find(n => n.id === fullNote.id);
        if (existing) {
          return prev.map(n => n.id === fullNote.id ? fullNote : n);
        }
        return [fullNote, ...prev];
      });

      // Close editor
      setIsCreatingNote(false);
      setEditingNote(null);

      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await StorageManager.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleSummarizeNote = async (id: string) => {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    if (!currentModel) {
      toast.error('Please load an AI model first');
      return;
    }

    if (!isModelLoaded(currentModel)) {
      toast.error(`Model ${currentModel} is not loaded. Please load it first.`);
      return;
    }

    setIsSummarizing(true);

    try {
      // Create a summarization prompt
      const prompt = `Please provide a concise summary of the following note:\n\nTitle: ${note.title}\n\nContent:\n${note.content}\n\nSummary:`;

      const summary = await generateText(currentModel, prompt, {
        maxTokens: 200,
        temperature: 0.5
      });

      // Update note with summary
      const updatedNote: NoteData = {
        ...note,
        summary,
        updated: Date.now(),
        metadata: {
          ...note.metadata,
          summaryGenerated: Date.now(),
          summaryModel: currentModel,
          summaryLength: 'medium'
        }
      };

      await StorageManager.saveNote(updatedNote);
      setNotes(prev => prev.map(n => n.id === id ? updatedNote : n));

      // If editing this note, update the editor
      if (editingNote?.id === id) {
        setEditingNote(updatedNote);
      }

      toast.success('Note summarized successfully');
    } catch (error) {
      console.error('Failed to summarize note:', error);
      toast.error('Failed to summarize note');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCloseNoteEditor = () => {
    setIsCreatingNote(false);
    setEditingNote(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'chat':
        return (
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
          />
        );
      case 'notes':
        // Show editor if creating new note or editing existing note
        if (isCreatingNote || editingNote) {
          return (
            <NoteEditor
              note={editingNote}
              onSave={handleSaveNote}
              onClose={handleCloseNoteEditor}
              onSummarize={() => editingNote && handleSummarizeNote(editingNote.id)}
              isSummarizing={isSummarizing}
            />
          );
        }
        // Otherwise show notes list
        return (
          <NotesView
            notes={notes}
            onCreateNote={handleCreateNote}
            onEditNote={handleEditNote}
            onDeleteNote={handleDeleteNote}
            onSummarizeNote={handleSummarizeNote}
          />
        );
      case 'documents':
        return (
          <DocumentProcessor
            documents={documents}
            isProcessing={isProcessing}
            onUpload={handleUploadFiles}
            onDelete={handleDeleteDocument}
            onAnalyze={handleAnalyzeDocument}
            onView={handleViewDocument}
            onFileSystemUpload={handleFileSystemUpload}
            onDirectoryUpload={handleDirectoryUpload}
          />
        );
      case 'models':
        return <ModelManager />;
      case 'settings':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <p className="text-muted-foreground">Settings panel coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderCurrentView()}
    </Layout>
  );
}
