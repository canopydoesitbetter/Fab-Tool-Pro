from pathlib import Path

p=Path('fabrication_pro_capacitor/www/index.html')
s=p.read_text()
old='''        <section class="card tasklog-jobs-card">
          <div class="tasklog-card-head">
            <h2>Jobs</h2>
            <span id="taskLogJobCount" class="tasklog-count">0</span>
          </div>
          <div id="taskLogJobList" class="tasklog-job-list" aria-label="Task logging jobs"></div>
        </section>'''
new='''        <details id="taskLogJobsDetails" class="card management-details tasklog-jobs-card">
          <summary class="management-summary"><span>Jobs</span><span class="management-summary-state"><span id="taskLogJobCount" class="tasklog-count">0</span> saved</span></summary>
          <div class="management-details-body">
            <div id="taskLogJobList" class="tasklog-job-list" aria-label="Task logging jobs"></div>
          </div>
        </details>'''
if old not in s:
    raise SystemExit('Task Logging Jobs card not found')
p.write_text(s.replace(old,new,1))
