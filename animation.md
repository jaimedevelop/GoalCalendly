# Timer-stop and trophy popup animation plan

Research date: October 5, 2026. Status: implemented, including admin animation previews. The original design and research are retained below; implementation notes appear at the end.

## Intended behavior

Interpretation of the request: show feedback when a user stops a running timer while using the app, with a noticeably different celebration when that session earns a trophy. This is an in-app popup, not an operating-system notification or an animation on every app launch.

Recommend two nonmodal popup variants in one shared notification system. When a timer stop earns a trophy, show the trophy variant with the session duration included instead of displaying two competing popups. Also celebrate trophies earned through manual time entry, since the existing app treats manual and timed practice consistently.

These are proposed product choices, not existing behavior:

| Detail | Timer stopped | Trophy earned |
| --- | --- | --- |
| Visual | Compact white card, blue/green accent, timer/check icon | Larger gold-accented card, prominent trophy, small decorative particle burst |
| Copy | “Timer stopped” / “Guitar · 25m recorded locally. Saving…”; change to “25m saved” after confirmation | “Trophy earned!” / “Guitar · Weekly target reached” plus saved session duration |
| Entrance | Fade and rise approximately 12px over 200ms | Fade and scale from 0.92 to 1 over 320ms; trophy settles once over about 500ms |
| Decoration | One brief check-icon emphasis | Approximately 12–20 CSS particles within the card, ending within 900ms |
| Visible duration | 5 seconds after success | 7 seconds after success |
| Exit | 150ms fade | 180ms fade |
| Reduced motion | Static card, no translation or scale | Static gold card and trophy, no particles or bounce |

Timing values are starting points for visual testing, not research-mandated thresholds. Avoid sound, looping motion, flashing, full-screen confetti, and focus-stealing dialogs. Use seconds for sessions under one minute; do not display positive recorded time as “0m.”

## Repository findings

The app uses React 18, TypeScript, Zustand, Tailwind CSS, Lucide icons, and existing Radix Toast/Dialog dependencies. No additional animation library is needed for the proposed effects.

1. `src/components/ActiveTimer.tsx` renders multiple active timers and calls `stopTimer(goal.id)` from each Stop button. It also receives service-worker `STOP_TIMER` messages, checking both goal ID and timer start time. The component returns nothing once no timers remain, so it cannot own a popup that must survive the final timer stopping.
2. `src/App.tsx` mounts `ActiveTimer` outside the authenticated route switch. A timer can therefore be stopped from any signed-in page. The existing `Toaster` is mounted globally, outside the router.
3. `src/store.ts` owns `stopTimer`, splits elapsed practice across local calendar days, applies `practiceTimeUpdates`, removes the timer immediately, and saves asynchronously through `updateGoalFields`. A save failure leaves timer progress in local memory and sets `lastGoalError`; it does not roll progress back. `stopTimer` currently returns `void`.
4. `src/services/practiceTime.ts` is the shared source of trophy calculations. A positive hour target earns one trophy per achieved daily, weekly, or monthly period. Further time in an already-earned period does not earn another trophy. Non-hour targets do not currently earn trophies through this calculation. Level advancement and marking a goal Completed are separate events.
5. `src/store.ts:addManualTime` uses the same calculation but saves through `updateGoal`, which returns success/failure and rolls back on failure. `setGoals` normalizes loaded progress; it must not trigger celebrations for historical trophies.
6. `src/components/GoalCard.tsx` displays trophy totals, weekly trophy summaries, and a separate “Goal Completed!” toast. Completion calls `completeGoalById`, which first stops a running timer. This creates a potential collision between completion and timer feedback.
7. `src/hooks/useToast.ts` allows only one toast (`TOAST_LIMIT = 1`). A new message replaces the previous one. Merely firing two existing toasts would lose feedback; increasing that limit alone would not implement reliable queuing.
8. `src/components/ui/toast.tsx` places toasts at the top on mobile and bottom right on desktop. `ActiveTimer` and the PWA install prompt also use the bottom-right area. `ManualTimeDialog` uses layers 9998/9999, higher than the existing toast viewport at 100. Placement and dialog deferral need explicit handling.
9. `src/services/goals.ts` already serializes writes per goal and returns an `ok` result. Preserve that path and the server-owned mutation boundary. No direct Firestore writes or new backend trophy rules are needed for this feature.

