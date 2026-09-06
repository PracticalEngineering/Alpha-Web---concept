# α alpha-web

A growing web of knowledge for independent, playful learning.
It has a beginning (α) – but no end.

**Current version:** Math from grade 5 to grade 12 (63 topics, 250+ discovery exercises with layered hints), plus the first physics and computer-science regions. At the research frontier, Newton, energy, programming, cryptography and university math are already waiting.

## Try it now

Double-click `index.html` – it runs directly in the browser, no installation, even offline.
Progress is saved in the browser (localStorage).

## The idea

- **Think first:** every exercise is a small discovery. Stuck? Take hints – layer by layer, until it becomes obvious. Hints cost nothing.
- **Freedom:** each completed topic opens new regions. Learners choose where to explore next – and discover their own interests.
- **Bubble states:** hidden (???) → grey/ready → colourful (in progress) → colourful ✓ (completed) → **golden ★** (completed along with everything that builds on it).
- **Review:** a random sample from everything you've learned, Duolingo-style.
- **Quick Check:** for newcomers who already know things – one sample question per reachable topic; correct = topic counts as explored.

## Publish for free with GitHub Pages

1. Create a free account at [github.com](https://github.com).
2. Top right **+** → **New repository** → name it e.g. `alpha-web` → **Public** → **Create repository**.
3. On the repo page click **uploading an existing file** and drag in everything from this folder (`index.html`, `style.css`, the `js` and `data` folders, `README.md`) → **Commit changes**.
4. **Settings** → **Pages** (left menu) → under *Build and deployment*: Source = **Deploy from a branch**, Branch = **main**, folder = **/ (root)** → **Save**.
5. After about a minute your site is live at:
   `https://YOUR-NAME.github.io/alpha-web/`

Share that link freely – it's free, with no meaningful limits for a site this size.
(Alternative: [Netlify Drop](https://app.netlify.com/drop) – drag & drop the folder; the free plan is enough too.)

## Growing the web

All content lives in `data/curriculum.js`. A topic looks like this:

```js
{
  id: "my-topic", title: "My Topic", klasse: 7, area: "zahlen",
  x: 100, y: -300,                 // position in the web
  requires: ["zaehlen"],           // builds on ...
  teaser: "A curiosity-sparking question?",
  desc: "What it's about.",
  exercises: [
    { q: "Question?", type: "number", answer: 42,
      hints: ["Gentle nudge.", "Clearer hint.", "Almost the solution."],
      why: "The insight behind it." },
    // type: "choice" (choices + answer = index) or "text" (answer = string)
  ]
}
```

New sciences = a new entry in `areas` + topics whose `requires` link into the existing web. The bubbles in `frontier` show where it can grow next – once a region gets real exercises, it moves from `frontier` to `topics`.
