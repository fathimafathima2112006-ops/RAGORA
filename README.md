# RAGORA PRO Stability + UX v2

This package adds a safer AI-error UX plus extra UI polish without changing your Python dependencies.

## 1) Add the CSS
In `templates/chat.html`, before `</head>`:

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/pro_stability_ux.css', v='2') }}">
```

## 2) Add the JS
After `chat.js` and before `</body>`:

```html
<script src="{{ url_for('static', filename='js/pro_stability_ux.js', v='2') }}"></script>
```

## 3) Important AI-error change
The old global fetch patch should NOT show every 5xx as “AI service is temporarily busy”. This v2 patch only observes the response and does not replace the app's request flow.

The real permanent backend fix still needs the `/api/chat` route and Groq request layer to return structured errors, retry transient failures, and fall back safely. Do not add `RENDER_URL`; this is for the Vercel-only setup.

## UX included
- animated glass background
- AI online / working / offline status pill
- quick prompt chips
- voice playback + language selector
- stop-speaking dock
- answer Copy / Listen / Helpful / Improve controls
- local feedback storage
- light/dark theme toggle
- Ctrl/Cmd+K composer shortcut
- mobile responsive drawer/voice styling
- reduced-motion accessibility support

## Note
Voice playback uses the browser's speech synthesis. It changes spoken language/voice selection; it does not translate the answer text itself.
