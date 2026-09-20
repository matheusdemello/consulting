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

Install Playwright in your development environment; it is not a runtime dependency. Run `node tests/site.cjs`, `node tests/field-quality.cjs`, and `node tests/studies.cjs`. The field suite checks that the entrance plays once per tab session and that the mouse wake persists briefly, then disappears completely. The studies suite opens every case and switches its illustration views by keyboard with JavaScript disabled, in both languages. The suites default to installed Microsoft Edge; set `BROWSER_CHANNEL` to another installed Playwright browser channel if needed. They serve real files under `/consulting/` on a temporary loopback port.

Manual checks: English/Japanese at desktop and phone sizes; keyboard focus; system dark mode; reduced motion; no JavaScript; pause/resume; pointer attraction and hold-to-repel; old `projects.html` redirect. Regression tests block real Formspree submissions and intercept a synthetic endpoint to check success and failure.

## Editing

- Content: `index.html` and `jp/index.html`.
- Layout and themes: `css/all.css`.
- Topic selection, contact behavior and header: `js/site.js`.
- Hero: `js/field.js`. A procedural, projected 3D field of moving directors; no object silhouettes or SVG targets. Moving the pointer attracts nearby directors; holding presses them away. The field uses 5,400 strokes on larger canvases and 2,600 on narrow canvases, with a precomputed teal, vermilion and amber palette. `i/field-still.svg` provides the no-JavaScript fallback.
- Existing portrait: `i/favicon.png`. New small site icon: `i/mark.svg`.
- Project details use native HTML disclosures and inline SVG diagrams, styled in `css/studies.css`. Radio controls select diagram layers and explanations through CSS, so they work without JavaScript. The illustrations use synthetic geometry, not client records, patient scans, or measured results. Project content is presented by problem and outcome, rather than employment history.

The dipole-inspired animation is an illustration, not a research simulation. Teal recedes into the back of the volume, vermilion follows the folds, and amber highlights the foreground. Moving the cursor leaves a warm, aligned wake that fades. The initial gathering lasts 1.2 seconds of visible animation time; session storage remembers completion in that tab. If storage is unavailable, the animation still works, with the entrance once per page load. It pauses off-screen and in hidden tabs. Reduced motion skips the entrance and wake and uses a static frame. Fonts are requested from Google Fonts; system fallbacks preserve readability if unavailable. There are no analytics scripts.

GitHub Pages deploys the repository root on `main` to https://matheusdemello.github.io/consulting/. A push to `main` triggers publication.
