# Accessibility

The challenge's core theme is reaching blind and low-vision users. In this
project accessibility is the point, not polish — and the backend contributes
directly to it.

## The sonification is the access feature
Earth science is presented almost entirely visually, which excludes blind and
low-vision audiences. Here the sound is the primary way to experience the data:
a blind user can experience the same climate trend a sighted user sees. The
mapping (colour→melody, brightness→octave/volume, intensity→rhythmic density,
position→pan, change→accent) is designed so the data's story is legible by ear.

## Data accessibility from the backend
- **Plain-language captions.** `extract_features.py` / `ingest_netcdf.py` emit a
  `captions` track — short, timed descriptions of what the data is doing
  ("intensity rising, activity moving east, a sharp change"). The frontend shows
  these and announces them through an `aria-live` region so a screen-reader user
  gets the same narrative off the data that a sighted viewer reads off the map.
- **Human description + provenance in every file.** `description` and
  `source_url` travel in `features.json` and `manifest.json`, so the UI can state
  what each visualization is and where the NASA data came from.
- **Fast everywhere.** Features are precomputed, so the app stays responsive on
  low-end devices and slow connections — an access concern in its own right.

## Frontend accessibility checklist (for the UI build)
- Semantic HTML with `role` and `aria-label` on the picker and transport.
- Full keyboard control: Tab to picker/Play, Space/Enter to toggle, arrows to
  switch visualizations, with a visible focus outline throughout.
- `aria-live` "now playing" + live caption line fed by the `captions` track.
- Honor `prefers-reduced-motion`: ease off canvas animation; the sound still
  carries the story.
- Describe the sonification itself as the access feature in the write-up/demo.

## NASA branding
No NASA logos, flags, or mission identifiers are generated or modified by any tool
in this project (SI-use rule compliance).
