import React from 'react';
import '@pages/panel/Panel.css';
import { getDb, notesTable, contentsTable, remindersTable } from '../background/db';
import { eq } from 'drizzle-orm';
import { generateEmbedding } from '../background/embeddings';
import { createReminderAlarm, clearReminderAlarm } from '../background/alarms';

type ContentItem = {
  id: number;
  noteId: number;
  text: string;
  url: string;
  favIconUrl: string | null;
  createdAt: Date;
};

type Reminder = {
  id: number;
  noteId: number;
  remindAt: Date;
  reminded: Date | null;
  createdAt: Date;
};

type Note = {
  id: number;
  name: string;
  note: string | null;
  createdAt: Date;
  contents: ContentItem[];
  reminder: Reminder | null;
};

export default function Panel() {
  const [name, setName] = React.useState('');
  const [note, setNote] = React.useState('');
  const [isNewNote, setIsNewNote] = React.useState(true);
  const [selectedNoteId, setSelectedNoteId] = React.useState<number | null>(null);
  const [existingNotes, setExistingNotes] = React.useState<Note[]>([]);
  const [sidePanelData, setSidePanelData] = React.useState<any>(null);
  const [remind, setRemind] = React.useState(false);
  const [remindAt, setRemindAt] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [dbError, setDbError] = React.useState<Error | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Fetch existing notes
  React.useEffect(() => {
    const fetchNotes = async () => {
      try {
        const db = await getDb();
        const notes = await db.select().from(notesTable).orderBy(notesTable.createdAt);
        const contents = await db.select().from(contentsTable);
        const reminders = await db.select().from(remindersTable);

        // Combine notes with their contents and reminders
        const notesWithRelations: Note[] = notes.map((n) => ({
          ...n,
          contents: contents.filter((c) => c.noteId === n.id),
          reminder: reminders.find((r) => r.noteId === n.id) || null,
        }));

        setExistingNotes(notesWithRelations);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
        setDbError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  // Fetch side panel data from storage
  React.useEffect(() => {
    chrome.storage.local.get('sidePanelData', (result) => {
      setSidePanelData(result.sidePanelData);
    });
  }, []);

  const save = React.useCallback(async () => {
    if (!name.trim()) {
      alert('Please enter a note name');
      return;
    }

    setSaving(true);
    try {
      const db = await getDb();

      if (isNewNote) {
        // Generate embedding for the note
        const noteText = `${name} ${note || ''}`;
        const noteEmbedding = await generateEmbedding(noteText);

        // Create new note
        const [newNote] = await db.insert(notesTable).values({
          name: name,
          note: note || null,
          embedding: noteEmbedding,
        }).returning();

        // Generate embedding for the content
        const contentEmbedding = await generateEmbedding(sidePanelData.data.content);

        // Add content
        await db.insert(contentsTable).values({
          noteId: newNote.id,
          text: sidePanelData.data.content,
          url: sidePanelData.data.url,
          favIconUrl: sidePanelData.data.favIconUrl,
          embedding: contentEmbedding,
        });

        // Add reminder if set
        if (remind && remindAt) {
          const [newReminder] = await db.insert(remindersTable).values({
            noteId: newNote.id,
            remindAt: new Date(remindAt),
          }).returning();
          
          // Create alarm for the reminder
          await createReminderAlarm(newReminder.id, new Date(remindAt));
        }
      } else if (selectedNoteId) {
        // Generate embedding for the content
        const contentEmbedding = await generateEmbedding(sidePanelData.data.content);

        // Append content to existing note
        await db.insert(contentsTable).values({
          noteId: selectedNoteId,
          text: sidePanelData.data.content,
          url: sidePanelData.data.url,
          favIconUrl: sidePanelData.data.favIconUrl,
          embedding: contentEmbedding,
        });

        // Update or create reminder
        const existingNote = existingNotes.find(n => n.id === selectedNoteId);
        if (remind && remindAt) {
          if (existingNote?.reminder) {
            await db.update(remindersTable)
              .set({ remindAt: new Date(remindAt) })
              .where(eq(remindersTable.noteId, selectedNoteId));
            
            // Update alarm for the reminder
            await clearReminderAlarm(existingNote.reminder.id);
            await createReminderAlarm(existingNote.reminder.id, new Date(remindAt));
          } else {
            const [newReminder] = await db.insert(remindersTable).values({
              noteId: selectedNoteId,
              remindAt: new Date(remindAt),
            }).returning();
            
            // Create alarm for the reminder
            await createReminderAlarm(newReminder.id, new Date(remindAt));
          }
        } else if (!remind && existingNote?.reminder) {
          // Remove reminder and its alarm if unchecked
          await clearReminderAlarm(existingNote.reminder.id);
          await db.delete(remindersTable).where(eq(remindersTable.noteId, selectedNoteId));
        }
      }

      alert('Note saved!');
      window.close();
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [sidePanelData, name, note, isNewNote, selectedNoteId, existingNotes, remind, remindAt]);

  const close = React.useCallback(() => {
    window.close();
  }, []);

  const handleNoteSelection = (noteId: number | 'new') => {
    if (noteId === 'new') {
      setIsNewNote(true);
      setSelectedNoteId(null);
      setName('');
      setNote('');
      setRemind(false);
      setRemindAt('');
    } else {
      setIsNewNote(false);
      setSelectedNoteId(noteId);
      const selected = existingNotes.find(n => n.id === noteId);
      if (selected) {
        setName(selected.name);
        setNote(selected.note || '');
        setRemind(!!selected.reminder);
        setRemindAt(selected.reminder ? new Date(selected.reminder.remindAt).toISOString().slice(0, 16) : '');
      }
    }
  };

  // Database error state
  if (dbError) {
    return (
      <div className="min-h-screen bg-base-200 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-bold">Database Error</h3>
              <div className="text-sm">{dbError.message}</div>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button className="btn btn-ghost" onClick={close}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !sidePanelData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-6">Save to Notes</h2>

            {/* Note Selection */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-semibold">Select Note *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={isNewNote ? 'new' : selectedNoteId || ''}
                onChange={(e) => handleNoteSelection(e.target.value === 'new' ? 'new' : Number(e.target.value))}
              >
                <option value="new">+ Create New Note</option>
                {existingNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.contents.length} items)
                  </option>
                ))}
              </select>
            </div>

            {/* Note Name (for new notes) */}
            {isNewNote && (
              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Note Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter note name..."
                  className="input input-bordered w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            {/* Note (optional) */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-semibold">Note</span>
              </label>
              <textarea
                placeholder="Add a note (optional)..."
                className="textarea textarea-bordered w-full"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            {/* Content Preview */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-semibold">Content to Add</span>
              </label>
              <div className="bg-base-200 rounded-lg p-4 border border-base-300">
                <p className="text-sm">{sidePanelData.data.content}</p>
              </div>
            </div>

            {/* URL Preview */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-semibold">Source URL</span>
              </label>
              <div className="flex items-center gap-3 bg-base-200 rounded-lg p-3 border border-base-300">
                {sidePanelData.data.favIconUrl && (
                  <img
                    src={sidePanelData.data.favIconUrl}
                    alt="favicon"
                    className="w-5 h-5"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <a
                  href={sidePanelData.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate"
                >
                  {sidePanelData.data.url}
                </a>
              </div>
            </div>

            {/* Existing Content Preview (for existing notes) */}
            {!isNewNote && selectedNoteId && (
              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text font-semibold">Existing Content ({existingNotes.find(n => n.id === selectedNoteId)?.contents.length} items)</span>
                </label>
                <div className="bg-base-200 rounded-lg p-4 border border-base-300 max-h-40 overflow-y-auto">
                  {existingNotes.find(n => n.id === selectedNoteId)?.contents.map((item) => (
                    <div key={item.id} className="mb-2 pb-2 border-b border-base-300 last:border-b-0 last:mb-0 last:pb-0">
                      <p className="text-sm">{item.text}</p>
                      <p className="text-xs text-base-content/60 mt-1">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminder Toggle */}
            <div className="form-control w-full mb-4">
              <label className="label cursor-pointer justify-start gap-4">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={remind}
                  onChange={(e) => setRemind(e.target.checked)}
                />
                <span className="label-text font-semibold">Set Reminder</span>
              </label>
            </div>

            {/* Reminder DateTime */}
            {remind && (
              <div className="form-control w-full mb-6">
                <label className="label">
                  <span className="label-text font-semibold">Remind At</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="card-actions justify-end mt-4">
              <button className="btn btn-ghost" onClick={close} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving && <span className="loading loading-spinner loading-sm"></span>}
                {isNewNote ? 'Create Note' : 'Add to Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
