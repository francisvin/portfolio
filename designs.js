/* ==========================================================================
   designs.js — the Pixelverse collection, shared by portfolio.html (3D carousel)
   and gallery.html (Design Gallery), so both always show the same designs.

   Every design image lives in img/pixelverse/. Lightweight copies for the web live
   in img/pixelverse/web/ (full view) and img/pixelverse/web/thumb/ (cards); if a
   copy is missing, the original image is used instead.

   Each entry: file (name in img/pixelverse/), title, category, description,
   details ("format | technique"). Images found in the folder that are not listed
   here are still shown, titled from their file name (see loadPixelverse below).
   ========================================================================== */

const PIXELVERSE_FOLDER = 'img/pixelverse/';

const designItems = [
  // ----- existing designs (original details preserved) -----
  { file: 'Ryomen Sukuna.png', title: 'Ryomen Sukuna', category: 'Character Artwork',
    description: 'A bold character-focused composition built around contrast, texture, and dramatic visual weight.',
    details: 'Character artwork | Digital composition' },
  { file: 'Megumi Fushiguro.png', title: 'Megumi Fushiguro', category: 'Character Artwork',
    description: 'A moody portrait design that uses restrained color and layered imagery to create atmosphere.',
    details: 'Character artwork | Digital composition' },
  { file: 'ZENITY - PPT.png', title: 'Zenity Presentation', category: 'Presentation Design',
    description: 'A presentation visual system designed to make wellness information clear, approachable, and cohesive.',
    details: 'This is for school purposes | Presentation design | Zenity project' },
  { file: 'ZENITY - LOGO.png', title: 'Zenity', category: 'Logo Design',
    description: 'A clean identity mark for Zenity, created to communicate calm, clarity, and balance.',
    details: 'This is for school purposes | web photo design' },
  { file: 'Marine Protected Areas (MPA) poster.png', title: 'Marine Protected Areas Poster', category: 'Poster Design',
    description: 'An informational poster that turns an environmental topic into an accessible visual message.',
    details: 'This is for school purposes | Poster design | Information design' },

  // ----- new designs -----
  { file: 'Akira.png', title: 'Akira', category: 'Character Artwork',
    description: 'A clean line-art portrait of a long-haired woman set against bold red display lettering.',
    details: 'Portrait poster | Digital illustration' },
  { file: 'akari.png', title: 'Akari', category: 'Poster Design',
    description: 'A red-themed poster of a sword-bearing figure in a floral conical hat and flowing white garment.',
    details: 'Portrait poster | Digital composition' },
  { file: 'Blurry.png', title: 'Blurry', category: 'Poster Design',
    description: 'A red, typography-led poster that layers distorted lettering over a blurred portrait.',
    details: 'Portrait poster | Photo manipulation & typography' },
  { file: 'brave soul.png', title: 'Brave Soul', category: 'Poster Design',
    description: 'A cool-toned fantasy poster of an armored knight among ice crystals, with large lettering behind.',
    details: 'Portrait poster | Digital composition' },
  { file: 'CHA EUN AE.png', title: 'Cha Eun Ae', category: 'Character Artwork',
    description: 'An illustrated back-view character portrait framed by large burnt-orange letterforms.',
    details: 'Portrait poster | Digital illustration' },
  { file: 'cue ball.png', title: 'Cue Ball', category: 'Typography',
    description: 'A minimalist black-and-white poster pairing outlined “CUE” lettering with an 8-ball and a billiard table.',
    details: 'Portrait poster | Minimalist typography' },
  { file: 'Jumbo bread.png', title: 'Jumbo Bread', category: 'Advertisement Design',
    description: 'A bright food advertisement pairing a loaded sandwich with bold headline type and a price badge.',
    details: 'Portrait ad | Photo composite & typography' },
  { file: 'lalalalisa.png', title: 'Lalalisa', category: 'Poster Design',
    description: 'A square poster giving a portrait photo a red halftone treatment with signature and graphic accents.',
    details: 'Square poster | Halftone photo treatment' },
  { file: 'LISA - chillain like a villain.png', title: 'Lisa – Chillin’ Like a Villain', category: 'Poster Design',
    description: 'A red editorial poster combining a portrait photo with condensed headline type and a selection-frame motif.',
    details: 'Portrait poster | Photo manipulation & typography' },
  { file: 'Lisa Manoban.png', title: 'Lisa Manoban', category: 'Poster Design',
    description: 'A chrome-textured poster where large metallic letters frame a portrait photo.',
    details: 'Portrait poster | Photo manipulation & typography' },
  { file: 'LISA - Press play.png', title: 'Lisa – Press Play', category: 'Character Artwork',
    description: 'An arcade-themed illustrated portrait in pastel purple tones with game-style interface details.',
    details: 'Portrait poster | Digital illustration' },
  { file: 'Marine Protected Area Poster 2.png', title: 'Marine Protected Areas Poster 2', category: 'Poster Design',
    description: 'An ocean-blue poster featuring a whale and the MPA lettermark for Marine Protected Areas.',
    details: 'Portrait poster | Information design' },
  { file: 'Rockstar.png', title: 'Rockstar', category: 'Poster Design',
    description: 'A monochrome Y2K-style poster with chrome star shapes and layered portrait photography.',
    details: 'Portrait poster | Photo manipulation & typography' },
  { file: 'Spidey shirt.png', title: 'Spider-Man Shirt', category: 'Apparel Design',
    description: 'A promotional graphic presenting a red-and-black jersey design inspired by the Spider-Man suit.',
    details: 'Square promotional graphic | Apparel mockup' },
  { file: 'SUL-HEE.png', title: 'Sul-Hee', category: 'Character Artwork',
    description: 'An illustrated character portrait over bold blue lettering with a handwritten script accent.',
    details: 'Portrait poster | Digital illustration' },
  { file: 'TYPOGRA-MEME.png', title: 'Typogra-Meme', category: 'Typography',
    description: 'A playful typographic poster built around a street-sign visual and short punchy phrases.',
    details: 'Portrait poster | Typographic composition' },
  { file: 'TYPOGRAPHY - Be YOU-NIQUE.png', title: 'Be You-nique', category: 'Typography',
    description: 'A typographic poster where one red figure stands out from a crowd beneath bold serif lettering.',
    details: 'Portrait poster | Typographic composition' },
  { file: 'TYPOGRAPHY - GROW.png', title: 'Grow', category: 'Typography',
    description: 'A purple gradient poster with oversized stacked letters built around the idea of growth.',
    details: 'Portrait poster | Typographic composition' },
  { file: 'YOUNG-RAN.png', title: 'Young-Ran', category: 'Character Artwork',
    description: 'A red monochrome character illustration layered over an enlarged close-up of the same face.',
    details: 'Portrait poster | Digital illustration' }
].map(d => Object.assign({ src: PIXELVERSE_FOLDER + d.file, web: true }, d));

