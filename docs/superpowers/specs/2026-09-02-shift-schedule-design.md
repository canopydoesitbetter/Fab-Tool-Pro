# Fabri-Cadabra v1.0.2 Shift Schedule Design

## Status

Approved in chat on 2026-09-02. This document is the implementation design for v1.0.2 and must be reviewed before implementation begins.

## Goal

Add an optional Shift Schedule safety system that works directly with Task Logging and local device time. Its purpose is to prevent accidental labor-time bleed when a user forgets to stop a running task before Break, Lunch, or the end of a scheduled shift, while remaining flexible enough for early starts, late starts, overtime, unscheduled work, overnight shifts, and public deployment.

The feature must preserve existing Task Logging storage, timer session formats, formulas, optimizer logic, native compatibility, and the Capacitor app identity.

## Non-goals

- This is not a payroll or timecard system.
- v1.0.2 will not create attendance-history reports or export employee punch history.
- It will not use a network time source or anti-tamper clock service; the local device clock and timezone are authoritative.
- It will not add native background services merely to fire break/lunch alarms while the app is suspended.
- It will not alter the existing Task Logging job/preset import-export formats.

## Chosen Architecture

The schedule policy belongs in `www/app.js`, beside the existing Task Logging timer logic. The Settings presentation remains in the existing Settings/UX layer, with a narrow bridge into the core shift-schedule API.

This is preferred over UI-only interception because all timer starts must be guarded by core logic, not merely by button state. It is also preferred over native background services because the existing absolute Task Logging timestamps make exact recovery possible after app suspension without platform-specific services.

The implementation should expose a small, understandable core surface for the Settings/header UI, conceptually covering:

- read current schedule configuration;
- save validated configuration;
- enable or disable Shift Schedule;
- read current shift/clock status;
- clock in;
- clock out;
- apply current-shift Break/Lunch overrides;
- answer whether a task may start now;
- reconcile a running task and clock state against schedule boundaries.

The exact function names may follow existing project conventions, but presentation code must not own timer-enforcement rules.

## Existing Timer Contract to Preserve

Task Logging already stores running-task state using:

- `running`
- `startedAt`
- `accumulatedMs`

Completed task sessions use:

- `startedAt`
- `endedAt`
- `durationMs`

The existing `stopTaskLogTask(job, task, nowMs)` path accepts an explicit stop timestamp. v1.0.2 must continue using that path so schedule-driven stops produce ordinary Task Logging sessions rather than a new session format.

## Persistence

Add one new versioned localStorage record:

- key: `fabricationShiftScheduleV1`
- format: `FabricationShiftSchedule`
- version: `1`

The record should contain the minimum state needed to restore schedule and clock behavior safely after a reload or app restart:

- `enabled`
- inclusive workday range start/end
- Clock In time
- Break enabled default, time, and duration minutes
- Lunch enabled default, time, and duration minutes
- Clock Out time
- manual Clocked In/Out state
- actual manual clock-in timestamp
- current scheduled-shift identity, when applicable
- current-shift Break override
- current-shift Lunch override
- work mode: scheduled, overtime, or unscheduled
- policy effective timestamp used to prevent retroactive reinterpretation after schedule edits

Existing localStorage keys and Task Logging structures must not be renamed or migrated.

## Schedule Input Model

The Settings page receives a collapsed-by-default `Shift Schedule` panel using the same visual language as the app's existing management panels.

The schedule is configured as:

- Scheduled Days: `Monday` through `Friday` style inclusive range
- Clock In: `Time` + `AM/PM`
- Break: small Enabled/Disabled control + `Time` + `AM/PM` + `Length in minutes`
- Lunch: small Enabled/Disabled control + `Time` + `AM/PM` + `Length in minutes`
- Clock Out: `Time` + `AM/PM`

The day range is inclusive and cyclic. Examples:

- Monday through Friday means Monday, Tuesday, Wednesday, Thursday, Friday.
- Friday through Tuesday means Friday, Saturday, Sunday, Monday, Tuesday.
- Monday through Monday means Monday only, not all seven days.

Clock In and Clock Out are required whenever Shift Schedule is enabled.

Break and Lunch are optional independently.

## Break and Lunch Toggle Semantics

Each Break/Lunch row has a compact toggle near the row label.

When there is no active scheduled shift instance, the toggle represents the saved default for future shifts.