## Research and technology recommendation

Reuse Radix Toast for the popup behavior and CSS keyframes for the visual effects. Radix documents dismissal, swipe support, configurable duration, and pausing dismissal on hover, focus, or window blur. Extend the app's existing wrapper and queue instead of introducing a second competing toast provider. The current documentation may describe a newer Radix version than the installed dependency; verify the lockfile and available API before implementing. [Radix Toast documentation](https://www.radix-ui.com/primitives/docs/components/toast)

Animate `transform` and `opacity` for the card, trophy, and particles. Avoid animating layout dimensions or positions such as width, height, top, and left. A small CSS particle effect is sufficient; a canvas or asset-animation dependency would add complexity without a requirement for it here. [web.dev animation performance guide](https://web.dev/articles/animations-guide)

Respect `prefers-reduced-motion` and retain the full message when decorative motion is disabled. WCAG's Animation from Interactions criterion supports disabling nonessential interaction-triggered motion; it is a Level AAA criterion, used here as a design target. [W3C animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

Announce success without moving keyboard focus. Use Radix's announcement mechanism configured for polite delivery and verify it with a screen reader; avoid adding a second live region that repeats the same message. Decorative icons and particles should be hidden from assistive technology. [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Pages and existing files affected

| Page/file | Proposed work |
| --- | --- |
| `src/App.tsx` | Mount one authenticated celebration-event consumer; make timer save failures visible on every signed-in route; clear pending UI events when the user changes. Keep one shared toaster. |
| `/goals` — `src/pages/Goals.tsx` | Primary end-to-end verification surface. Normally no new popup markup; preserve Save and error recovery. Coordinate its existing error text with global feedback. |
| `/completed` — `src/pages/CompletedGoals.tsx` | Verify a timer stopped from this page still gets feedback. Restoring goals must not replay trophies. No page-specific animation logic needed. |
| `/reports` — `src/pages/Reports.tsx` | Verify global stop feedback. Reports explicitly use saved records and refresh; a popup must not claim the report has refreshed automatically. No report redesign needed. |
| `/settings`, `/help`, `/subscription`, `/billing/return`, `/admin` | Receive shared feedback through the authenticated shell when a timer is running. No duplicated page components; verify responsive placement. |
| `src/store.ts` | Produce explicit session outcomes, track save status, detect earned-period changes, and enqueue events from timer/manual actions. Guard asynchronous results against logout/user changes. Coordinate completion-triggered stops and failed-save recovery. |
| `src/services/practiceTime.ts` | Retain award rules. Expose or support a pure before/after award-difference helper, including legacy weekly fallback semantics. Do not emit UI events inside this calculation. |
| `src/components/ActiveTimer.tsx` | Preserve all Stop entry points and stale-message checks. Adapt outcome handling if the store contract changes; never render the celebration inside a timer row. Verify focus when the clicked row disappears. |
| `src/components/GoalCard.tsx` | Coordinate the existing completion toast with timer/trophy events. Do not infer new awards from rendered trophy totals. |
| `src/components/ManualTimeDialog.tsx` | Allow the trophy popup after successful save and dialog close; no timer-stop popup for manual entries. |
| `src/hooks/useToast.ts` | Add a real pending queue, stable message updates, dismissal cleanup, and priority handling so errors/completion messages cannot erase trophy feedback. |
| `src/components/ui/toaster.tsx` | Render the new content variants in the existing provider; show one popup at a time. |
| `src/components/ui/toast.tsx` | Add distinct timer/trophy presentation, an always-visible accessible close button, and responsive placement. Preserve swipe and keyboard behavior. |
| `src/index.css` | Add scoped animation rules and reduced-motion overrides. Avoid changing all existing animation utilities globally. |
| `tailwind.config.js` | Optional alternative location for named keyframes; choose CSS or Tailwind as the single definition source. |
| `src/services/goals.ts`, `public/sw.js`, `src/services/notifications.ts` | Integration review and regression coverage; no expected functional changes for the baseline plan. |
| `src/pages/Settings.tsx` | Optional later preference to disable celebrations; OS reduced-motion support is part of the baseline. |

Login, signup, and landing pages should never display an old user's queued celebrations. No database schema, security-rule, billing, or dependency changes are expected.

## Proposed new modules

The modules below implement the shared event and popup system.

| New file | Responsibility |
| --- | --- |
| `src/types/celebrations.ts` | Typed event payload: event/session ID, user ID, goal ID/name snapshot, source, duration, achieved period keys, save state, creation time. |
| `src/services/celebrations.ts` | Pure outcome classification, award-difference detection, and deduplication keys. No React rendering or persistence writes. |
| `src/hooks/useCelebrations.ts` | Consume transient events, defer while hidden or a modal is open, and update/enqueue the shared toast. Own cleanup and presentation deduplication. |
| `src/components/celebrations/TimerStoppedContent.tsx` | Timer icon, duration, pending/saved state, and compact layout. |
| `src/components/celebrations/TrophyEarnedContent.tsx` | Trophy, period label, session summary, and grouped award count. |
| `src/components/celebrations/TrophyBurst.tsx` | Small, finite, decorative CSS particle layer with no pointer interception. Could remain private to trophy content if sufficiently small. |

Keep event state transient in Zustand and separate from persisted Goal data. These content components use the shared toast shell, not independent portals or notification providers.

## Event flow and reliability

1. Capture the active session and goal before mutation. Use a stable session key based on user, goal, and timer start time. A repeated stop or a missing timer emits nothing.
2. Apply the existing full elapsed-time calculation once. Compare normalized pre-session and final post-session award states after all day segments are processed. Use period identity, not a global render effect watching `goal.trophies`. Legacy weekly trophies must count as already earned even when `progressPeriods` is absent.
3. Stop the timer immediately. For positive elapsed time, create a timer feedback item with pending save state; do not call it saved yet. If the duration is zero, show only a neutral “Timer stopped — no time added” acknowledgement and no celebration.
4. Await the existing persistence result inside the action or its completion callback. On success, update the same item to saved, or promote it to the trophy variant if new periods were earned. Never replay the entry effect on routine React renders. If the pending item was dismissed, do not reopen ordinary success; a newly confirmed trophy may still be queued once.
5. On failure, replace pending feedback with a clear error, suppress trophy celebration, and retain the app's existing local-progress recovery behavior. Provide a route to the existing Save control on `/goals`. Failed timer progress is not durable across a reload; do not imply otherwise.
6. Retain failed-session award candidates in memory so a later successful explicit Save can confirm them once. Associate confirmation with the exact saved goal snapshot; an unrelated successful edit must not confirm unsaved session data. Clear these candidates on logout, goal removal, or reload. Do not replay historical awards after a fresh load.
7. Manual time emits an award candidate only for a successful mutation, then displays it after its dialog closes. Ordinary manual saves without an award keep their existing behavior.
8. Goal completion can stop a timer implicitly. Suppress ordinary timer success in that flow when completion succeeds, retaining the existing completion message. If a trophy is earned, queue it and then the completion message. If completion fails but time saves, retain time feedback and show the completion error independently. Do not change completion semantics incidentally while adding animations.

Multiple timers may stop rapidly. Queue by action order, update pending items by ID, and show one popup at a time. Errors take priority without discarding queued trophies. Multiple newly earned periods from a single session use one “N trophies earned!” card with the affected periods summarized. Deduplicate trophy presentation by user + goal + period, with the mutation/session identity used to manage pending outcomes.

When the tab is hidden, wait until visible before starting the display duration. Do not persist the celebration queue across reloads. Existing service-worker messages may reach multiple clients; this plan guarantees local presentation deduplication, not cross-device exactly-once trophy delivery. Durable cross-device delivery would require separate event persistence and is outside this feature.

Capture the user identity and an auth-session generation before saving; discard late UI callbacks if either changes. Route changes should not unmount the queue. Respect existing stale notification guards.

## Placement and accessibility

Use a shared top-center popup region below the header, with safe-area spacing and a maximum width around 420px. This avoids the existing bottom timer stack and PWA prompt. Coordinate the timer notification-permission prompt in the same upper region so they cannot overlap. Test narrow screens and long goal names rather than relying on a fixed vertical offset alone.

Defer celebrations while a modal is open, including the manual-time dialog. Do not solve modal overlap by simply assigning an extreme z-index. Keep a visible Close control, keyboard dismissal, sufficient contrast, and no focus trap. Pause dismissal on hover/focus and while hidden. Preserve persistent goal/time/trophy information so the popup is not the only record.

If stopping the final timer removes the focused button, move focus to a stable, relevant control or shell landmark; do not automatically focus the popup. Reduced-motion mode must avoid decorative movement on both entry and exit, including inherited toast animation classes.

## Implementation sequence and acceptance checks

1. Define typed outcomes and pure award-difference rules; cover legacy periods and midnight splits.
2. Add transient event production and persistence-result handling in the store, including manual time, completion, Save retry, and auth cleanup.
3. Extend the shared toast queue and add the two visual variants.
4. Integrate global placement, modal/visibility deferral, focus behavior, and reduced motion.
5. Verify behavior with isolated tests and desktop/mobile browser checks before changing production data.

Extend `tests/timers.test.mjs`, `tests/practiceTime.test.ts`, and `tests/timerNotifications.test.mjs`. Add `tests/celebrations.test.ts` for outcome/queue behavior and `tests/celebrations.browser.test.mjs` using the existing isolated Playwright fixture pattern in `tests/timerSettings.browser.test.mjs`.

Acceptance cases:

- A normal stop shows one timer popup with the correct goal and elapsed duration; pending feedback never claims a confirmed save.
- Crossing a daily, weekly, or monthly hour target shows the distinct trophy variant once. Additional time in the same period does not repeat it.
- Midnight, week/year boundaries, monthly boundaries, legacy weekly records, and multiple awarded periods preserve existing calculations.
- Repeated Stop clicks and stale service-worker messages neither double-count time nor duplicate feedback.
- Concurrent goals retain distinct outcomes even when saves resolve at different times.
- Failed saves show an error on every authenticated page; retry succeeds without duplicate celebration.
- Manual-time failure never celebrates; successful trophy feedback waits for the dialog to close.
- Completion with a running timer preserves both save and completion outcomes without misleading messages.
- Loading, importing, restoring, editing targets, navigating, or React Strict Mode remounting does not celebrate old trophies.
- Logout/account switching clears pending events and ignores late callbacks.
- Reduced motion, keyboard-only navigation, screen-reader announcements, hidden-tab return, 320px-wide screens, and 200% zoom remain usable.
- Remaining active timers, error messages, dialogs, and the PWA install prompt stay accessible.

Validation commands: `npm run test:timers`, `npx tsx --test tests/practiceTime.test.ts`, `npm run test:celebrations`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, and `npm run lint`.

## Implementation notes

- Admin Dashboard now has a Settings tab containing Timer and Trophy icon buttons. These preview the real animation components using sample data, without remote writes or goal-progress changes. Clicking again replays the preview. Both rendering and the preview action require `isTrustedAdmin`.
- One shared Radix toast queue presents timer, trophy, error, and completion feedback. Timer saves update their existing message; newly confirmed trophies use the gold animation. Errors interrupt while preserving the backlog.
- `src/hooks/usePopupAvailability.ts` defers presentation while the document is hidden, a dialog/backdrop is visible, or the timer permission prompt is open. The popup appears above the timer/PWA area and respects reduced motion.
- Failed timer progress retains a recovery candidate in memory and a persistent authenticated-shell reminder. Only confirmation of a snapshot containing that recorded progress recovers its award. Auth-session generation checks discard late results after account changes.
- Radix toast roots remount on meaningful status changes so its announcement text refreshes. Ordinary save confirmation skips the card entrance animation and preserves focus if the popup already held it. Keyboard focus after the final timer stop moves to the stable app shell.
- Automated coverage includes the real admin Settings tab and both previews, pending/saved/error outcomes, recovery, manual awards, modal/hidden-tab deferral, Escape dismissal, 320px layout, reduced motion, and announcement text. Tests use isolated APIs and sample goals.
- Browser automation checks the generated live-region content; a manual screen-reader review remains useful for delivery behavior on each supported platform. Cross-device exactly-once trophy delivery remains outside this implementation.
