import type { StudentProfile, StudentPreference } from '@/types'
import type { StudentWithPreferences, PlacementSummary } from '@/types'

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) {
    alert('Please allow pop-ups to generate PDF documents.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 500)
}

const printStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1e293b; padding: 40px; }
  .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 22px; color: #1e3a5f; letter-spacing: 0.5px; }
  .header p { font-size: 13px; color: #64748b; margin-top: 4px; }
  .slip-badge { display: inline-block; background: #059669; color: white; padding: 4px 16px; border-radius: 4px; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px; }
  .info-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; }
  .info-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-family: 'Arial', sans-serif; }
  .info-value { font-size: 15px; font-weight: bold; color: #1e293b; margin-top: 4px; font-family: 'Arial', sans-serif; }
  .dept-box { background: #f0fdf4; border: 2px solid #059669; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px; }
  .dept-label { font-size: 12px; text-transform: uppercase; color: #059669; font-family: 'Arial', sans-serif; letter-spacing: 1px; }
  .dept-name { font-size: 24px; font-weight: bold; color: #065f46; margin-top: 8px; }
  .rank-list { margin-bottom: 30px; }
  .rank-list h3 { font-size: 14px; color: #475569; margin-bottom: 12px; font-family: 'Arial', sans-serif; }
  .rank-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-family: 'Arial', sans-serif; }
  .rank-num { width: 28px; height: 28px; border-radius: 50%; background: #1e3a5f; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
  .rank-item.placed .rank-num { background: #059669; }
  .rank-item.placed .rank-dept { font-weight: bold; color: #065f46; }
  .rank-dept { font-size: 14px; color: #334155; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-family: 'Arial', sans-serif; }
  .footer-item { font-size: 11px; color: #94a3b8; }
  .signature { margin-top: 60px; text-align: right; font-family: 'Arial', sans-serif; }
  .signature-line { width: 200px; border-top: 1px solid #475569; margin-left: auto; margin-top: 40px; padding-top: 6px; font-size: 12px; color: #475569; }
  @media print { body { padding: 20px; } @page { margin: 1cm; } }
`

export function generatePlacementSlip(
  profile: StudentProfile,
  preferences: StudentPreference
) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const rankItems = preferences.ranked_departments
    .map((dept, i) => {
      const isPlaced = preferences.status === 'placed' && preferences.placed_department === dept
      return `<div class="rank-item ${isPlaced ? 'placed' : ''}">
        <div class="rank-num">${i + 1}</div>
        <span class="rank-dept">${dept}</span>
        ${isPlaced ? '<span style="margin-left:auto;color:#059669;font-size:12px;font-weight:bold;font-family:Arial,sans-serif;">ASSIGNED</span>' : ''}
      </div>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Placement Slip - ${profile.full_name}</title>
<style>${printStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Mekdela Amba University</h1>
    <p>Office of the Registrar - Student Department Placement System</p>
  </div>

  <div style="text-align:center;">
    <span class="slip-badge">PLACEMENT CONFIRMATION SLIP</span>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Full Name</div>
      <div class="info-value">${profile.full_name}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Student ID</div>
      <div class="info-value">${profile.student_id}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Stream</div>
      <div class="info-value">${profile.stream}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Composite Score</div>
      <div class="info-value">${profile.composite_score > 0 ? Number(profile.composite_score).toFixed(2) : '—'}</div>
    </div>
  </div>

  <div class="dept-box">
    <div class="dept-label">Assigned Department</div>
    <div class="dept-name">${preferences.placed_department ?? '—'}</div>
  </div>

  <div class="rank-list">
    <h3>Department Preferences Submitted</h3>
    ${rankItems}
  </div>

  <div class="footer">
    <div class="footer-item">Date Issued: ${dateStr}</div>
    <div class="footer-item">Status: ${preferences.status.toUpperCase()}</div>
  </div>

  <div class="signature">
    <div class="signature-line">Registrar's Signature &amp; Stamp</div>
  </div>
</body>
</html>`

  openPrintWindow(html)
}

export function generatePlacementReport(
  students: StudentWithPreferences[],
  summaries: PlacementSummary[]
) {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const placedStudents = students.filter((s) => s.status === 'placed' && s.ranked_departments)
  const rejectedStudents = students.filter((s) => s.status === 'rejected' && s.ranked_departments)

  const departmentsWithStudents = [...new Set(placedStudents.map((s) => s.placed_department!))].sort()

  const deptSections = departmentsWithStudents.map((dept) => {
    const deptStudents = placedStudents.filter((s) => s.placed_department === dept)
    const summary = summaries.find((sm) => sm.department_name === dept)
    const capacity = summary?.capacity ?? 0

    const rows = deptStudents.map((s, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td>${s.full_name}</td>
        <td style="font-family:monospace;font-size:11px;">${s.student_id}</td>
        <td style="text-align:center;">${s.gpa ? Number(s.gpa).toFixed(2) : '—'}</td>
        <td style="text-align:center;">${s.entrance_result ? Number(s.entrance_result).toFixed(1) : '—'}</td>
        <td style="text-align:center;font-weight:bold;">${s.composite_score > 0 ? Number(s.composite_score).toFixed(2) : '—'}</td>
        <td style="text-align:center;">${s.stream}</td>
      </tr>`).join('')

    return `
      <div style="margin-bottom:24px;">
        <div style="background:#1e3a5f;color:white;padding:8px 16px;border-radius:6px 6px 0 0;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">
          ${dept} &mdash; ${deptStudents.length}/${capacity} filled
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
              <th style="padding:6px 8px;text-align:center;width:40px;">#</th>
              <th style="padding:6px 8px;text-align:left;">Full Name</th>
              <th style="padding:6px 8px;text-align:left;">Student ID</th>
              <th style="padding:6px 8px;text-align:center;">GPA</th>
              <th style="padding:6px 8px;text-align:center;">Entrance</th>
              <th style="padding:6px 8px;text-align:center;">Composite</th>
              <th style="padding:6px 8px;text-align:center;">Stream</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  const rejectedSection = rejectedStudents.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="background:#dc2626;color:white;padding:8px 16px;border-radius:6px 6px 0 0;font-size:14px;font-weight:bold;font-family:Arial,sans-serif;">
        Not Placed (${rejectedStudents.length})
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:Arial,sans-serif;">
        <thead>
          <tr style="background:#fef2f2;border-bottom:2px solid #fecaca;">
            <th style="padding:6px 8px;text-align:center;width:40px;">#</th>
            <th style="padding:6px 8px;text-align:left;">Full Name</th>
            <th style="padding:6px 8px;text-align:left;">Student ID</th>
            <th style="padding:6px 8px;text-align:center;">Composite</th>
            <th style="padding:6px 8px;text-align:center;">Stream</th>
          </tr>
        </thead>
        <tbody>
          ${rejectedStudents.map((s, i) => `
            <tr style="border-bottom:1px solid #fee2e2;">
              <td style="padding:6px 8px;text-align:center;">${i + 1}</td>
              <td style="padding:6px 8px;">${s.full_name}</td>
              <td style="padding:6px 8px;font-family:monospace;font-size:11px;">${s.student_id}</td>
              <td style="padding:6px 8px;text-align:center;font-weight:bold;">${s.composite_score > 0 ? Number(s.composite_score).toFixed(2) : '—'}</td>
              <td style="padding:6px 8px;text-align:center;">${s.stream}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''

  const summaryStats = `
    <div style="display:flex;gap:16px;margin-bottom:24px;font-family:Arial,sans-serif;">
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Total Placed</div>
        <div style="font-size:24px;font-weight:bold;color:#059669;">${placedStudents.length}</div>
      </div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Not Placed</div>
        <div style="font-size:24px;font-weight:bold;color:#dc2626;">${rejectedStudents.length}</div>
      </div>
      <div style="flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;">Departments Filled</div>
        <div style="font-size:24px;font-weight:bold;color:#1e3a5f;">${departmentsWithStudents.length}</div>
      </div>
    </div>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Placement Report - ${dateStr}</title>
<style>${printStyles}</style>
</head>
<body>
  <div class="header">
    <h1>Mekdela Amba University</h1>
    <p>Office of the Registrar - Department Placement Summary Report</p>
  </div>

  <div style="text-align:center;margin-bottom:24px;">
    <span class="slip-badge" style="background:#1e3a5f;">PLACEMENT SUMMARY REPORT</span>
    <p style="font-size:12px;color:#64748b;font-family:Arial,sans-serif;margin-top:8px;">Generated on ${dateStr}</p>
  </div>

  ${summaryStats}

  ${deptSections}

  ${rejectedSection}

  <div class="footer">
    <div class="footer-item">Report generated by the Placement System</div>
    <div class="footer-item">Mekdela Amba University &copy; ${new Date().getFullYear()}</div>
  </div>

  <div class="signature">
    <div class="signature-line">Registrar's Signature &amp; Stamp</div>
  </div>
</body>
</html>`

  openPrintWindow(html)
}