Once a scheduled shift instance has been established by manual Clock In, changing that control applies only to that shift instance and must be labeled or helper-texted clearly as a current-shift override. The saved default remains unchanged.

Current-shift overrides:

- survive page changes and app restarts;
- survive a manual Clock Out followed by Clock In again within the same scheduled shift window;
- expire when that scheduled shift instance ends;
- return to the saved default for the next scheduled shift.

Override changes are prospective. If Break/Lunch is turned off after its window has already stopped a task, the task remains stopped and the user may manually restart it immediately if no other rule blocks work. If a currently active Break/Lunch is turned back on while a task is running, that task stops at the override-change time rather than being retroactively truncated to the original pause start.

Overtime and unscheduled work modes do not inherit unrelated scheduled Break/Lunch boundaries.

## Header Clock Control

Add a dedicated clock control to the main Fabri-Cadabra header, in the area identified by the user, without changing the established styling of existing Pages/theme controls.

When Shift Schedule is enabled:

- show a green `CLOCK IN` button while clocked out;
- show a red `CLOCK OUT` button while clocked in;
- show a concise status such as `Clocked In • 6:47 AM` where layout permits;
- preserve touch-friendly sizing and responsive behavior on narrow phones.

When Shift Schedule is disabled, the header must clearly indicate that Shift Schedule protection is off rather than presenting a misleading clocked-in/out state.

Both Clock In and Clock Out require clear confirmation.

Clock Out confirmation must explicitly warn that any running Task Logging timer will stop immediately.

## Master Enable / Disable

The Shift Schedule panel has a visually strong master Enabled/Disabled state, distinct from the small Break/Lunch controls.

Enabling requires a warning explaining that Task Logging timers will be controlled by manual clock state and schedule boundaries.

Disabling requires a warning explaining that Break/Lunch/Clock Out protection will no longer control Task Logging.

When Shift Schedule is enabled:

- clock state starts as Clocked Out;
- any task that is currently running is stopped at the enable-confirmation time;
- no historical task time is retroactively rewritten;
- the user must manually Clock In before another task may start.

When Shift Schedule is disabled:

- existing pre-v1.0.2 Task Logging behavior is restored;
- no clock-in requirement is enforced;
- no Break/Lunch/Clock Out automatic stops are applied;
- a currently running task may continue normally;
- live clock/work-mode state and current-shift overrides are cleared, while saved schedule defaults and times are preserved.

Re-enabling starts again from Clocked Out.

## Manual Clock In Rules

Manual Clock In is required whenever Shift Schedule is enabled.

Clock In is intentionally flexible so the schedule does not become a hindrance.

### Early clock-in

A user may Clock In before the scheduled Clock In time on a scheduled shift-start day. After confirmation, they are immediately allowed to start Task Logging timers. They do not have to wait for the scheduled start.

The remainder of that scheduled shift's enabled Break, Lunch, and Clock Out boundaries still apply.

### Late clock-in

A user may Clock In after the scheduled Clock In time. If the scheduled shift is still active, this is a normal scheduled clock-in and the remaining schedule boundaries apply.

### Clock in during Break or Lunch

A user may Clock In during an enabled Break or Lunch window, but Task Logging remains blocked until that pause window ends. Ending Break/Lunch never auto-starts a task.

### Clock in after scheduled Clock Out

If the scheduled shift has already ended, Clock In is treated as overtime/after-hours work. The app must show a clear confirmation explaining that the scheduled shift has ended and the user is clocking back in for overtime.

Once confirmed, overtime continues until manual Clock Out. The already-passed scheduled Clock Out does not fire again.

### Clock in on an unscheduled day

If the current day does not belong to any applicable scheduled shift, show a clear confirmation such as:

> Today is not one of your scheduled workdays. Clock in for unscheduled work?

If confirmed, enter unscheduled-work mode. Unscheduled work continues until manual Clock Out and does not apply Break/Lunch/Clock Out rules from an unrelated scheduled day.

## Manual Clock Out Rules

Manual Clock Out is always available while Shift Schedule is enabled and the user is clocked in.

After confirmation:

- stop the currently running Task Logging task, if any, at the actual device time;
- persist the ordinary Task Logging session through the existing stop path;
- set the user to Clocked Out;
- update the header immediately.

If the user manually clocks back in during the same still-active scheduled shift window, current-shift Break/Lunch overrides remain in effect.

## Scheduled Clock Out

For a normal scheduled clock-in, scheduled Clock Out is authoritative.

At the scheduled Clock Out boundary:

