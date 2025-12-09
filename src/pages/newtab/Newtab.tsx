import React from 'react';
import '@pages/newtab/Newtab.css';
import { getDb, notesTable, contentsTable, remindersTable } from '../background/db';
import { eq } from 'drizzle-orm';

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
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editNoteText, setEditNoteText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const modalRef = React.useRef<HTMLDialogElement>(null);

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

  const openNoteModal = React.useCallback((note: Note) => {
    setSelectedNote(note);
    setEditName(note.name);
    setEditNoteText(note.note || '');
    modalRef.current?.showModal();
  }, []);

  const closeNoteModal = React.useCallback(() => {
    modalRef.current?.close();
    setSelectedNote(null);
    setEditName('');
    setEditNoteText('');
  }, []);

  const saveNote = React.useCallback(async () => {
    if (!selectedNote) return;

    setSaving(true);
    try {
      const db = await getDb();
      await db.update(notesTable)
        .set({
          name: editName,
          note: editNoteText || null,
        })
        .where(eq(notesTable.id, selectedNote.id));

      // Update local state
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === selectedNote.id
            ? { ...n, name: editName, note: editNoteText || null }
            : n
        )
      );

      closeNoteModal();
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedNote, editName, editNoteText, closeNoteModal]);

  const deleteNote = React.useCallback(async () => {
    if (!selectedNote) return;
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();
      await db.delete(notesTable).where(eq(notesTable.id, selectedNote.id));

      // Update local state
      setNotes(prevNotes => prevNotes.filter(n => n.id !== selectedNote.id));
      closeNoteModal();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedNote, closeNoteModal]);

  const deleteContentItem = React.useCallback(async (contentId: number) => {
    if (!selectedNote) return;
    if (!confirm('Are you sure you want to delete this content item?')) {
      return;
    }

    try {
      const db = await getDb();
      await db.delete(contentsTable).where(eq(contentsTable.id, contentId));

      // Update local state - update both selectedNote and notes
      const updatedContents = selectedNote.contents.filter(c => c.id !== contentId);
      setSelectedNote(prev => prev ? { ...prev, contents: updatedContents } : null);
      setNotes(prevNotes =>
        prevNotes.map(n =>
          n.id === selectedNote.id
            ? { ...n, contents: updatedContents }
            : n
        )
      );
    } catch (error) {
      console.error('Failed to delete content item:', error);
      alert('Failed to delete content item. Please try again.');
    }
  }, [selectedNote]);

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
                <li
                  key={note.id}
                  className="p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-colors cursor-pointer"
                  onClick={() => openNoteModal(note)}
                >
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

      {/* Note View/Edit Modal */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-2xl">
          {selectedNote && (
            <>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Note
              </h3>

              <div className="space-y-4">
                {/* Note Name */}
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Name</legend>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Note name"
                  />
                </fieldset>

                {/* Note Text */}
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Note</legend>
                  <textarea
                    className="textarea textarea-bordered w-full min-h-[100px]"
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    placeholder="Add a note..."
                  />
                </fieldset>

                {/* Content Items (Read-only) */}
                {selectedNote.contents.length > 0 && (
                  <fieldset className="fieldset">
                    <legend className="fieldset-legend">
                      Content Items ({selectedNote.contents.length})
                    </legend>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {selectedNote.contents.map((content) => (
                        <div key={content.id} className="p-3 bg-base-200 rounded-lg group">
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
                              <p className="text-sm text-base-content">{content.text}</p>
                              <div className="flex items-center gap-2 text-xs text-base-content/50 mt-1">
                                <span>{formatDate(content.createdAt)}</span>
                                {content.url && (
                                  <>
                                    <span>•</span>
                                    <a
                                      href={content.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="link link-hover truncate max-w-[250px]"
                                      title={content.url}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {truncateUrl(content.url)}
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteContentItem(content.id)}
                              title="Delete content item"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                )}

                {/* Reminder */}
                {selectedNote.reminder && (
                  <div className="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Reminder: {formatDate(selectedNote.reminder.remindAt)}</span>
                  </div>
                )}

                {/* Created date */}
                <p className="text-xs text-base-content/50">
                  Created: {formatDate(selectedNote.createdAt)}
                </p>
              </div>

              {/* Modal Actions */}
              <div className="modal-action">
                <button
                  className="btn btn-error btn-outline"
                  onClick={deleteNote}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  Delete
                </button>
                <div className="flex-1"></div>
                <button className="btn" onClick={closeNoteModal} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveNote}
                  disabled={saving || !editName.trim()}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Save
                </button>
              </div>
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeNoteModal}>close</button>
        </form>
      </dialog>
    </div>
  );
}
