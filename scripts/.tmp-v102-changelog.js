  function changelogMarkup() {
    return `
      <article class='changelog-entry changelog-release' data-changelog-version='current'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version ${FABRI_CADABRA_VERSION}</span>
            <h2>Shift Schedule &amp; Clock Controls</h2>
          </div>
        </div>
        <ul>
          <li>Added Shift Schedule in Settings with an inclusive, cyclic scheduled-workday range plus configurable Clock In, Break, Lunch, and Clock Out times.</li>
          <li>Added a green CLOCK IN button and red CLOCK OUT button in the main Fabri-Cadabra header, with clear confirmation before either clock action.</li>
          <li>When Shift Schedule is enabled, manual Clock In is required before Task Logging timers can start; early or late Clock In is allowed so the schedule does not become a hindrance.</li>
          <li>Break and Lunch can be independently enabled. During an established scheduled shift, each small toggle becomes a current-shift override that resets for the next scheduled shift.</li>
          <li>A running task stops at the exact configured Break or Lunch start. Task timers never restart automatically when Break or Lunch ends; the user deliberately starts the next task session.</li>
          <li>Scheduled Clock Out stops any running task at the exact scheduled boundary and forces Clocked Out state, even when the app was locked, backgrounded, or suspended.</li>
          <li>After scheduled Clock Out, the user can Clock In again for overtime. Overtime continues until the user manually clocks out and does not inherit the already-passed schedule boundaries.</li>
          <li>On a non-scheduled workday, Clock In offers an unscheduled work confirmation. Confirmed unscheduled work continues until manual Clock Out without borrowing another day's Break, Lunch, or Clock Out.</li>
          <li>Supported overnight shifts: the shift belongs to the scheduled day it starts, so a Friday overnight shift may correctly finish Saturday morning.</li>
          <li>When the phone locks, the app backgrounds, or Fabri-Cadabra is reopened, Task Logging reconciles to the first prohibited boundary that was crossed instead of counting time until wake-up.</li>
          <li>Schedule and current-shift override edits are prospective; they do not retroactively erase already-earned labor time.</li>
          <li>Disabling Shift Schedule restores the original unrestricted Task Logging behavior and preserves the saved schedule for later re-enabling.</li>
        </ul>
      </article>
      <article class='changelog-entry changelog-release' data-changelog-version='1.0.1'>
        <div class='changelog-entry-heading'>
          <div>
            <span class='changelog-version-label'>Version 1.0.1</span>
            <h2>Settings &amp; Changelog</h2>
          </div>
        </div>
        <ul>
          <li>Added Settings page.</li>
          <li>Added permanent Settings access at the bottom of the Pages drawer.</li>
          <li>Added in-app Changelog.</li>
          <li>Added application version tracking.</li>
          <li>Established newest-first changelog ordering.</li>
        </ul>
      </article>
      ${currentFeaturesChangelogMarkup()}`;
  }
