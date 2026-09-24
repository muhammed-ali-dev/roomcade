# Roomcade artwork

## Sources and what is editable

- `assets/room-original.png`: the original generated 1586 × 992 room painting. The UI embeds a compressed WebP copy as `roomArt`.
- `assets/room-ceiling-extension.png`: a generated 1086 × 1448 extension study using the original room as the edit target. The UI embeds a compressed WebP copy as `ceilingArt` and displays only its top 490 pixels for the ceiling.
- `petArt` in the HTML: the separately generated Roomcade House character, embedded as WebP.

These are AI-generated raster illustrations produced for this design, not a 3D room model or separately movable furniture. Firelight, flames, and embers are CSS layers. Extensions, recolors, and alternate room illustrations can be generated or painted, but perfect consistency is not automatic. Moving furniture independently requires separated layers/assets; camera rotation and actual 3D interactions require a 3D scene.

## Why there were gaps

The room image is sized to the available width and anchored at the bottom. Its natural height can be smaller than the content-driven room panel height. The resulting exposed top area previously showed a flat background color.

The updated implementation leaves the lower painting unchanged. It fills only that excess height with the new ceiling, cropping out all furniture from the extension study. This preserves the original fireplace and animation alignment. The ceiling's beams flex with the gap height; the original room and furniture are never stretched. The same dark-mode tint is applied to both layers.

The ceiling region uses the scenery container's width and height: `max(0, panelHeight - paintingHeight + 2px)`. The 2px overlap prevents a fractional-pixel seam. Desktop painting width is 100%; the existing narrow-screen composition uses 135% width and a -2% horizontal offset. Preserve matching geometry for both layers. CSS container units track content height changes without a resize listener.

## Extension prompt and method

Method: built-in image-generation editing, with `room-original.png` as the edit target. The lower portion of the returned extension study was not pixel-identical to the original, so the interface uses only its new ceiling and retains the original lower painting.

Prompt:

> Use case: precise-object-edit. Asset type: seamless extended background illustration for the Roomcade web app. Input image is the EDIT TARGET. Extend this existing cozy room painting UPWARD ONLY into a taller portrait canvas, approximately 3:4 width:height. Keep the entire original landscape image unchanged in the BOTTOM approximately 47% of the new canvas, spanning the full width; preserve exact composition, proportions, positions and appearance of fireplace, books, plant, lamp, chair, window, rug, floor and the entire lower room. Do not crop the original, zoom it, stretch it or move any furniture. Outpaint ONLY above its old top edge: continue the rounded warm timber architecture into a charming gently pitched wooden ceiling with a few chunky rounded rafters, softly textured warm plaster between them, consistent perspective and warm illumination. The new top must be fully painted edge to edge and blend continuously with the original top beam without a seam or blank strip. Same soft tactile clay/storybook style and earthy cozy colors. No extra furniture, characters, text, logos, borders or UI. Keep central ceiling area calm, no hanging lights or other focal objects. No new flames in the fireplace; the app adds those separately. The goal is additional vertical illustration overscan so the old room keeps its original width and its bottom position on a responsive screen. Preserve the original lower image as faithfully as possible.

## Verification boundary

The generated source was visually inspected. Runtime syntax, room switching, asset embedding, and the responsive gap calculation were checked programmatically. The current environment did not provide a browser executable for final screenshot QA; inspect the ceiling-to-room join in the actual browser at desktop and mobile widths before production.
