# Shipping: the web app, iOS, and Android

What is already wired up, what each platform needs from you personally (an account, a decision, or a device this
environment doesn't have), and the exact commands. Nothing below requires Xcode or Android Studio on this machine --
EAS Build compiles iOS and Android in the cloud.

## Web: already automatic

Every push to `main` that touches `exposure-awareness-mobile/` builds the app with `expo export --platform web` and
publishes it to GitHub Pages (`.github/workflows/pages.yml`). The site *is* the app -- no separate marketing page --
plus a static `/privacy.html` (source: `public/privacy.html`) that the app links nowhere internally but the app
stores will want a URL for.

**One manual step, once, after the repo is on GitHub:** Settings &rsaquo; Pages &rsaquo; Build and deployment &rsaquo;
Source: **GitHub Actions**. Until that's set, the deploy job fails with a clear "Pages site not found" error; flip
the switch and re-run it from the Actions tab.

The exported bundle's asset paths are prefixed with `/<repo-name>/` automatically (via
[`expo.experiments.baseUrl`](https://docs.expo.dev/versions/v57.0.0/config/app/#baseurl), set at build time by the
workflow from `$GITHUB_REPOSITORY` -- nothing to edit if the repo is renamed or forked), unless the repo is named
`<username>.github.io`, which GitHub serves from the domain root instead. Verified locally end to end before this was
wired into CI: exported with `baseUrl` set, confirmed `index.html`'s script and favicon links carried the prefix, and
served the result.

To export a local copy without the workflow: `npm run web:build` (writes `exposure-awareness-mobile/dist/`; serve it
with any static file server).

### Installing it from the browser (no store needed)

The site carries a web app manifest and icons (`public/manifest.json`, `public/index.html`), so a phone can keep it on
the home screen and open it full-screen like an app, today, with no account on either store:

- **iPhone / iPad (Safari):** Share &rsaquo; Add to Home Screen.
- **Android (Chrome):** menu &rsaquo; Install app (or Add to Home screen).
- **Desktop Chrome / Edge:** the install icon at the right of the address bar.

Everything still lives in that browser's storage on that device, exactly as in a tab. Three honest limits: there is no
service worker, so it needs a connection to *open* (a cache that could hold back an update was not worth it for a first
release); the scheduled daily reminder is the native app's (a web page cannot schedule one -- `notify.ts` makes it a
no-op there, while a reading-triggered air-quality notice does work through the browser's own notifications); and
"Scan with camera" has not been tried in a phone's browser, where barcode support varies -- typing the barcode number
or pasting the label always works. Paths in the manifest and the page are relative on purpose, so the same build works under
`/<repo-name>/` on GitHub Pages and at the root of a domain of its own; `src/theme.test.ts` holds that, and that the
page opens on the theme's own background in light and dark.

Verified 2026-10-03 on the exported bundle served under `/tox-tool/` exactly as Pages serves it: first run as a new
person (setup, first steps, an empty Dashboard), the manifest and icons loading, no console errors, and the
accessibility walk clean on every screen it reached.

### A domain of its own (optional)

Buy the domain, add it under Settings &rsaquo; Pages &rsaquo; Custom domain, and add a `public/CNAME` file containing
just the domain. In `.github/workflows/pages.yml` the base path then has to be empty: the `case` there only treats
`<name>.github.io` repos as root-served, so add the custom-domain case when that day comes.

## iOS and Android: the config is ready, the account is yours

`eas.json` defines three build profiles (`development`, `preview` -- internal installs for testing, `production`),
and `app.json` already has a bundle identifier / package name (`com.exposureawareness.mobile`, both platforms) and a
1024&times;1024, alpha-free icon (the one thing the App Store icon spec is strict about). None of that needed an
account to set up. What does:

1. **Create a free account at [expo.dev](https://expo.dev/)** (this has to be you -- an assistant creating accounts
   on your behalf is out of scope here on purpose). Then, from `exposure-awareness-mobile`:
   ```bash
   npx eas-cli login
   npx eas-cli build:configure
   ```
   The second command links this project to your account and writes an `extra.eas.projectId` into `app.json` --
   commit that change.

2. **Build.** Cloud-compiled either way; no local Xcode or Android Studio needed.
   ```bash
   npx eas-cli build --platform android --profile preview   # an installable APK, shareable immediately
   npx eas-cli build --platform ios --profile preview        # needs step 3 below to install on a real iPhone
   ```

3. **Apple specifically** requires a paid **Apple Developer Program** membership ($99/year) before a build can go on
   a real device or the App Store -- a free Apple ID alone only reaches the iOS Simulator, which needs a Mac with
   Xcode, i.e. not achievable in this environment at all. Android has no equivalent cost to build or side-load; only
   the Play Store listing itself costs anything (below).

4. **Submit to the stores** once you're ready for the public listing, not just a test install:
   ```bash
   npx eas-cli submit --platform ios       # needs the $99/year Apple Developer Program
   npx eas-cli submit --platform android   # needs a one-time $25 Google Play Console registration
   ```
   `eas submit` walks through connecting App Store Connect / Play Console credentials interactively the first time.

### What the store listings will ask for

- **Privacy policy URL.** `https://<your-pages-url>/privacy.html` once Pages is live (see above). Its content is
  generated from the same facts as the app's own About&nbsp;you &rsaquo; "What leaves this device" panel, so the two
  can't drift silently -- if one changes, check the other.
- **Screenshots**, at each store's required sizes. Not captured here: this environment has no simulator or device to
  take them on. The `run` / iOS Simulator tooling in a session that has it configured can do this once a build exists.
- **App description.** The one-line description already in `app.json` ("A private, on-device way to see what you're
  exposed to, compare it with published guidance, and make your own changes.") and the opening of the top-level
  README are both reasonable starting text.
- **Age rating / content questionnaire.** Each store asks this directly; answer it yourself rather than have it
  guessed, since it's a compliance decision, not a technical one.
- **Review notes (recommended, not required).** Worth telling Apple's reviewer directly that this is an awareness and
  learning tool, not a diagnostic one -- the in-app scope note and the redirect to a poison centre or emergency
  number for anything urgent (`src/data/safety.ts`, shown at setup and under About&nbsp;you) are exactly the kind of
  thing a health-adjacent app's review benefits from pointing at explicitly.

### Native paths not exercised here

Camera-based barcode scanning (`expo-camera`) and local notifications' native path (`expo-notifications`, the
scheduled daily check-in) are implemented against the versioned SDK 57 docs but have only run through the *web*
build in this environment -- there's no device or simulator here to exercise them on. First real build is also the
first real test of both; see the walkthrough's open-items list.
