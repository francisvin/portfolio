# Francis Vin — Portfolio

The personal portfolio of **Francis Vin**, web developer and graphic designer: a single-page site with a cinematic intro, an interactive student-ID card, an About section with résumé and skills, the **Pixelverse** design showcase, and a Contacts section.

**Live site:** https://francisvin.github.io/portfolio/ *(once GitHub Pages is enabled)*

## Highlights

- **Intro** — the name glitches from Korean to Japanese to English, resolves into the logo and zooms into the home page.
- **Home** — a draggable, physics-driven hanging student ID that flips to show its back.
- **About Me** — What I Do (stacked cards + marquee), Résumé (pop-up) with skills, and Tools I Use.
- **Pixelverse** — a curved 3D carousel of designs; click the centre design to flip it for its details.
- **Design Gallery** — a separate page with every design in a masonry grid and a full-screen viewer.
- **Contacts** — a WebGL "symbiote" that crawls on the *Let's Connect* button and reaches for the cursor, plus a flippable business card.

## Tech

Plain **HTML, CSS and JavaScript** — no frameworks, no build step and no dependencies to install. Fonts load from Google Fonts; everything else is in this repository.

## Project structure

```
index.html          entry page (opens portfolio.html)
portfolio.html      the main single-page portfolio
portfolio.css       styles for the main page
portfolio.js        main page behaviour (intro, ID card, carousel, modals, …)
symbiote.js         WebGL symbiote effect for the Contacts button
designs.js          the Pixelverse design list, shared by the carousel and the gallery
gallery.html/.css/.js   the Design Gallery page
img/                images, icons and media
img/pixelverse/     original design files
img/pixelverse/web/ lightweight copies used by the site (thumb/ for cards)
tools/make-web-images.py   creates the lightweight copies for new designs
```

## Run locally

No installation needed — open `portfolio.html` in a browser.

For everything to work exactly as online (including the Design Gallery picking up newly added images automatically), serve the folder with any local server, for example:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

or use the *Live Server* extension in VS Code.

## Adding a new design

1. Put the image in `img/pixelverse/`.
2. Create its lightweight copies (needs Python and Pillow: `pip install pillow`):
   ```bash
   python tools/make-web-images.py
   ```
3. Add an entry for it in `designs.js` (file name, title, category, description, details).

On GitHub Pages the carousel and gallery show the designs listed in `designs.js`.

## Deployment

The site is static, so GitHub Pages can serve it directly from the `main` branch: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)`**.

## Author

**Francis Vin** — [github.com/francisvin](https://github.com/francisvin)
