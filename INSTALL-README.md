# ChemTree: GitHub Pages automatic daily update

This package makes the **public ChemTree** update automatically in GitHub Actions.
The PC does not need to be turned on.

## What happens every day

At approximately **06:10 JST** GitHub Actions runs:

1. Fetch the previous 365 days from Crossref for JACS / Nature / Science / Chem.
2. Filter Nature / Science to chemistry-related papers.
3. Enrich/classify with OpenAlex.
4. Recalculate 1M / 3M / 6M / 1Y views.
5. Build the real ChemTree React/Three.js application.
6. Rebuild and deploy the complete Watanabe Laboratory GitHub Pages site.

If any update/build step fails, the deploy job does not run, so the previous working public site remains live.

## One-time GitHub setup

Repository: `trwatan2/watanabe-laboratory` ONLY.
Do not upload these files to `trwatan2/trwatan2.github.io`.

1. Upload the `.github` folder and `chemtree-source` folder from this package to the repository root.
2. GitHub repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → ChemTree Daily Update + GitHub Pages → Run workflow** once.
4. When the run is green, open:
   - Laboratory site: `https://trwatan2.github.io/watanabe-laboratory/`
   - ChemTree: `https://trwatan2.github.io/watanabe-laboratory/chemtree-app.html`

## Mobile behavior

ChemTree is intentionally treated as **PC only** for now. On a smartphone/tablet, `chemtree-app.html` shows a red PC-only system requirement instead of attempting the unstable 3D app.

## Update verification

The deployed status JSON is available at:
`https://trwatan2.github.io/watanabe-laboratory/chemtree/data/public-status.json`

It contains the generated timestamp, date period, and paper count for the current public build.
