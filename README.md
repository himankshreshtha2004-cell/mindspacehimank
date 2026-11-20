# Mindspace — spatial mind-mapping

React 18 + TypeScript + Vite + Framer Motion. No backend: everything is saved in the browser (localStorage key `mindspace.v2`).

## Run / build
    npm install
    npm run dev       # local dev server
    npm run build     # type-checks, then outputs a static site in dist/

`dist/` is fully static and uses relative paths, so it can be dropped into Netlify or any sub-folder (e.g. a portfolio's `projects/02-mindspace/`).

## Structure
- `src/state/` — data model (`types.ts`), demo workspace (`demo.ts`), store with undo/redo + autosave (`store.tsx`), graph maths: progress, search, bounds (`graph.ts`), UI state + camera (`ui.tsx`)
- `src/components/MindCanvas.tsx` — infinite canvas: nodes, curved SVG connections, groups, pointer/touch/pinch gestures, creation + relationship menus
- `src/components/ThoughtNode.tsx` — node rendering (orbs and pills)
- `src/components/Chrome.tsx` — sidebar, top bar, search, floating toolbar, mini-map
- `src/components/Panels.tsx` — detail panel / bottom sheet, expanded card, group dialog, focus toolbar
- `src/components/Views.tsx` — My Spaces, Projects, Goals, Inbox, Archived, Settings
- `src/components/Overlays.tsx` — toasts, confirm dialog, tooltips, help
- `src/App.tsx` — layout + keyboard shortcuts

## Known limitations
- Data lives in one browser only; use Export / Import JSON to move spaces between devices.
- Inside sandboxed previews that block downloads, Export also shows the JSON so it can be copied.