/* ---------- image paths: light web copies, falling back to the original ---------- */

function pixelverseStem(src) {
  const name = decodeURIComponent(String(src).split('/').pop().split('?')[0]);
  return name.replace(/\.[^.]+$/, '');
}

// size: 'thumb' (cards, carousel) or 'full' (full view)
function pixelverseImage(src, size) {
  const sub = size === 'thumb' ? 'web/thumb/' : 'web/';
  return PIXELVERSE_FOLDER + sub + encodeURIComponent(pixelverseStem(src)) + '.webp';
}

// <img> helper: the light copy when the design has one (falling back to the original
// if that copy is missing); newly added images load the original directly.
// onFail runs only if the original itself can't be loaded.
function setPixelverseImage(img, design, size, onFail) {
  const useOriginal = () => {
    img.onerror = onFail ? () => { img.onerror = null; onFail(); } : null;
    img.src = design.src;
  };
  if (design.web) {
    img.onerror = useOriginal;
    img.src = pixelverseImage(design.src, size);
  } else {
    useOriginal();
  }
}

/* ---------- the collection: listed designs + anything new in the folder ---------- */
/* When the site is served by a server that lists folders (VS Code Live Server,
   `python -m http.server`, Apache/nginx autoindex …), images dropped into
   img/pixelverse/ are found automatically. Elsewhere (opening the file directly,
   GitHub Pages …) the list above is used as is. */

const PIXELVERSE_IMAGE = /\.(png|jpe?g|webp|avif|gif)$/i;

// image file names directly inside a folder, read from the server's folder listing
async function listImageFolder(folder) {
  if (location.protocol === 'file:') return []; // browsers can't list folders for local files
  try {
    const res = await fetch(folder, { cache: 'no-store' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return [];
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const base = new URL(folder, location.href);
    const seen = new Set();
    const files = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = (a.getAttribute('href') || '').split('?')[0];
      if (!PIXELVERSE_IMAGE.test(href)) return;
      const url = new URL(href, base);
      // only files directly inside this folder (not sub-folders such as web/)
      const rest = url.pathname.slice(base.pathname.length);
      if (!url.pathname.startsWith(base.pathname) || rest.includes('/')) return;
      const file = decodeURIComponent(rest);
      if (!seen.has(file)) { seen.add(file); files.push(file); }
    });
    return files;
  } catch (e) {
    return [];
  }
}

let pixelversePromise = null;
function loadPixelverse() {
  if (!pixelversePromise) {
    pixelversePromise = Promise.all([
      listImageFolder(PIXELVERSE_FOLDER),
      listImageFolder(PIXELVERSE_FOLDER + 'web/thumb/')
    ]).then(([files, thumbs]) => {
      const hasWeb = new Set(thumbs.map(f => f.replace(PIXELVERSE_IMAGE, '').toLowerCase()));
      if (!files.length) return designItems.slice();
      const present = new Set(files.map(f => f.toLowerCase()));
      const listed = designItems.filter(d => present.has(d.file.toLowerCase()));
      const listedSet = new Set(designItems.map(d => d.file.toLowerCase()));
      const extra = files
        .filter(f => !listedSet.has(f.toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(f => ({
          file: f,
          src: PIXELVERSE_FOLDER + f,
          title: f.replace(PIXELVERSE_IMAGE, '').replace(/[-_]+/g, ' ').trim(),
          category: 'Design',
          description: '',
          details: '',
          // light copies made with tools/make-web-images.py are used automatically
          web: hasWeb.has(f.replace(PIXELVERSE_IMAGE, '').toLowerCase())
        }));
      return listed.concat(extra);
    });
  }
  return pixelversePromise;
}