- stop any running Task Logging task at the exact scheduled Clock Out timestamp;
- force the clock state to Clocked Out;
- require a new manual Clock In before any future task timer can run;
- allow the user to clock back in for overtime after an explicit overtime confirmation.

If the app is suspended or closed when Clock Out occurs, reconciliation on the next activation must still apply the exact scheduled Clock Out timestamp to the running task and restore Clocked Out state.

## Overtime Mode

Overtime begins when the user manually clocks in after the applicable scheduled shift has ended or after being force-clocked-out at scheduled Clock Out.

Overtime mode:

- allows Task Logging immediately after confirmation;
- ignores the already-passed scheduled Clock Out;
- does not automatically end at a later schedule boundary;
- continues until the user manually clocks out;
- does not automatically become a new scheduled shift if it crosses midnight or enters the next scheduled day.

This manual-only end behavior is intentional and approved.

## Unscheduled Work Mode

Unscheduled work begins after confirming a Clock In on a day outside the configured workday range when no applicable overnight scheduled shift is active.

Unscheduled mode:

- allows Task Logging immediately after confirmation;
- does not borrow Break, Lunch, or Clock Out boundaries from another day;
- continues until manual Clock Out;
- does not automatically convert into a scheduled shift if it spans into another day.

## Overnight Shifts

Overnight shifts are supported.

A shift whose Clock Out wall-clock time is earlier than its Clock In wall-clock time is interpreted as ending on the following calendar day. Equal Clock In and Clock Out times are invalid rather than being treated as a 24-hour shift.

The scheduled shift belongs to the day on which Clock In is scheduled.

Example:

- Scheduled days: Monday through Friday
- Clock In: 10:00 PM
- Clock Out: 6:00 AM

The Friday shift begins Friday at 10:00 PM and may continue through Saturday at 6:00 AM. Saturday is not automatically a scheduled shift-start day unless Saturday is included in the configured range.

When evaluating a time after midnight, the engine must first check whether it belongs to the previous day's still-active overnight shift before classifying it as unscheduled work.

For overnight validation, each enabled Break/Lunch wall-clock time must map to the unique occurrence after scheduled Clock In and before scheduled Clock Out. If it cannot be mapped inside that shift span, the schedule is invalid.

## Allowed Timer Windows

For a normal scheduled clock-in, Task Logging is allowed only when all of these are true:

1. Shift Schedule is enabled.
2. The user is manually Clocked In.
3. The clock-in mode is scheduled work, not currently in a blocked scheduled pause.
4. The current instant is not inside an enabled Break window.
5. The current instant is not inside an enabled Lunch window.
6. Scheduled Clock Out has not been reached for that scheduled shift instance.

Early clock-in is an explicit exception to the scheduled Clock In lower bound: once manually clocked in early, labor may start immediately.

Overtime and unscheduled work are allowed whenever manually clocked in and continue until manual Clock Out.

## Boundary Semantics

Schedule times are interpreted in local device time.

Each configured boundary occurs at the selected minute with zero seconds and milliseconds.

For scheduled work:

- Break blocks from Break start inclusive until Break end exclusive.
- Lunch blocks from Lunch start inclusive until Lunch end exclusive.
- Clock Out is disallowed at and after the Clock Out boundary.
- At the exact Break/Lunch end minute, task starts become allowed again.
- No task is ever auto-started when a blocked period ends.

## Core Start Guard

The rule must be enforced inside the existing Task Logging start path, not only by disabled buttons.

Before setting a target task to `running=true`, the core must check Shift Schedule state.

If task start is not allowed, the start operation must be rejected without changing another running task or corrupting state. The UI should present a clear reason, for example:

- Clock In required.
- Break in progress until 9:15 AM.
- Lunch in progress until 12:30 PM.
- Scheduled shift has ended; Clock In for overtime if work is continuing.

The visual Start controls may also reflect disabled state, but the core check is authoritative.

## Automatic Stop and Reconciliation

JavaScript timers cannot be trusted to execute exactly while a phone is locked or an app is backgrounded. Therefore exact schedule enforcement must be timestamp-based rather than interval-only.

While the app is foregrounded, a lightweight periodic enforcement check should make the UI respond promptly.

In addition, reconciliation must run at safe activation points including:

- initial app/task-log state load;
- `visibilitychange` when becoming visible;
- `pageshow`;
- window focus where useful;
- before/after state-changing schedule or clock operations as appropriate.

