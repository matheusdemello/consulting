# Consulting site

Static bilingual site for GitHub Pages. No build step or production JavaScript dependencies. English: `/consulting/`. Japanese: `/consulting/jp/`.

## Local preview

Run `node tests/serve.cjs`, then open http://127.0.0.1:8765/consulting/. The server binds only to loopback and reproduces the GitHub Pages base path. Tests are development tooling, not part of the site's runtime.

## Contact activation

The form is intentionally disconnected and its Send button disabled. No message is sent or stored by the site in this state. To activate:

1. Create and configure a Formspree form in your account.
2. Put its full `https://formspree.io/f/<form-id>` endpoint in `data-endpoint` on `#contact-form` in both HTML pages.
3. Review the adjacent privacy text and Japanese copy before publication.
4. Submit an authorized test through each real page and verify receipt in the configured destination. Also verify failures keep the message in the form. A simulated response is not delivery proof.

Submission requires a Formspree HTTPS endpoint and JavaScript. Inputs are disabled while sending. A request times out after 15 seconds; input is retained on failure and cleared only after an accepted response. The connected privacy disclosure replaces the preview disclosure automatically.

The request format follows [Formspree's documented fetch example](https://formspree.io/blog/formspree-ajax/): multipart form data with `Accept: application/json`. No Formspree library is loaded.

## Verification

Install Playwright in your development environment; it is not a runtime dependency. Run `node tests/site.cjs`. The suite defaults to installed Microsoft Edge; set `BROWSER_CHANNEL` to another installed Playwright browser channel if needed. It serves real files under `/consulting/` on a temporary loopback port.

Manual checks: English/Japanese at desktop and phone sizes; keyboard focus; system dark mode; reduced motion; no JavaScript; pause/resume; pointer attraction and hold-to-repel; old `projects.html` redirect. Real form delivery remains unverified until an endpoint is configured.

## Editing

- Content: `index.html` and `jp/index.html`.
- Layout and themes: `css/all.css`.
- Topic selection, contact behavior and header: `js/site.js`.
- Hero: `js/field.js`. A procedural, projected 3D field of moving directors; no object silhouettes or SVG targets. Moving the pointer attracts nearby directors; holding presses them away. `i/field-still.svg` provides the no-JavaScript fallback.
- Existing portrait: `i/favicon.png`. New small site icon: `i/mark.svg`.

The dipole-inspired animation is an illustration, not a research simulation. It pauses off-screen and in hidden tabs. Reduced motion uses a static frame. Fonts are requested from Google Fonts; system fallbacks preserve readability if unavailable. There are no analytics scripts.

GitHub Pages deploys the repository root on `main` to https://matheusdemello.github.io/consulting/. A push to `main` triggers publication.
