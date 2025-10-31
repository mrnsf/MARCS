import React, { useState } from 'react';
import { Menu, X, MessageSquare, FileText, Settings, Brain, StickyNote } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'chat' | 'notes' | 'documents' | 'models' | 'settings';
  onViewChange: (view: 'chat' | 'notes' | 'documents' | 'models' | 'settings') => void;
}

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Chat', icon: MessageSquare, view: 'chat' as const },
    { name: 'Notes', icon: StickyNote, view: 'notes' as const },
    { name: 'Documents', icon: FileText, view: 'documents' as const },
    { name: 'Models', icon: Brain, view: 'models' as const },
    { name: 'Settings', icon: Settings, view: 'settings' as const },
  ];

  return (
    <div className="h-screen flex bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-black/50" />
        </div>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center space-x-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Offline AI</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => (
              <li key={item.name}>
                <Button
                  variant={currentView === item.view ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => {
                    onViewChange(item.view);
                    setSidebarOpen(false);
                  }}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Status indicator */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-green-100 dark:bg-green-900 rounded-lg p-3">
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Offline Mode Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card border-b px-4 py-3 flex items-center justify-between lg:px-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden mr-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold capitalize">
              {currentView}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              <span>All systems operational</span>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}