# RAGORA Pro UI Upgrade

This is a drop-in UI/UX enhancement for the existing Flask RAGORA app.

## Included
- Cleaner Google account card + separate Logout button
- Voice playback for every AI answer
- Auto-voice toggle
- Voice language selector using browser Speech Synthesis
- Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, Gujarati, Punjabi,
  Urdu, Arabic, French, German, Spanish, Italian, Portuguese, Russian, Japanese,
  Korean, Chinese, Indonesian and English presets
- Helpful / Improve feedback buttons (stored locally in the browser)
- Source cards remain compact; tapping/clicking opens full evidence details
- Animated ambient effects and polished voice player
- Mobile-friendly controls

## Install into the current repo

1. Copy:
   static/css/pro_upgrade.css
   -> RAGORA/static/css/pro_upgrade.css

2. Copy:
   static/js/pro_upgrade.js
   -> RAGORA/static/js/pro_upgrade.js

3. In templates/chat.html, immediately before </head>, add:
   <link rel="stylesheet" href="{{ url_for('static', filename='css/pro_upgrade.css', v='pro1') }}">

4. Immediately before </body>, after chat.js, add:
   <script src="{{ url_for('static', filename='js/pro_upgrade.js', v='pro1') }}"></script>

No Python dependency changes are required.

Note:
Browser speech playback can only use languages/voices exposed by the user's device/browser.
The language selector chooses the voice locale; it does not translate an answer.
