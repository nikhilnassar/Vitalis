# Publishing Vitalis on Google Play without being flagged

**First, the honest part about "signing".** A signature does not stop Google flagging an app. It proves the update came from you, and Play requires one on every release. What gets health apps rejected or flagged is almost always one of: a missing or inaccurate privacy policy, health permissions you cannot justify, claims that sound medical, a placeholder package name, or declaring the data practices wrongly. This file covers all of them. Nothing here can guarantee approval; Google decides.

## 1. Signing (do this once, on your computer)
1. Pick your permanent app id. `app.json` uses `app.vitalis.tracker` (Android `package`, iOS `bundleIdentifier`). **Change it now if you want another;** it can never change after publishing. Never use `com.example.*`; Play rejects it.
2. Easiest: let Expo manage the key. `npm i -g eas-cli`, `eas login`, `eas build -p android --profile production`, and answer "yes" when asked to generate a keystore. Run `eas credentials` afterwards and **download a backup** of it.
3. Or make your own upload key: `./scripts/make-upload-key.sh`. Keep the file and passwords private and backed up. Do not commit them.
4. In Play Console choose **Play App Signing** (default). Google holds the app-signing key; you hold only the upload key, so a lost upload key can be reset instead of killing the app.
5. Upload the `.aab` to the **Internal testing** track first.

## 2. Health Connect permissions (the most common rejection)
Play requires a **Health Connect permissions declaration** (Policy > App content). For each permission, say what feature uses it. Keep it truthful and minimal:

| Permission | Feature |
|---|---|
| Heart rate, resting HR, HRV, respiratory rate | Recovery and strain scores |
| Sleep | Sleep score and sleep need |
| Steps, active calories, exercise | Strain and energy estimates |
| VO2 max | Fitness and biological-age estimate |
| Weight, body fat, lean/water/bone mass, height | Body tab and calorie estimates |
| Blood pressure | BP log and trend |
| Read health data history | Baselines and BP model need more than 30 days |
| Read in background | Optional morning summary notification while the app is closed |

If you drop a feature, delete its permission from `app.json` and `TYPES` in `src/health/healthConnect.ts`. Unused permissions are the thing reviewers punish.

## 3. Store listing and forms
- **Privacy policy:** host `docs/PRIVACY_POLICY.md` as a public web page, fill the brackets, and link it in Play Console and `app.json`. Health Connect apps without it are rejected.
- **Health apps declaration** (App content): declare it as a health and fitness app that is **not** a medical device, with the disclaimer.
- **Data safety form:** health and fitness data collected? Declare it is processed on device and not shared. If you ship the optional Sentry reporting, declare "crash logs / diagnostics" collected, optional, not linked to identity. Keep it consistent with the policy.
- **Wording:** avoid "diagnose", "detect", "treat", "clinical", "medical grade", and any claim of measuring blood pressure without a cuff. The app already says estimates and non-medical; keep the store text the same. Do not copy Whoop, Fitbit or Hume names or logos into the listing.
- **Content rating** questionnaire, **target audience** 16+ (or 18+), **ads**: none.
- **Target API level:** Expo SDK 58 builds meet the current requirement; check Play Console's warnings.
- Make a short screen recording showing the permission prompt and what each permission is used for; Play sometimes asks.

## 4. Before you submit
- Run on a real phone, accept and deny each permission, and confirm the app copes with a denial.
- Test the notifications and the "Delete all my data" button.
- Take screenshots from the release build, not the demo-data build, or label demo data clearly.
- Closed testing with 12+ testers for 14 days is required for new personal developer accounts before production.

## Why this is not a guarantee
Google reviews each app. Honest declarations, a real privacy policy, minimal permissions and non-medical wording are what make flags unlikely; a certificate alone does nothing.
