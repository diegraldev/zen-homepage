// ==UserScript==
// @name           Better Zen Homepage Empty Mode
// @description    On the local homepage: empty url bar and no open tab shown.
//                 The homepage tab closes itself when another tab opens.
//                 Empty/new tabs auto-open the homepage.
// ==/UserScript==

// Better Zen — homepage tweaks (Sine mod).
// When the selected tab is the local homepage (hey-diego.html), set the
// zen-homepage attribute on :root so userChrome.css can show an empty
// url bar and hide the open tab. The sidebar itself stays visible.
// The homepage tab is transient: as soon as another tab is selected,
// the homepage tab closes itself (unless pinned).
// Empty tabs (about:newtab / about:blank / about:home, Zen's special
// zen-empty-tab, or no tabs at all) auto-open the homepage.

const TARGET_URL = "file:///home/diegral/Documents/hey-diego.html";
const TARGET_PREFIX = "file:///home/diegral/Documents/hey-diego";
const EMPTY_URIS = ["about:newtab", "about:blank", "about:home"];

function getURI(tab) {
  try {
    return (
      tab.linkedBrowser &&
      tab.linkedBrowser.currentURI &&
      tab.linkedBrowser.currentURI.spec
    );
  } catch (e) {
    return null;
  }
}

function isHomepage(tab) {
  const uri = getURI(tab);
  return !!uri && uri.startsWith(TARGET_PREFIX);
}

function isEmptyTab(tab) {
  if (!tab) {
    return true;
  }
  try {
    if (tab.hasAttribute("zen-empty-tab")) {
      return true;
    }
  } catch (e) {}
  const uri = getURI(tab);
  return (
    !!uri && EMPTY_URIS.some((u) => uri === u || uri.startsWith(u + "?"))
  );
}

// DEBUG: visible notification + log file, so failures are observable.
function debugLog(extra) {
  let line = "";
  try {
    const b = window.gBrowser;
    line = JSON.stringify({
      t: new Date().toISOString(),
      selectedURI: b ? getURI(b.selectedTab) : null,
      tabs: b ? b.tabs.length : -1,
      zenEmptyAttr:
        b && b.selectedTab ? b.selectedTab.hasAttribute("zen-empty-tab") : null,
      ...extra,
    });
    if (window.UC_API && UC_API.FileSystem && UC_API.FileSystem.writeFile) {
      UC_API.FileSystem.writeFile("homepage-debug.log", line).catch(() => {});
    }
    if (typeof PathUtils !== "undefined") {
      PathUtils.writeUTF8("/tmp/homepage-debug.log", line).catch(() => {});
    }
    if (window.UC_API && UC_API.Notifications && UC_API.Notifications.show) {
      UC_API.Notifications.show({
        label: "Homepage mod: " + (extra && extra.action ? extra.action : "update"),
        type: "homepage-debug",
        priority: "info",
      }).catch(() => {});
    }
  } catch (e) {}
}

function loadHomepage(tab) {
  // Prefer Sine's own API (handles principals correctly in this scope).
  try {
    if (window.UC_API && UC_API.Utils && UC_API.Utils.loadURI) {
      UC_API.Utils.loadURI(window, { url: TARGET_URL, where: "current" });
      return true;
    }
  } catch (e) {
    /* fall through */
  }
  // Fallback: gBrowser.loadURI with a system principal.
  try {
    window.gBrowser.loadURI(TARGET_URL, {
      triggeringPrincipal: Services.scriptSecurity.getSystemPrincipal(),
    });
    return true;
  } catch (e) {
    /* pass */
  }
  return false;
}

function openHomepageTab() {
  try {
    if (window.UC_API && UC_API.Utils && UC_API.Utils.loadURI) {
      UC_API.Utils.loadURI(window, { url: TARGET_URL, where: "tab" });
      return;
    }
  } catch (e) {
    /* fall through */
  }
  try {
    window.gBrowser.loadTabs([TARGET_URL], { createLazyBrowser: true });
  } catch (e) {
    /* pass */
  }
}

function update() {
  try {
    const b = window.gBrowser;
    if (!b) {
      return;
    }
    const selected = b.selectedTab;

    // DEBUG (temporary): encode live state into the window title so it can
    // be read from outside (niri msg). Removed once diagnosed.
    try {
      const uri = selected ? getURI(selected) : "null";
      const emptyAttr =
        selected && selected.hasAttribute
          ? selected.hasAttribute("zen-empty-tab")
          : null;
      document.title =
        "DBG uri=" + uri + " tabs=" + b.tabs.length + " emptyAttr=" + emptyAttr;
    } catch (e) {}

    // No tabs at all, or the selected tab is an empty/new tab:
    // open the homepage.
    if (!selected || b.tabs.length === 0) {
      document.documentElement.setAttribute("zen-debug-empty", "true");
      debugLog({ action: "no-tabs-open-homepage" });
      openHomepageTab();
      return;
    }
    if (isEmptyTab(selected)) {
      document.documentElement.setAttribute("zen-debug-empty", "true");
      debugLog({ action: "empty-tab-load-homepage" });
      loadHomepage(selected);
      // Retry once in case the first navigation raced tab creation.
      window.setTimeout(() => {
        try {
          const s = window.gBrowser.selectedTab;
          if (!s || isEmptyTab(s)) {
            if (!s || window.gBrowser.tabs.length === 0) {
              openHomepageTab();
            } else {
              loadHomepage(s);
            }
          }
        } catch (e) {}
      }, 750);
      return;
    }

    const onHomepage = isHomepage(selected);
    document.documentElement.toggleAttribute("zen-homepage", onHomepage);
    document.documentElement.removeAttribute("zen-debug-empty");

    // Transient homepage: when you leave it for another tab, it closes.
    if (!onHomepage) {
      for (const tab of b.tabs) {
        if (tab === selected || tab.pinned) {
          continue;
        }
        if (isHomepage(tab)) {
          b.removeTab(tab);
        }
      }
    }
  } catch (e) {
    /* never break the browser chrome */
  }
}

function init() {
  // Navigations inside the same tab
  try {
    const listener = {
      onLocationChange: update,
      onStateChange: function () {},
      onProgressChange: function () {},
      onStatusChange: function () {},
      onSecurityChange: function () {},
      onLinkAddURI: function () {},
      QueryInterface: ChromeUtils.generateQI([
        Ci.nsIWebProgressListener,
      ]),
    };
    window.gBrowser.addProgressListener(listener);
  } catch (e) {
    /* pass */
  }

  // Tab switches, opens and closes (last tab closed -> empty tab -> homepage)
  try {
    window.gBrowser.tabContainer.addEventListener("TabSelect", update, false);
    window.gBrowser.tabContainer.addEventListener("TabClose", update, false);
    window.gBrowser.tabContainer.addEventListener("TabOpen", update, false);
  } catch (e) {
    /* pass */
  }

  // Safety net: check once a second (cheap reads, no timers beyond this).
  window.setInterval(update, 1000);

  update();
}

if (window.gBrowser) {
  init();
} else {
  window.addEventListener("load", init, { once: true });
}
