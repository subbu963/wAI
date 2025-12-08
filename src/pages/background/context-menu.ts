import { db, notesTable } from './db';


const MAIN_MENU_ID = "wai_main_menu";
const NOTE_DOWN_ITEM_ID = `${MAIN_MENU_ID}_note_down_item`;

chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: MAIN_MENU_ID, // Unique ID for your item
    title: "wAI", // Text shown in the menu
    contexts: ["selection", "link", "page"] // Where it appears (text, link, page)
  });
  chrome.contextMenus.create({
    parentId: MAIN_MENU_ID,
    id: NOTE_DOWN_ITEM_ID, // Unique ID for your item
    title: "Note down", // Text shown in the menu
    contexts: ["selection", "link", "page"] // Where it appears (text, link, page)
  });
});

// Listen for clicks on the menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === NOTE_DOWN_ITEM_ID) {
    console.log("Menu item clicked!");
    console.log("Clicked text:", info.selectionText, tab); // If context was 'selection'
    console.log("Clicked link:", info.linkUrl); // If context was 'link'
    await db.insert(notesTable).values({
      content: info.selectionText || '',
      url: tab?.url || '',
      favIconUrl: tab?.favIconUrl || '',
    });
    // Add your extension's logic here, e.g., show an alert, fetch data
    // chrome.scripting.executeScript({
    //     target: { tabId: tab.id },
    //     func: () => { alert("Hello from context menu!"); }
    // });
    // PubSub.publish('NOTE_DOWN', info.selectionText || '');
  }
});