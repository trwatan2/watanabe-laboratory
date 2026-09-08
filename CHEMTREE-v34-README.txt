ChemTree v34 — mobile recovery + paper links

IMPORTANT: upload ALL files in this ZIP to the ROOT of the RESEARCH LAB repository:
  trwatan2/watanabe-laboratory
Do NOT upload them to trwatan2.github.io (lecture site).

Why v33 failed on phones:
1) chemtree-App.js imports ./CameraFocus.js and ./GrowthGlow.js, but the v33 ZIP used different filenames.
   A PC could still work if old files remained cached/on GitHub, while a fresh phone load failed.
2) The full 3D + compressed dataset path was still too fragile/heavy for mobile.

v34 behavior:
- Phone/tablet -> chemtree-mobile.html (lightweight, no WebGL, no external libraries)
- Desktop -> existing 3D ChemTree
- Papers are clickable and open DOI/publisher pages
- Mobile data is reduced to ~3.4 MB uncompressed for reliability

Main URL remains:
https://trwatan2.github.io/watanabe-laboratory/chemtree-app.html?v=34
