# Applying the daily timetable update to your existing Rail & Route repository

This update keeps the website and the existing `RAILRADAR_API_KEY` setup. It changes Journey Explorer so station suggestions, trains-between-stations searches, and full scheduled routes use a locally hosted dataset rather than RailRadar.

## Before you start

- Keep your existing private GitHub repository and Cloudflare Pages project.
- Do not delete the repository's `.git` directory.
- Keep your local `.dev.vars` file private; it is not included in this update package.
- Do not paste your API key into GitHub source files or chat.

## Apply the update

1. Download and extract `Rail-Route-Timetable-Refresh-Update.zip`.
2. Copy the extracted update files into the root of your existing `rail-route-website` folder, allowing matching files to be overwritten. Do not overwrite `.dev.vars`.
3. In the existing project folder, open the VS Code terminal and remove the three no-longer-used live API route handlers. These old files can consume API quota if directly requested:

   ```powershell
   Remove-Item -LiteralPath 'functions/api/stations/search.js' -Force -ErrorAction SilentlyContinue
   Remove-Item -LiteralPath 'functions/api/trains/between/[from]/[to].js' -Force -ErrorAction SilentlyContinue
   Remove-Item -LiteralPath 'functions/api/trains/[number]/schedule.js' -Force -ErrorAction SilentlyContinue
   ```

4. Check the changed files in VS Code Source Control and commit:

   `feat: add daily static timetable catalogue`

5. Push the commit to the repository's `main` branch.
6. In GitHub, open **Actions → Daily timetable snapshot sync → Run workflow** and run it on `main`. This first manual run generates the initial static catalogue; before it succeeds, Journey Explorer may say the catalogue is not ready.
7. When the workflow succeeds, it commits the generated data to `main`. Your Git-connected Cloudflare Pages project should then deploy that commit automatically.
8. Visit the website, open Journey Explorer, and test station search, station-to-station results, and a full schedule. These static timetable features should not call RailRadar.

## Daily operation

The workflow checks the upstream community dataset daily at approximately 03:00 India Standard Time. It fetches the published dataset, not RailRadar. If the upstream dataset has not changed, this does not mean the timetable itself was updated that day; the page displays the upstream data revision date separately from the sync-check time.

The workflow requires GitHub Actions to be enabled and `contents: write` permission. If it fails at `git push`, open **Repository Settings → Actions → General → Workflow permissions** and allow read/write access for the workflow token, then rerun it. The script intentionally stops if the upstream data files or its declared `LICENSE` file are missing, or if the dataset fails validation.

## Quota and accuracy

Only live running-status lookups use the configured RailRadar adapter. The static timetable source describes approximately 5,208 trains and 8,990 stations, but coverage and accuracy are not guaranteed. Verify important journey details using official railway information. The upstream dataset declares MIT licensing; the workflow carries its license text into the generated catalogue for attribution and review.
