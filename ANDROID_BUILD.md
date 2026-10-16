# Zual Hardware Android build (safe beta)

This project uses the **existing Supabase database** via the same
`VITE_SUPABASE_URL` and public/anon client key configured on Vercel.
No database migration, reset or record deletion is part of this conversion.

## Android APK from GitHub Actions

1. Navigate to **Settings > Secrets and variables > Actions** in this repository.
2. Add **repository secrets**:
   - `ZUAL_SUPABASE_URL`: the URL already configured as `VITE_SUPABASE_URL` in the live Vercel project.
   - `ZUAL_SUPABASE_ANON_KEY`: the **public/anon** key already configured as `VITE_SUPABASE_ANON_KEY`.
   - **Never** use the Supabase service_role key or secret API key in client apps.
3. **Important:** GitHub manual workflow dispatch appears only after the workflow file has been added to the repository's default branch. Review and merge the PR when QA is approved, then open **Actions > Build Android debug APK > Run workflow** and choose the desired branch.
4. After the run succeeds, download the `zual-hardware-android-debug-apk` workflow artifact. Extract and install `app-debug.apk` for testing.
5. Sign and test a release build before distributing to customers or publishing on the Play Store.

The Android workflow installs Capacitor v8 and generates an Android native
project on its runner; it does not modify the repository lockfile or
the Vercel production deployment.

**Customer data precaution:** The server-side database is shared, but the
old Chrome website and the new Android WebView have different local storage.
Before switching devices/app, open the existing web app online, wait for
all **pending offline changes** to sync, and verify latest ledger entries.
Do not uninstall/clear the original app until sync is confirmed.
Test sign-in, date picker, sales, payments, and ledger with non-sensitive
test records first.

## Reproduce on a developer workstation

```sh
npm ci
npm install --no-save --package-lock=false @capacitor/core@8 @capacitor/cli@8 @capacitor/android@8
# Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in local .env
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
