import React from 'react';
import '@pages/newtab/Newtab.css';
import { getDb, notesTable, contentsTable, remindersTable } from '../background/db';

interface ContentItem {
  id: number;
  noteId: number;
  text: string;
  url: string;
  favIconUrl: string | null;
  createdAt: Date;
}

interface Reminder {
  id: number;
  noteId: number;
  remindAt: Date;
  reminded: Date | null;
  createdAt: Date;
}

interface Note {
  id: number;
  name: string;
  note: string | null;
  createdAt: Date;
  contents: ContentItem[];
  reminder: Reminder | null;
}

export default function Newtab() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dbError, setDbError] = React.useState<Error | null>(null);
  const [clearing, setClearing] = React.useState(false);

  const fetchNotes = React.useCallback(async () => {
    try {
      const db = await getDb();
      const fetchedNotes = await db.select().from(notesTable).orderBy(notesTable.createdAt);
      const contents = await db.select().from(contentsTable);
      const reminders = await db.select().from(remindersTable);

      // Combine notes with their contents and reminders
      const notesWithRelations: Note[] = fetchedNotes.map((n) => ({
        ...n,
        contents: contents.filter((c) => c.noteId === n.id),
        reminder: reminders.find((r) => r.noteId === n.id) || null,
      }));

      setNotes(notesWithRelations);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setDbError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const clearStorage = React.useCallback(async () => {
    if (!confirm('Are you sure you want to clear all notes? This action cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const db = await getDb();
      // Delete all notes (contents and reminders will cascade)
      await db.delete(notesTable);
      setNotes([]);
    } catch (error) {
      console.error('Failed to clear storage:', error);
      alert('Failed to clear storage. Please try again.');
    } finally {
      setClearing(false);
    }
  }, []);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  const clearIndexedDB = React.useCallback(async () => {
    if (!confirm('Are you sure you want to clear all storage? This will delete the database and reload the page.')) {
      return;
    }

    try {
      // Delete the IndexedDB database (PGlite uses /pglite/ prefix)
      const deleteRequest = indexedDB.deleteDatabase('/pglite/wai_db');
      deleteRequest.onsuccess = () => {
        window.location.reload();
      };
      deleteRequest.onerror = () => {
        alert('Failed to clear storage. Please try again.');
      };
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
      alert('Failed to clear storage. Please try again.');
    }
  }, []);

  // Database error state
  if (dbError) {
    return (
      <div className="min-h-screen bg-base-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-bold">Database Error</h3>
              <div className="text-sm">{dbError.message}</div>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={clearIndexedDB}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Storage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      {/* Clear Storage Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          className="btn btn-error btn-sm gap-2"
          onClick={clearStorage}
          disabled={clearing || notes.length === 0}
        >
          {clearing ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          Clear Storage
        </button>
      </div>

      {/* Notes Section */}
      <div className="card bg-base-100 shadow-xl max-w-4xl mx-auto">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </h2>
          <div className="divider mt-0"></div>

          {notes.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No notes yet</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[600px] overflow-y-auto">
              {notes.map((note) => (
                <li key={note.id} className="p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content mb-1">{note.name}</p>
                      {note.note && (
                        <p className="text-sm text-base-content/70 mb-2">{note.note}</p>
                      )}
                      
                      {/* Content items */}
                      <div className="space-y-2 mb-2">
                        {note.contents.map((content) => (
                          <div key={content.id} className="pl-3 border-l-2 border-primary/30">
                            <div className="flex items-start gap-2">
                              {content.favIconUrl && (
                                <img
                                  src={content.favIconUrl}
                                  alt=""
                                  className="w-4 h-4 mt-0.5 rounded"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-base-content/80">{content.text}</p>
                                <div className="flex items-center gap-2 text-xs text-base-content/50 mt-1">
                                  <span>{formatDate(content.createdAt)}</span>
                                  {content.url && (
                                    <>
                                      <span>•</span>
                                      <a
                                        href={content.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="link link-hover truncate max-w-[200px]"
                                        title={content.url}
                                      >
                                        {truncateUrl(content.url)}
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/50">
                        <span>Created: {formatDate(note.createdAt)}</span>
                        <span>•</span>
                        <span>{note.contents.length} item{note.contents.length !== 1 ? 's' : ''}</span>
                        {note.reminder && (
                          <>
                            <span>•</span>
                            <span className="badge badge-sm badge-warning">
                              Remind: {formatDate(note.reminder.remindAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
