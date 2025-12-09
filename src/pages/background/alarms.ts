/**
 * Chrome Alarms API utilities for reminders
 * Creates alarms from reminders and handles alarm events
 */

import { getDb, remindersTable, notesTable } from './db';
import { eq, isNull, lte, and } from 'drizzle-orm';

// Prefix for alarm names to identify reminder alarms
const ALARM_PREFIX = 'reminder_';

/**
 * Create an alarm for a reminder
 */
export async function createReminderAlarm(reminderId: number, remindAt: Date): Promise<void> {
  const alarmName = `${ALARM_PREFIX}${reminderId}`;
  const when = remindAt.getTime();
  
  // Only create alarm if the time is in the future
  if (when > Date.now()) {
    await chrome.alarms.create(alarmName, { when });
    console.log(`[Alarms] Created alarm "${alarmName}" for ${remindAt.toISOString()}`);
  } else {
    console.log(`[Alarms] Skipping alarm "${alarmName}" - time is in the past`);
  }
}

/**
 * Clear an alarm for a reminder
 */
export async function clearReminderAlarm(reminderId: number): Promise<boolean> {
  const alarmName = `${ALARM_PREFIX}${reminderId}`;
  const cleared = await chrome.alarms.clear(alarmName);
  console.log(`[Alarms] Cleared alarm "${alarmName}": ${cleared}`);
  return cleared;
}

/**
 * Sync all reminders to alarms
 * Should be called when the extension starts to ensure alarms are set
 */
export async function syncRemindersToAlarms(): Promise<void> {
  console.log('[Alarms] Syncing reminders to alarms...');
  
  try {
    const db = await getDb();
    
    // Get all reminders that haven't been triggered yet and are in the future
    const reminders = await db.select()
      .from(remindersTable)
      .where(isNull(remindersTable.reminded));
    
    console.log(`[Alarms] Found ${reminders.length} pending reminders`);
    
    // Clear all existing reminder alarms first
    const existingAlarms = await chrome.alarms.getAll();
    for (const alarm of existingAlarms) {
      if (alarm.name.startsWith(ALARM_PREFIX)) {
        await chrome.alarms.clear(alarm.name);
      }
    }
    
    // Create alarms for all pending reminders
    for (const reminder of reminders) {
      await createReminderAlarm(reminder.id, reminder.remindAt);
    }
    
    console.log('[Alarms] Sync complete');
  } catch (error) {
    console.error('[Alarms] Failed to sync reminders:', error);
  }
}

/**
 * Handle alarm fired event
 */
async function handleAlarmFired(alarm: chrome.alarms.Alarm): Promise<void> {
  // Check if this is a reminder alarm
  if (!alarm.name.startsWith(ALARM_PREFIX)) {
    return;
  }
  
  const reminderId = parseInt(alarm.name.replace(ALARM_PREFIX, ''), 10);
  console.log(`[Alarms] Reminder alarm fired: ${alarm.name} (ID: ${reminderId})`);
  
  try {
    const db = await getDb();
    
    // Get the reminder with its note
    const reminders = await db.select({
      reminder: remindersTable,
      note: notesTable,
    })
      .from(remindersTable)
      .innerJoin(notesTable, eq(remindersTable.noteId, notesTable.id))
      .where(eq(remindersTable.id, reminderId));
    
    if (reminders.length === 0) {
      console.log(`[Alarms] Reminder ${reminderId} not found in database`);
      return;
    }
    
    const { reminder, note } = reminders[0];
    
    // Mark reminder as triggered
    await db.update(remindersTable)
      .set({ reminded: new Date() })
      .where(eq(remindersTable.id, reminderId));
    
    // Show notification
    await chrome.notifications.create(`notification_${reminderId}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon-128.png'),
      title: 'Reminder: ' + note.name,
      message: note.note || 'You have a reminder for this note.',
      priority: 2,
      requireInteraction: true,
    });
    
    console.log(`[Alarms] Notification shown for reminder ${reminderId}`);
  } catch (error) {
    console.error(`[Alarms] Failed to handle alarm ${alarm.name}:`, error);
  }
}

/**
 * Handle notification click
 */
async function handleNotificationClick(notificationId: string): Promise<void> {
  // Open the newtab page when notification is clicked
  if (notificationId.startsWith('notification_')) {
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/newtab/index.html') });
    await chrome.notifications.clear(notificationId);
  }
}

/**
 * Initialize alarm listeners
 * Should be called once in the background script
 */
export function initAlarmListeners(): void {
  console.log('[Alarms] Initializing alarm listeners...');
  
  // Listen for alarms
  chrome.alarms.onAlarm.addListener(handleAlarmFired);
  
  // Listen for notification clicks
  chrome.notifications.onClicked.addListener(handleNotificationClick);
  
  // Sync reminders to alarms on startup
  syncRemindersToAlarms();
  
  console.log('[Alarms] Alarm listeners initialized');
}

/**
 * Check for any past due reminders that weren't triggered
 * This handles cases where the browser was closed when a reminder was due
 */
export async function checkPastDueReminders(): Promise<void> {
  console.log('[Alarms] Checking for past due reminders...');
  
  try {
    const db = await getDb();
    const now = new Date();
    
    // Get reminders that are past due but haven't been triggered
    const pastDueReminders = await db.select({
      reminder: remindersTable,
      note: notesTable,
    })
      .from(remindersTable)
      .innerJoin(notesTable, eq(remindersTable.noteId, notesTable.id))
      .where(and(
        isNull(remindersTable.reminded),
        lte(remindersTable.remindAt, now)
      ));
    
    console.log(`[Alarms] Found ${pastDueReminders.length} past due reminders`);
    
    for (const { reminder, note } of pastDueReminders) {
      // Mark as triggered
      await db.update(remindersTable)
        .set({ reminded: new Date() })
        .where(eq(remindersTable.id, reminder.id));
      
      // Show notification
      await chrome.notifications.create(`notification_pastdue_${reminder.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-128.png'),
        title: '⏰ Missed Reminder: ' + note.name,
        message: `This reminder was due at ${reminder.remindAt.toLocaleString()}. ${note.note || ''}`,
        priority: 2,
        requireInteraction: true,
      });
    }
  } catch (error) {
    console.error('[Alarms] Failed to check past due reminders:', error);
  }
}
