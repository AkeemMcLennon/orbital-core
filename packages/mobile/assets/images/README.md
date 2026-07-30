# Image assets

Most files here are Orbital's own artwork. The provider sign-in logos are **not** — they are
unmodified vendor artwork whose use is governed by each vendor's branding guidelines.

## Vendor sign-in logos — do not edit, crop, recolor or resize

| File                     | Vendor | Source                                                                                  | Original name                                        | Size    | sha256                                                             |
| ------------------------ | ------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `google-g-logo.png`      | Google | <https://developers.google.com/identity/images/g-logo.png>                              | `g-logo.png`                                         | 200×204 | `d1ce9c2af0b10a7333abc99bc706f9a6a199e5b65bf3e3009624f076b8638e6a` |
| `apple-siwa-logo.png`    | Apple  | <https://devimages-cdn.apple.com/design/resources/download/Logo-Sign-in-with-Apple.dmg> | `Logo - SIWA - Left-aligned - Black - Medium@1x.png` | 31×44   | `81bf5ed410b1adf3525b2c2977ec414145c21d4e6b76cc888506f10983d4d0dc` |
| `apple-siwa-logo@2x.png` | Apple  | same DMG                                                                                | `Logo - SIWA - Left-aligned - Black - Medium@2x.png` | 62×88   | `9164dbb62a9f7e3b8f5cd5ac6e5cfc71ed6390e5b8451d1dcedf156cff4b4b52` |
| `apple-siwa-logo@3x.png` | Apple  | same DMG                                                                                | `Logo - SIWA - Left-aligned - Black - Medium@3x.png` | 93×132  | `2e188ce3061c80cdb829918b17f523bd0ac1082de67901159b4ff6f574b5f77a` |

Verify at any time with:

```bash
cd packages/mobile/assets/images
sha256sum google-g-logo.png apple-siwa-logo.png apple-siwa-logo@2x.png apple-siwa-logo@3x.png
```

Consumers: `src/components/GoogleSignInButton.tsx`,
`src/components/AppleSignInButton.tsx`, and the Google Contacts card in
`app/contacts/import.tsx` (via `SourceCard`'s `logo` prop).

## Guidelines

- Google — <https://developers.google.com/identity/branding-guidelines>. The standard
  full-color "G" is mandatory: monochrome versions, recolored versions, self-drawn icons, and
  placing the G on a non-white background are all explicitly prohibited, as is changing its
  size or color. The light-theme button is `#FFFFFF` fill, `#747775` 1px stroke, `#1F1F1F`
  text, with a 20pt logo.
- Apple — <https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple>.
  Custom buttons are permitted, but App Review evaluates them. Within a button the logo and
  title must both be either black or white — no custom colors. Only these downloaded logo
  files may be used; never redraw the Apple logo. Match the logo file's height to the
  button's height, don't crop it, and don't add vertical padding. Title font size must be 43%
  of the button height.

## Gotchas discovered while adding these

- **`google-g-logo.png` is 200×204, not square.** Its ink bleeds to all four edges, so the
  aspect ratio is `200 / 204 ≈ 0.9804`. Render it as `{ height: 20, aspectRatio: 200 / 204 }`,
  which gives 19.61 × 20 and matches the 19.67 × 20.00 measured in Google's own official
  188×44 iOS button. A square 20×20 box would squash it by 2%.
- **The Apple files are 100% opaque, with a baked-in background.** "Black" in Apple's naming
  means a _black glyph on a solid white background_ — the variant for white buttons. The
  sibling `White` files are a _white glyph on solid black_, for black buttons. Because the
  image paints a solid white rectangle, its height must equal the button's **content** height
  (button height minus twice the border width), or it will overpaint the button's top and
  bottom border rows and leave a visible gap in the outline.
- The Apple glyph sits slightly high inside its padding (`padT` 10, `padB` 14 at @1x). That is
  Apple's own optical centering — do not "correct" it.
- Both `<Image>`s must set `accessibilityIgnoresInvertColors`, or iOS Smart Invert will
  recolor the marks, which is exactly what both vendors prohibit.

## Re-obtaining the Apple artwork

Apple ships it as a `.dmg`, which needs no authentication to download but is awkward to open
off macOS. The image is UDZO: read the 512-byte `koly` trailer at EOF, take the XML plist
offset/length from bytes `0xD8..0xE8`, walk `resource-fork.blkx`, and inflate each chunk
(type `0x80000005` is zlib-deflated) at `dataForkOffset + chunkOffset` to reconstruct the raw
HFS+ image; the PNG blobs can then be carved between the `\x89PNG` signature and `IEND`.
Identify the right ones by dimensions (31×44, 62×88, 93×132) **and** by checking that pixel
`(0,0)` is white while the center is black — the black-background variant has identical
dimensions and is the wrong file. Verify against the sha256s above before committing.

This was deliberately not scripted: it is a one-shot job, and the byte-offset carving would
silently select the wrong variant if Apple ever reorders the archive.
