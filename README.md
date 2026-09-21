# Consulting site

Static bilingual site for GitHub Pages. No build step or production JavaScript dependencies. English: `/consulting/`. Japanese: `/consulting/jp/`.

## Local preview

Run `node tests/serve.cjs`, then open http://127.0.0.1:8765/consulting/. The server binds only to loopback and reproduces the GitHub Pages base path. Tests are development tooling, not part of the site's runtime.

## Contact activation

Both languages use the owner's Formspree endpoint, `https://formspree.io/f/xoevjdrw`. The receiving email stays in Formspree, outside the repository. When changing the endpoint:

1. Create and configure a Formspree form in your account.
2. Put its full `https://formspree.io/f/<form-id>` endpoint in both `data-endpoint` and `action` on `#contact-form` in both HTML pages.
3. Review the adjacent privacy text and Japanese copy before publication.
4. Submit an authorized test through each real page and verify receipt in the configured destination. Also verify failures keep the message in the form. A simulated response is not delivery proof.

Submission requires a Formspree HTTPS endpoint and JavaScript. Inputs are disabled while sending. A request times out after 15 seconds; input is retained on failure and cleared only after an accepted response. The connected privacy disclosure appears automatically. Configure a verified recipient under Formspree's email workflow action for inbox notifications; the submission archive and email delivery are separate checks.

The request format follows [Formspree's documented fetch example](https://formspree.io/blog/formspree-ajax/): multipart form data with `Accept: application/json`. No Formspree library is loaded.

## Verification

Install Playwright in your development environment; it is not a runtime dependency. Run `node tests/site.cjs`, `node tests/field-quality.cjs`, and `node tests/studies.cjs`. The field suite checks that the entrance plays once per tab session and that the mouse wake persists briefly, then disappears completely. The studies suite moves through the project rail by keyboard and switches each illustration's views, with JavaScript disabled, in both languages. The suites default to installed Microsoft Edge; set `BROWSER_CHANNEL` to another installed Playwright browser channel if needed. They serve real files under `/consulting/` on a temporary loopback port.

Manual checks: English/Japanese at desktop and phone sizes; keyboard focus; system dark mode; reduced motion; no JavaScript; pause/resume; pointer attraction and hold-to-repel; old `projects.html` redirect; swiping the project rail on a touch screen. Regression tests block real Formspree submissions and intercept a synthetic endpoint to check success and failure.

## Editing

- Content: `index.html` and `jp/index.html`.
- Layout and themes: `css/all.css`.
- Topic selection, contact behavior, project-rail arrows and header: `js/site.js`.
- Hero: `js/field.js`. A procedural, projected 3D field of moving directors; no object silhouettes or SVG targets. Moving the pointer attracts nearby directors; holding presses them away. The field uses 5,400 strokes on larger canvases and 2,600 on narrow canvases, with a precomputed teal, vermilion and amber palette. `i/field-still.svg` provides the no-JavaScript fallback.
- Portrait: `i/portrait.webp`, a 720px WebP (27KB) made from the full-size original `i/favicon.png`, which the pages no longer load. Small site icon: `i/mark.svg`.
- Projects sit in a horizontal rail of cards, with the selected project's detail open in one panel below it. A radio group carries the selection and `:has()` reveals the matching panel, so the rail works without JavaScript; native scroll-snap handles swiping and the arrow keys move between cards. Under the rail, one dot per project selects it by pointer, also without JavaScript. `js/site.js` only adds the prev/next buttons, the fade at whichever end still has cards behind it, and `#work-<project>` deep links. Where `:has()` is unavailable, every panel shows at once.
- The robotics case is text only; the other cases include inline SVG diagrams styled in `css/studies.css`. Radio controls select diagram layers and explanations through CSS, so they work without JavaScript. The illustrations use synthetic geometry, not client records, patient scans, or measured results. Project content is presented by problem and outcome, rather than employment history.

The dipole-inspired animation is an illustration, not a research simulation. Teal recedes into the back of the volume, vermilion follows the folds, and amber highlights the foreground. Moving the cursor leaves a warm, aligned wake that fades. The initial gathering lasts 1.2 seconds of visible animation time; session storage remembers completion in that tab. If storage is unavailable, the animation still works, with the entrance once per page load. It pauses off-screen and in hidden tabs. Reduced motion skips the entrance and wake and uses a static frame. Fonts are requested from Google Fonts; system fallbacks preserve readability if unavailable. There are no analytics scripts.

## Search

- Titles carry the searchable terms (`AI & Machine Learning Consultant in Tokyo`, `東京のAI・機械学習 技術コンサルタント`). The headline and link-preview title keep the brand line.
- Each page's head has one JSON-LD block (`ProfessionalService`, `Person`, `WebSite`) that shares entity ids across both languages. It must never carry an email, phone number, street address or postal code; `tests/site.cjs` fails if it does.
- `sitemap.xml` lists both pages with reciprocal `hreflang`. There is no `matheusdemello.github.io` user-site repository, so the host root has no robots.txt and cannot point to the sitemap. Submit it by hand: in Google Search Console, add a URL-prefix property for `https://matheusdemello.github.io/consulting/`, verify it (HTML tag or file), then submit `sitemap.xml`. Yahoo! JAPAN uses Google's index, so this covers it too.
- Link previews use `i/og.png` and `i/og-jp.png` (1200x630). Regenerate them with `node tools/og-image.cjs` after changing the hero copy.

GitHub Pages deploys the repository root on `main` to https://matheusdemello.github.io/consulting/. A push to `main` triggers publication.
