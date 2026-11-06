# Better Zen Homepage

Sine mod for Zen Browser. Makes a local homepage (`hey-diego.html`) behave
like Zen's blank page:

- **Empty url bar** on the homepage (no file path shown; the real input
  reappears when focused, so click / Ctrl+L / Ctrl+T work normally)
- **No open tab shown** on the homepage (sidebar stays visible: nav
  buttons, folders, workspaces)
- **Transient tab**: the homepage tab closes itself when you switch to
  another tab (unless pinned)
- **Auto-open**: when the last tab is closed (Zen's empty tab) or a new
  empty tab appears, the homepage opens automatically

Requires the companion CSS in `userChrome.css`:

```css
:root[zen-homepage] #urlbar:not([focused="true"]):not([zen-floating-urlbar]) #urlbar-input {
  color: transparent !important;
  caret-color: transparent !important;
}
:root[zen-homepage] #urlbar:not([focused="true"]):not([zen-floating-urlbar]) #identity-box {
  display: none !important;
}
:root[zen-homepage] #urlbar:not([focused="true"]):not([zen-floating-urlbar]) .urlbar-input-container {
  position: relative !important;
}
:root[zen-homepage] #urlbar:not([focused="true"]):not([zen-floating-urlbar]) .urlbar-input-container::before {
  content: "Search..." !important;
  position: absolute !important;
  left: 12px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  color: #9a9a9a !important;
  font-size: 13px !important;
  pointer-events: none !important;
}
:root[zen-homepage] .tabbrowser-tab[selected] {
  display: none !important;
}
:root[zen-homepage] .zen-workspace-close-unpinned-tabs-button,
:root[zen-homepage] .pinned-tabs-container-separator {
  display: none !important;
}
```

Install via Sine (in-browser mod manager) from this repo, with
"Allow external JavaScript" enabled in Sine settings.
