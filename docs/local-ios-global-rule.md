# Proposed global Codex instruction

Status: installed in `/Users/alramalho/.codex/AGENTS.md` on September 13, 2026 after Full Access was restored. Existing instructions were preserved; no global override file was present.

## Native iPhone build preference

- The user primarily works remotely from an iPhone. For requested test builds, prefer compiling on their Mac and returning an HTTPS page with a working Safari Install button for a signed native app. Do not require a cable, shared Wi-Fi, or a running Metro server for the installed release.
- Before building, read the project's `BUILDING.md` (or the relevant frontend's BUILDING.md). Maintain exact local build, verification, hosting and installation commands there so later tasks can repeat the workflow.
- Use local builds by default. Never silently fall back to Expo cloud builds or consume cloud quota. Paid subscriptions, store submissions and OTA publication need user authorization unless already provided in the conversation.
- Reuse that app's production environment, Apple/EAS identity and existing signing setup. Keep credentials and signed download URLs out of tracked documentation and generated app config. Do not copy another app's bundle IDs, environments, entitlements, device assumptions or hosting credentials.
- Verify the actual IPA and hosted downloads before returning a link, including build number, production configuration, bundled JS, release signature and device provisioning. Distinguish completed builds from drafts, exports, old artifacts or merely uploaded files.
- If the Mac/toolchain/network is unavailable, report the concrete blocker and retain the prepared workflow; don't claim an install link exists. Prefer a supported Xcode version over dependency-source workarounds.
- This preference applies to tracking.so and verycheapaudiobooks and to other iOS apps unless the user requests another distribution method. It does not authorize unsolicited releases.

Reference: [Codex global/project AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