### Exact-boundary recovery example

If a task starts at 9:42 AM, Break begins at 10:00 AM, the phone locks at 9:55 AM, and the app wakes at 10:18 AM, the task session must end at 10:00 AM, not 10:18 AM.

### First prohibited boundary wins

If the app was inactive through multiple boundaries, the running Task Logging session ends at the first boundary that should have prohibited labor after the task's effective running-policy start point.

For example, if the app sleeps through Break, Lunch, and Clock Out, the task ends at Break start. Clock state is separately reconciled to Clocked Out once scheduled Clock Out has also passed.

### Clock state and timer state are reconciled separately

A task may have stopped at Break while the employee remained Clocked In. If the app remains asleep past scheduled Clock Out, clock state must also become Clocked Out at that later boundary.

## Schedule Edits Are Prospective

Saving a new schedule must not retroactively reinterpret labor that was valid under the previous schedule.

Required sequence when saving schedule changes:

1. Reconcile the current running task and clock state against the old policy up to the save timestamp.
2. Validate and persist the new schedule.
3. Set the new policy effective timestamp to the save time.
4. Evaluate the current instant under the new policy.
5. If the new policy says the current running task may not continue, stop it at the save timestamp, not at a newly introduced past boundary.

Future reconciliation must not search for new-policy prohibited boundaries before the new policy effective timestamp.

This prevents an edit at 10:10 AM that newly introduces a 10:00 AM Break from deleting already-earned time before 10:10.

The same prospective rule applies to current-shift Break/Lunch override changes.

## Device Time and Timezone

The device's local wall clock and timezone are authoritative.

- Day-of-week calculations use local device dates.
- Overnight boundaries use local calendar construction rather than fixed UTC offsets.
- Daylight-saving transitions therefore follow the device timezone rules.
- Manual device-clock changes are not treated as fraud/tamper events; the next reconciliation uses the device's current local time.

## Settings Validation

The app must refuse to save invalid schedules with concise, specific feedback.

Validation includes:

- Clock In and Clock Out may not be the same wall-clock time.
- A Clock Out earlier than Clock In is a valid overnight shift ending the following day.
- Enabled Break must have a valid time and positive duration.
- Enabled Lunch must have a valid time and positive duration.
- Enabled Break/Lunch windows must map inside the shift span.
- Break and Lunch may not overlap.
- A pause duration may not extend beyond Clock Out.
- Parsed hour/minute values must remain within valid ranges.

Disabled Break/Lunch rows may retain their entered times and durations so re-enabling does not require re-entry.

## UI Feedback in Task Logging

Task Logging should expose a compact schedule/clock status so users understand why Start is or is not available.

Examples include:

- `Shift: Clocked Out`
- `Shift: Working`
- `Break until 9:15 AM`
- `Lunch until 12:30 PM`
- `Shift ended • Clock In for overtime`
- `Unscheduled work`
- `Overtime`

This feedback must follow existing Fabri-Cadabra styling and should not overwhelm the Task Logging page.

## Confirmation Copy Requirements

Exact copy can be polished during implementation, but confirmations must disclose consequences clearly.

### Enable

Explain that manual Clock In becomes required and active timers will be governed by Break, Lunch, scheduled Clock Out, and workday rules.

### Disable

Explain that Task Logging will return to unrestricted pre-v1.0.2 behavior and automatic schedule protection will be off.

### Clock In

Normal Clock In should confirm entry into the current scheduled shift.

Overtime Clock In should explicitly say the scheduled shift has ended and the user is clocking in for overtime.

Unscheduled Clock In should explicitly say today is not a scheduled workday and ask whether to continue with unscheduled work.

### Clock Out

Warn that any running Task Logging timer will be stopped immediately.

## Versioning and Changelog

`fabrication_pro_capacitor/package.json` remains the single canonical application version source.

Implementation will bump the app from `1.0.1` to `1.0.2` in `package.json`; the existing version-sync script remains responsible for the browser-readable generated marker.

The in-app changelog must place v1.0.2 above v1.0.1 and explain the feature behavior in plain language, not merely list the feature name.

The v1.0.2 entry must disclose all of the following:

