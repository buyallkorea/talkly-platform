# TALKLY manual monthly teaching-hours form

Source: user-provided Talkly_Teacher_Monthly_Payroll_English.xlsx (three sheets).
Scope: standalone teacher-entered form with administrator read-only review. Do NOT connect classroom scheduling, student attendance, payroll rates, enrollments, billing or payments.

## Teacher workflow
- Teacher Portal > My Teaching Hours (/teacher/teaching-hours).
- Choose month and reporting time zone, manually enter student name or ✓ then click 30-minute cells; 06:00 to 24:00, seven-day week view.
- Each marked cell counts exactly 30 minutes; daily, Monday–Sunday weekly, monthly totals update automatically.
- The Student Roster & Recurring Schedule section is an optional plain-text memo, not an enrollment list or a scheduler.
- Save draft or submit. Corrections after submission are permitted and versioned; every save uses revision collision detection.
- No hourly rate or pay amount is calculated; class time is only teacher self-report.

## Administrator workflow
- Admin > 강사 수업시간 보고서 (/admin/payroll) shows saved teacher reports by month, including draft/submitted state.
- Click a teacher row to see the same blocks, totals, roster notes, teacher notes and recent revisions read-only.
- Admin cannot modify, approve, pay or transfer funds through this module.

## Security and release checks
- New public.teacher_manual_timesheets and public.teacher_manual_timesheet_versions tables: RLS enabled; no anon/authenticated grants.
- Server route verifies fresh Auth, teacher profile role, active status, same-origin request, input shape and expected revision.
- Service-only SECURITY INVOKER SQL function saves record + history atomically; input supplied via verified Auth user ID.
- Admin reads only after role check. Teacher sees only their own report.
- Preview writes disabled; live browser end-to-end still requires authorized teacher and admin test accounts.
- Existing classroom and payment features remain unchanged. DB change is additive only.

## Source fidelity and limitations
- The workbook also contains example hourly rates/pay columns. Those are intentionally excluded here because management requested a report form only, not payroll processing.
- Original 30-minute cell convention is retained. Actual 25-minute/50-minute lessons need a separate policy; never assume this form verifies contractual pay.
- No automatic notifications, enrollment lookup, PDF/Excel generation or bank payment integration.
