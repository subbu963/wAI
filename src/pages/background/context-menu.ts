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
    contexts: ["all"] // Or specify contexts like "page", "selection", "link" etc.
  });
});

// Listen for clicks on the menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === NOTE_DOWN_ITEM_ID) {
      // Open a global side panel on the current window
      // chrome.sidePanel.open({ windowId: tab.windowId });

      // Alternatively, to open a tab-specific side panel:
      chrome.storage.local.set({ sidePanelData: {
        tabId: tab?.id,
        type: "note_down",
        data: {
          content: info.selectionText || '',
          url: tab?.url || '',
          favIconUrl: tab?.favIconUrl || '',
        }
      }}, () => {
        chrome.sidePanel.open({ tabId: tab?.id })
      });
    }
});