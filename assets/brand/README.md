# Daily logo

A rounded D silhouette uses a transparent check-shaped counter and the project's existing sage green.

- `logo.svg`: Horizontal wordmark on a transparent background, with lettering converted to paths.
- `symbol.svg`: Standalone transparent symbol; recommended minimum display size: 16 × 16 px.
- `app-icon.svg`: Application icon on a green rounded-square background.
- `logo.png`, `symbol.png`, `app-icon.png`: Transparent PNG exports.
- `preview.png`: Preview of the primary logo, application icon, reversed colors, and small sizes.
- `concept.png`: Shape exploration generated with the built-in imagegen tool; the final SVG assets are manually refined flat vectors.

The primary color is `#5C7664`, the wordmark is `#252A30`, and the reversed color is `#FFFFFF`. Preserve the SVG canvas padding. For reversed use, make both the symbol and wordmark white while keeping the check-shaped counter transparent.

The wordmark is based on Avenir Next Demi Bold and has been converted to paths. The application and sign-in page use `dist/logo.svg`; the favicon and sign-in card use `dist/icon.svg`, derived from the application icon.

## Generation and prompt

The built-in imagegen tool was used for shape exploration, followed by native SVG path refinement and PNG exports. No API or CLI image generation was used.

> Use case: logo-brand. Create ONE finished standalone symbol for Daily, a quiet, minimal personal tasks-and-calendar web app. Existing identity uses muted sage green #5c7664 and abundant white space. Primary request: a beautiful, original, highly memorable geometric D monogram whose inner negative space subtly suggests a completion check. Design as a confident filled flat silhouette with rounded optical corners, a straight left spine and generously rounded right bowl. The check-shaped transparent counter should be optically balanced and recognizable, with its rising diagonal relating naturally to the upper right contour. Aim for the simplicity of a premium independent productivity app, warm and calm, neither corporate nor playful. It must work as a 16–32px favicon and a 32px website brand mark. Use exactly one ink: muted deep sage #5c7664. Edges must be perfectly crisp, restrained and vector-friendly. Composition: ONE symbol centered large, with generous transparent padding. No lettering, no captions, no D text written separately, no frames, no rounded-square app tile, no mockups, no gradients, no shadows, no texture, no glass, no 3D, no sparkles, no leaves, no disconnected decorative elements, no extra variations or presentation board. Actual transparent background.
