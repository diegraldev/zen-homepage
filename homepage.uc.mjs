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
// Empty tabs (about:newtab / about:blank / about:home) auto-open the
// homepage, so closing everything lands back on it.

const TARGET_URL = "file:///home/diegral/Documents/hey-diego.html";
const TARGET_PREFIX = "file:///home/diegral/Documents/hey-diego";
const EMPTY_URIS = ["about:newtab", "about:blank", "about:home"];

function isHomepage(tab) {
  try {
    const uri =
      tab.linkedBrowser &&
      tab.linkedBrowser.currentURI &&
      tab.linkedBrowser.currentURI.spec;
    return !!uri && uri.startsWith(TARGET_PREFIX);
  } catch (e) {
    return false;
  }
}

function isEmptyTab(tab) {
  try {
    const uri =
      tab.linkedBrowser &&
      tab.linkedBrowser.currentURI &&
      tab.linkedBrowser.currentURI.spec;
    return !!uri && EMPTY_URIS.some((u) => uri === u || uri.startsWith(u + "?"));
  } catch (e) {
    return false;
  }
}

function update() {
  try {
    const b = window.gBrowser;
    if (!b) {
      return;
    }
    const selected = b.selectedTab;

    // No real tab open (fresh new tab / all closed): open the homepage.
    if (isEmptyTab(selected)) {
      b.loadURI(TARGET_URL, {
        triggeringPrincipal: Services.scriptSecurity.getSystemPrincipal(),
      });
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

  // Tab switches and closes (last tab closed -> empty tab -> homepage)
  try {
    window.gBrowser.tabContainer.addEventListener("TabSelect", update, false);
    window.gBrowser.tabContainer.addEventListener("TabClose", update, false);
  } catch (e) {
    /* pass */
  }

  update();
}

if (window.gBrowser) {
  init();
} else {
  window.addEventListener("load", init, { once: true });
}
