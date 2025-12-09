import './context-menu';
import './search';
import { initEmbeddingMessageHandler } from './embeddings';
import { initAlarmListeners, checkPastDueReminders } from './alarms';

// Initialize the embedding message handler in the background script
initEmbeddingMessageHandler();

// Initialize alarm listeners for reminders
initAlarmListeners();

// Check for past due reminders after a short delay (to allow DB to be ready)
setTimeout(() => {
  checkPastDueReminders();
}, 2000);