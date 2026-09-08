ChemTree v33 — Mobile + paper-link patch

Upload these files to the ROOT of:
  trwatan2/watanabe-laboratory

Files:
  chemtree-app.html
  chemtree-App.js
  chemtree-CameraFocus.js
  chemtree-GrowthGlow.js
  chemtree-fflate.js
  chemtree-1y.json.gz

Improvements:
- Mobile responsive layout (tree uses full screen; Topics/Papers/Reset bottom controls)
- Reduced mobile rendering load (lower DPR and fewer sparkles)
- iPhone/iPad-friendly gzip decompression via bundled fflate (no DecompressionStream dependency)
- Import-map compatibility helper for older Safari
- Recent paper titles are clickable; OPEN PAPER opens DOI/publisher URL in a new tab
- Existing PC interface remains intact

Public URL remains:
  https://trwatan2.github.io/watanabe-laboratory/chemtree-app.html