- Shift Schedule added in Settings.
- Configurable inclusive workday range.
- Clock In, Break, Lunch, and Clock Out configuration.
- Green Clock In and red Clock Out header controls.
- Manual Clock In required when Shift Schedule is enabled.
- Early and late clock-ins are allowed.
- Break/Lunch may be independently enabled or disabled.
- Current-shift Break/Lunch overrides reset for the next scheduled shift.
- Running timers automatically stop at enabled Break/Lunch boundaries.
- Timers never auto-restart after Break/Lunch.
- Scheduled Clock Out stops a running task and forces Clocked Out state.
- Overtime clock-in is permitted after scheduled Clock Out and continues until manual Clock Out.
- Unscheduled-day clock-in is permitted after confirmation and continues until manual Clock Out.
- Overnight shifts are supported.
- Background/locked/reopened apps reconcile task sessions to the exact first prohibited boundary.
- Disabling Shift Schedule restores original unrestricted Task Logging behavior.

## Error Handling and Recovery

If the new storage record is absent, corrupt, or unsupported:

- default Shift Schedule to disabled;
- do not block existing Task Logging;
- do not mutate existing task data merely because schedule state could not be read;
- surface a recoverable Settings message if user action is needed.

Persistence writes should continue following the app's existing localStorage error-handling conventions.

A failed schedule save must leave the last valid persisted schedule intact.

## Compatibility Requirements

The implementation must not change:

- Capacitor app ID `com.fabricationpro.app`;
- existing Task Logging job storage key and format;
- existing Task Logging preset storage key and format;
- existing Task Logging `running`, `startedAt`, `accumulatedMs` fields;
- existing session object shape;
- fabrication formulas;
- optimizer behavior;
- native import/export compatibility;
- existing Pages navigation behavior;
- the established natural height of the nine original Pages drawer buttons.

## Verification Strategy

Implementation follows TDD and must introduce focused automated checks before production promotion.

Required coverage includes:

1. Shift Schedule disabled preserves current Task Logging behavior.
2. Enabling schedule stops an existing running task at enable time and starts Clocked Out.
3. Task start is rejected while Clocked Out.
4. Early Clock In permits immediate task start.
5. Late Clock In works during an active scheduled shift.
6. Clock In during Break/Lunch succeeds but task start remains blocked.
7. Break auto-stop uses exact Break start timestamp.
8. Lunch auto-stop uses exact Lunch start timestamp.
9. No auto-restart occurs at Break/Lunch end.
10. Scheduled Clock Out stops the task at the exact boundary and forces Clocked Out.
11. Manual Clock Out stops at actual device time.
12. Overtime re-clock-in works after forced Clock Out and persists until manual Clock Out.
13. Unscheduled-day clock-in requires confirmation and ignores unrelated schedule boundaries.
14. Overnight scheduled shifts are recognized across midnight.
15. Wrapped workday ranges such as Friday through Tuesday are recognized.
16. Same start/end day means one scheduled start day.
17. Equal Clock In/Clock Out wall-clock times are rejected.
18. Friday overnight shift may end Saturday even when Saturday is not a scheduled start day.
19. Current-shift Break/Lunch overrides survive reload and manual re-clock-in within the same shift.
20. Current-shift overrides reset after the scheduled shift instance ends.
21. Current-shift override changes are prospective and never auto-restart a stopped task.
22. App resume after crossing a boundary closes the task at the first prohibited boundary, not resume time.
23. Resume after Break and later Clock Out stops task at Break but also restores Clocked Out state at Clock Out.
24. Schedule edits are prospective and do not retroactively truncate prior valid labor.
25. Invalid schedules cannot replace the last valid stored schedule.
26. Existing Task Logging import/export/session compatibility remains unchanged.
27. Version sync resolves exactly to `1.0.2` from `package.json`.
28. Changelog ordering remains newest-first and contains the required v1.0.2 disclosures.
29. Existing Settings and drawer regression tests continue to pass.
30. The original nine Pages buttons retain their pre-Settings natural row height.
31. Full `npm run verify` passes.
32. Android installer workflow passes, including signing verification.
33. iPhone unsigned IPA workflow passes.

## Deployment Workflow

After the written design and implementation plan are approved, implementation should follow the project's established flow:

1. TDD: add failing verification first.
2. Implement on the v1.0.2 feature branch.
3. Run the complete local/project verification suite.
4. Stage the tested commit to `work`.
5. Verify Android and iPhone installer workflows from staging.
6. Review exact diffs and regression checks.
7. Fast-forward `main` only when clean.
8. Verify GitHub Pages and production installer workflows/artifacts from `main`.

No implementation begins from this design document until the user reviews and approves the written spec.
