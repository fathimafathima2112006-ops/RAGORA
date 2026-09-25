RAGORA ACTUAL UI FIX

Replace these 3 files in the existing GitHub project:
1. templates/chat.html
2. static/css/ux_patch.css (new)
3. static/js/ui_boot.js (new)

Do NOT replace the whole project.

Why:
The current static/js/chat.js calls renderView('chat') at the end but does not define renderView.
That JavaScript error leaves #appView empty, which is why the desktop screenshot shows only the shell and no welcome UI, cards, or composer.

This patch:
- restores the view router
- shows the 4 topic cards
- restores the bottom chat composer
- fixes light/dark theme initialization
- fixes mobile sidebar overlay/blur
- binds document upload controls
- supports selecting multiple files
- keeps the existing backend/API and chunk modal code
