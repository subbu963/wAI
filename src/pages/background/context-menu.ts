import PubSub from 'pubsub-js';

const MAIN_MENU_ID = "wai_main_menu";
const SAVE_ITEM_ID = `${MAIN_MENU_ID}_save_item`;
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MAIN_MENU_ID, // Unique ID for your item
    title: "wAI", // Text shown in the menu
    contexts: ["selection", "link", "page"] // Where it appears (text, link, page)
  });
  chrome.contextMenus.create({
    parentId: MAIN_MENU_ID,
    id: SAVE_ITEM_ID, // Unique ID for your item
    title: "Save", // Text shown in the menu
    contexts: ["selection", "link", "page"] // Where it appears (text, link, page)
  });
});

// Listen for clicks on the menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === SAVE_ITEM_ID) {
    console.log("Menu item clicked!");
    console.log("Clicked text:", info.selectionText); // If context was 'selection'
    console.log("Clicked link:", info.linkUrl); // If context was 'link'
    // Add your extension's logic here, e.g., show an alert, fetch data
    // chrome.scripting.executeScript({
    //     target: { tabId: tab.id },
    //     func: () => { alert("Hello from context menu!"); }
    // });
    PubSub.publish('MY TOPIC', 'hello world!');
  }
});