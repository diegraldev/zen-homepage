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
// NOTE: about:blank is intentionally NOT here — every new tab is born as
// about:blank before its real navigation, and hijacking those breaks
// Ctrl+T / new-tab navigation. Only Zen's own empty tab (zen-empty-tab
// attribute) and true new-tab pages count as "empty".
const EMPTY_URIS = ["about:newtab", "about:home"];

let loadingHomepage = false;

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

// Navigate to the homepage exactly once per empty state: reuse an
// existing homepage tab if there is one, otherwise create a trusted
// tab (no principal needed) and select it, then drop the empty one.
function loadHomepage(tab) {
  if (loadingHomepage) {
    return;
  }
  loadingHomepage = true;
  window.setTimeout(() => {
    loadingHomepage = false;
  }, 2000);

  const b = window.gBrowser;
  try {
    const existing = b.tabs.find((t) => isHomepage(t));
    if (existing) {
      if (existing !== b.selectedTab) {
        b.selectedTab = existing;
      }
      if (tab && tab !== existing) {
        b.removeTab(tab);
      }
      return;
    }
    const nt = b.addTrustedTab(TARGET_URL);
    if (nt) {
      b.selectedTab = nt;
      if (tab && tab !== nt) {
        b.removeTab(tab);
      }
    }
  } catch (e) {
    /* never break the browser chrome */
  }
}

function openHomepageTab() {
  if (loadingHomepage) {
    return;
  }
  loadingHomepage = true;
  window.setTimeout(() => {
    loadingHomepage = false;
  }, 2000);
  try {
    const nt = window.gBrowser.addTrustedTab(TARGET_URL);
    if (nt) {
      window.gBrowser.selectedTab = nt;
    }
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

    // No tabs at all, or the selected tab is an empty/new tab:
    // open the homepage.
    if (!selected || b.tabs.length === 0) {
      openHomepageTab();
      return;
    }
    if (isEmptyTab(selected)) {
      loadHomepage(selected);
      return;
    }

    const onHomepage = isHomepage(selected);
    document.documentElement.toggleAttribute("zen-homepage", onHomepage);

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
