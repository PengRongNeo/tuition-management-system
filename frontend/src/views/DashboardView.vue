<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header">
        <div class="page-header-row">
          <div>
            <h1>{{ dashboardPageTitle }}</h1>
            <p>{{ dashboardPageSubtitle }}</p>
          </div>
          <div class="dashboard-header-controls">
            <div class="period-toggle" role="tablist" aria-label="Summary period">
              <button
                type="button"
                role="tab"
                :aria-selected="dashboardPeriod === 'weekly'"
                :class="['period-toggle-btn', { active: dashboardPeriod === 'weekly' }]"
                @click="dashboardPeriod = 'weekly'"
              >
                Weekly
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="dashboardPeriod === 'monthly'"
                :class="['period-toggle-btn', { active: dashboardPeriod === 'monthly' }]"
                @click="dashboardPeriod = 'monthly'"
              >
                Monthly
              </button>
            </div>
            <label class="teacher-filter">
              <span class="teacher-filter-label">Teacher</span>
              <select v-model="selectedTeacherId" class="teacher-filter-select" aria-label="Filter by teacher">
                <option
                  v-for="opt in teacherOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </label>
          </div>
        </div>
        <p class="period-subtitle">{{ periodSubtitle }}</p>
      </header>

      <div class="dashboard-stats grid grid-2">
        <div
          class="card card-stat card-stat-classes card-stat-clickable"
          role="button"
          tabindex="0"
          aria-label="View Classes breakdown"
          @click="openDashboardDetail('classes')"
          @keydown.enter.prevent="openDashboardDetail('classes')"
          @keydown.space.prevent="openDashboardDetail('classes')"
        >
          <h3>Classes</h3>
          <p class="stat-number">
            {{ conductedClassesCount }} / {{ expectedClassesCount }}
          </p>
          <p class="stat-subtitle">
            <span class="stat-percent">{{ formatPercent(classesPercentage) }}</span>
            conducted out of scheduled
          </p>
          <p class="stat-click-hint">Click to view breakdown</p>
        </div>
        <div
          class="card card-stat card-stat-attendance card-stat-clickable"
          role="button"
          tabindex="0"
          aria-label="View Attendance breakdown"
          @click="openDashboardDetail('attendance')"
          @keydown.enter.prevent="openDashboardDetail('attendance')"
          @keydown.space.prevent="openDashboardDetail('attendance')"
        >
          <h3>Attendance</h3>
          <p class="stat-number">
            {{ attendanceSummary.presentLate }} / {{ attendanceSummary.total }}
          </p>
          <p class="stat-subtitle">
            <span class="stat-percent">{{ formatPercent(attendanceSummary.percentage) }}</span>
            present or late
          </p>
          <p class="stat-click-hint">Click to view breakdown</p>
        </div>
        <div
          class="card card-stat card-stat-revenue card-stat-clickable"
          role="button"
          tabindex="0"
          aria-label="View Revenue breakdown"
          @click="openDashboardDetail('revenue')"
          @keydown.enter.prevent="openDashboardDetail('revenue')"
          @keydown.space.prevent="openDashboardDetail('revenue')"
        >
          <h3>Revenue</h3>
          <p class="stat-number stat-number--revenue-compare">
            {{ formatCurrency(revenueForSelectedPeriod) }} / {{ formatCurrency(maxPossibleRevenueForSelectedPeriod) }}
          </p>
          <p class="stat-subtitle">
            <span class="stat-percent">{{ formatPercent(revenueEarnedPercentage) }} earned</span>
          </p>
          <p class="stat-hint">Actual revenue from chargeable attendance records</p>
          <p class="stat-click-hint">Click to view breakdown</p>
        </div>
        <div
          class="card card-stat card-stat-students card-stat-clickable"
          role="button"
          tabindex="0"
          aria-label="View Active Students"
          @click="openDashboardDetail('activeStudents')"
          @keydown.enter.prevent="openDashboardDetail('activeStudents')"
          @keydown.space.prevent="openDashboardDetail('activeStudents')"
        >
          <h3>Active Students</h3>
          <p class="stat-number">{{ activeStudentsCount }}</p>
          <p class="stat-subtitle">{{ activeStudentsStatSubtitle }}</p>
          <p class="stat-click-hint">Click to view breakdown</p>
        </div>
      </div>

      <!-- Weekly timetable: today, week summary, grid -->
      <section class="dashboard-timetable-section" aria-label="Class timetable">
        <div class="card dt-card">
          <h2 class="dt-section-title">{{ classesTodayTitle }}</h2>
          <p v-if="periodLoading" class="dt-loading">Loading class data…</p>
          <div
            v-else-if="todayTimetableClasses.length === 0"
            class="dt-empty"
          >
            No classes scheduled for today.
          </div>
          <ul v-else class="dt-today-list">
            <li
              v-for="(row, idx) in todayTimetableClasses"
              :key="'td-' + row.classId + '-' + idx"
              class="dt-today-card calendar-class-card"
              role="button"
              tabindex="0"
              :aria-label="'View class: ' + (row.className || 'Class')"
              :style="{
                borderLeftColor: getTimetableColor(row.classId, row.dayIndex)
              }"
              @click.stop="goToClass(row)"
              @keydown="onClassCardKeydown($event, row)"
            >
              <div class="dt-today-title">{{ row.className }}</div>
              <div class="dt-today-meta dt-today-teacher">{{ row.teacherName }}</div>
              <div class="dt-today-time">{{ row.timeLabel }}</div>
              <div class="dt-today-count">{{ row.studentCount }} students</div>
              <div class="dt-today-row">
                <span class="dt-today-rev">
                  <template v-if="row.revenueIsActual">Actual</template>
                  <template v-else>Est.</template>
                  — {{ formatCurrency(row.revenue) }}
                </span>
              </div>
              <div
                v-if="row.hasLessonRecord"
                class="dt-today-logged-hint"
                @click.stop
              >Lesson already logged</div>
              <div
                v-else
                class="dt-today-actions"
                @click.stop
              >
                <router-link
                  :to="{
                    name: 'LessonSubmission',
                    params: { classId: String(row.classId) },
                    query: { date: sessionDateToParam(row.sessionDate) }
                  }"
                  class="btn btn-primary btn-sm"
                >Log</router-link>
                <button
                  type="button"
                  class="btn btn-missed btn-sm"
                  @click="openMissedModal(row)"
                >Missed</button>
              </div>
            </li>
          </ul>
        </div>

        <div
          v-if="dashboardPeriod === 'weekly'"
          class="card dt-card"
        >
          <h2 class="dt-section-title">{{ classesWeekTitle }}</h2>
          <p v-if="periodLoading" class="dt-loading">Loading class data…</p>
          <div
            v-else-if="weekTimetableSessions.length === 0"
            class="dt-empty"
          >
            No classes scheduled this week.
          </div>
          <div v-else>
            <div class="dt-week-kpis">
              <div class="dt-kpi">
                <span class="dt-kpi-label">Total classes</span>
                <span class="dt-kpi-value">{{ weekTimetableSessions.length }}</span>
              </div>
              <div class="dt-kpi">
                <span class="dt-kpi-label">Total weekly revenue</span>
                <span class="dt-kpi-value">{{ formatCurrency(weekTimetableRevenueTotal) }}</span>
              </div>
              <div class="dt-kpi">
                <span class="dt-kpi-label">Sessions left this week</span>
                <span class="dt-kpi-value">{{ weekSessionsLeftCount }}</span>
              </div>
            </div>
            <div class="dt-week-grouped">
              <div
                v-for="block in weekGroupedByDay"
                :key="block.dayIndex"
                class="dt-day-block"
              >
                <h3 class="dt-day-name">{{ block.dayLabel }}</h3>
                <ul class="dt-day-sessions">
                  <li
                    v-for="s in block.sessions"
                    :key="s._key"
                    class="dt-week-session calendar-class-card"
                    role="button"
                    tabindex="0"
                    :aria-label="'View class: ' + (s.className || 'Class')"
                    @click.stop="goToClass(s)"
                    @keydown="onClassCardKeydown($event, s)"
                  >
                    <div class="dt-week-session-line">
                      <span class="dt-week-session-name">{{ s.className }}</span>
                      <span class="dt-week-session-time">{{ s.timeLabel }}</span>
                    </div>
                    <div class="dt-week-session-count">{{ s.studentCount }} students</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="dashboardPeriod === 'weekly'"
          class="card dt-card dt-calendar-card"
        >
          <h2 class="dt-section-title">{{ weeklyCalendarTitle }}</h2>
          <p v-if="periodLoading" class="dt-loading">Loading class data…</p>
          <p v-else class="dt-calendar-sub">
            Weekdays: 3:00 PM – 9:30 PM · Weekends: 8:30 AM – 9:30 PM
          </p>
          <div v-if="!periodLoading" class="timetable-split">
            <!-- Weekday Mon–Fri, 3 PM start -->
            <div class="timetable-section">
              <h3 class="timetable-section-title">Weekday Schedule</h3>
              <p class="timetable-section-hint">Monday to Friday · 3:00 PM to 9:30 PM</p>
              <div
                class="timetable-scroll"
              >
                <div
                  class="timetable-outer timetable-outer--weekday"
                  :style="{
                    '--timetable-slot-px': TIMETABLE_SLOT_PX + 'px',
                    '--timetable-body-px': timetableBodyPixelHeightWeekday + 'px'
                  }"
                >
                  <div class="timetable-top">
                    <div class="timetable-corner" aria-hidden="true" />
                    <div
                      v-for="col in timetableWeekdayColumns"
                      :key="col.id + 'h-wd'"
                      class="tt-day-head"
                    >
                      <span class="tt-day-short">{{ col.short }}</span>
                      <span class="tt-day-date">{{ col.dateLabel }}</span>
                    </div>
                  </div>
                  <div class="timetable-bottom">
                    <div
                      class="tt-time-rail"
                      :aria-label="'Time from 3 PM to 9:30 PM, every 30 minutes (Monday–Friday)'"
                    >
                      <div
                        v-for="(sl, si) in timetableTimeSlotsWeekday"
                        :key="'tw-' + si"
                        class="tt-time-cell"
                      >
                        {{ sl.label }}
                      </div>
                    </div>
                    <div
                      v-for="col in timetableWeekdayColumns"
                      :key="'col-wd-' + col.id"
                      class="tt-day-col"
                    >
                      <div class="tt-grid-bg" aria-hidden="true">
                        <div
                          v-for="n in TIMETABLE_BODY_SLOTS_WEEKDAY"
                          :key="col.id + 'gw' + n"
                          class="tt-grid-line"
                        />
                      </div>
                      <div
                        v-for="session in getMergedSessionsForTimetableDay(col.dayIndex)"
                        :key="'wd-' + session._key"
                        class="tt-block calendar-class-card"
                        :class="{
                          'tt-block--est': !session.revenueIsActual,
                          'tt-block--merged': session.kind === 'merged'
                        }"
                        :role="session.kind === 'merged' ? 'group' : 'button'"
                        :tabindex="session.kind === 'merged' ? -1 : 0"
                        :aria-label="
                          session.kind === 'merged'
                            ? 'Classes: ' + session.parts.map((p) => p.className).join(', ')
                            : 'View class: ' + (session.className || 'Class')
                        "
                        :style="timetableBlockStyleWeekday(session.startMin, session.endMin, session.classId, session.dayIndex)"
                        @click.stop="onTimetableBlockClick(session)"
                        @keydown="onTimetableBlockKeydown($event, session)"
                      >
                        <template v-if="session.kind === 'merged'">
                          <div class="tt-block-teacher">{{ session.teacherName }}</div>
                          <div class="tt-block-time">{{ session.timeLabel }}</div>
                          <div class="tt-block-merged-list" role="list">
                            <div
                              v-for="p in session.parts"
                              :key="p._key"
                              class="tt-block-merged-row"
                              role="listitem"
                            >
                              <router-link
                                :to="{ name: 'Class', params: { id: String(p.classId) } }"
                                class="tt-block-class-link"
                                @click.stop
                              >
                                {{ p.className }}
                                <span class="tt-block-foot"> · {{ p.studentCount }} students</span>
                              </router-link>
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="tt-block-title">{{ session.className }}</div>
                          <div class="tt-block-teacher">{{ session.teacherName }}</div>
                          <div class="tt-block-time">{{ session.timeLabel }}</div>
                          <div class="tt-block-foot">{{ session.studentCount }} students</div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Weekend Sat–Sun, 8:30 AM start -->
            <div class="timetable-section">
              <h3 class="timetable-section-title">Weekend Schedule</h3>
              <p class="timetable-section-hint">Saturday &amp; Sunday · 8:30 AM to 9:30 PM</p>
              <div
                class="timetable-scroll"
              >
                <div
                  class="timetable-outer timetable-outer--weekend"
                  :style="{
                    '--timetable-slot-px': TIMETABLE_SLOT_PX + 'px',
                    '--timetable-body-px': timetableBodyPixelHeightWeekend + 'px'
                  }"
                >
                  <div class="timetable-top">
                    <div class="timetable-corner" aria-hidden="true" />
                    <div
                      v-for="col in timetableWeekendColumns"
                      :key="col.id + 'h-we'"
                      class="tt-day-head"
                    >
                      <span class="tt-day-short">{{ col.short }}</span>
                      <span class="tt-day-date">{{ col.dateLabel }}</span>
                    </div>
                  </div>
                  <div class="timetable-bottom">
                    <div
                      class="tt-time-rail"
                      :aria-label="'Time from 8:30 AM to 9:30 PM, every 30 minutes (weekend)'"
                    >
                      <div
                        v-for="(sl, si) in timetableTimeSlotsWeekend"
                        :key="'twe-' + si"
                        class="tt-time-cell"
                      >
                        {{ sl.label }}
                      </div>
                    </div>
                    <div
                      v-for="col in timetableWeekendColumns"
                      :key="'col-we-' + col.id"
                      class="tt-day-col"
                    >
                      <div class="tt-grid-bg" aria-hidden="true">
                        <div
                          v-for="n in TIMETABLE_BODY_SLOTS_WEEKEND"
                          :key="col.id + 'gwe' + n"
                          class="tt-grid-line"
                        />
                      </div>
                      <div
                        v-for="session in getMergedSessionsForTimetableDay(col.dayIndex)"
                        :key="'we-' + session._key"
                        class="tt-block calendar-class-card"
                        :class="{
                          'tt-block--est': !session.revenueIsActual,
                          'tt-block--merged': session.kind === 'merged'
                        }"
                        :role="session.kind === 'merged' ? 'group' : 'button'"
                        :tabindex="session.kind === 'merged' ? -1 : 0"
                        :aria-label="
                          session.kind === 'merged'
                            ? 'Classes: ' + session.parts.map((p) => p.className).join(', ')
                            : 'View class: ' + (session.className || 'Class')
                        "
                        :style="timetableBlockStyleWeekend(session.startMin, session.endMin, session.classId, session.dayIndex)"
                        @click.stop="onTimetableBlockClick(session)"
                        @keydown="onTimetableBlockKeydown($event, session)"
                      >
                        <template v-if="session.kind === 'merged'">
                          <div class="tt-block-teacher">{{ session.teacherName }}</div>
                          <div class="tt-block-time">{{ session.timeLabel }}</div>
                          <div class="tt-block-merged-list" role="list">
                            <div
                              v-for="p in session.parts"
                              :key="p._key"
                              class="tt-block-merged-row"
                              role="listitem"
                            >
                              <router-link
                                :to="{ name: 'Class', params: { id: String(p.classId) } }"
                                class="tt-block-class-link"
                                @click.stop
                              >
                                {{ p.className }}
                                <span class="tt-block-foot"> · {{ p.studentCount }} students</span>
                              </router-link>
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="tt-block-title">{{ session.className }}</div>
                          <div class="tt-block-teacher">{{ session.teacherName }}</div>
                          <div class="tt-block-time">{{ session.timeLabel }}</div>
                          <div class="tt-block-foot">{{ session.studentCount }} students</div>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="dashboardPeriod === 'monthly'"
          class="card dt-card monthly-calendar-card"
        >
          <h2 class="dt-section-title">{{ monthlyCalendarTitle }}</h2>
          <p v-if="periodLoading" class="dt-loading">Loading class data…</p>
          <p v-else class="dt-calendar-sub">
            {{ currentMonthCalendarLabel }} · Week starts Monday
          </p>
          <div
            v-if="!periodLoading"
            class="monthly-cal"
          >
            <div
              class="monthly-cal-dow"
              aria-hidden="true"
            >
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
            <div
              v-for="(week, wi) in monthlyCalendarGrid.weeks"
              :key="'mw-' + wi"
              class="monthly-cal-row"
            >
              <div
                v-for="(cell, ci) in week"
                :key="cell.dateKey + '-' + ci"
                class="monthly-cal-cell"
                :class="{
                  'monthly-cal-cell--muted': !cell.inCurrentMonth
                }"
              >
                <div
                  class="monthly-cal-daynum"
                  :class="{ 'monthly-cal-daynum--muted': !cell.inCurrentMonth }"
                >
                  {{ cell.dayNum }}
                </div>
                <div class="monthly-cal-pills">
                  <button
                    v-for="ms in cell.sessions"
                    :key="ms._key"
                    type="button"
                    class="monthly-pill calendar-class-card"
                    :style="{
                      background: monthlyPillColor(ms.classId)
                    }"
                    :aria-label="'View class: ' + (ms.className || 'Class')"
                    @click="goToClass(ms)"
                    @keydown="onClassCardKeydown($event, ms)"
                  >
                    <span class="monthly-pill-name">{{ ms.className }}</span>
                    <span class="monthly-pill-time">{{ ms.timeLabel }}</span>
                    <span class="monthly-pill-count">{{ ms.studentCount }} students</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Detail breakdown modal -->
      <div
        v-if="dashboardDetailModal"
        class="modal-overlay"
        @click.self="closeDashboardDetail"
      >
        <div
          class="modal-content dashboard-detail-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="detailModalTitle"
        >
          <div class="dashboard-detail-header">
            <div>
              <h2>{{ detailModalTitle }}</h2>
              <p class="dashboard-detail-subtitle">{{ detailModalSubtitle }}</p>
            </div>
            <button
              type="button"
              class="dashboard-detail-close"
              aria-label="Close breakdown"
              @click="closeDashboardDetail"
            >
              &times;
            </button>
          </div>

          <!-- Classes breakdown -->
          <template v-if="dashboardDetailModal === 'classes'">
            <div class="dashboard-detail-summary">
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Total scheduled</span>
                <span class="dashboard-detail-stat-value">{{ classesBreakdown.total }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Conducted</span>
                <span class="dashboard-detail-stat-value">{{ classesBreakdown.conductedOnScheduleCount }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Missed / cancelled</span>
                <span class="dashboard-detail-stat-value">{{ classesBreakdown.missedOnScheduleCount }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Not recorded yet</span>
                <span class="dashboard-detail-stat-value">{{ classesBreakdown.notRecordedCount }}</span>
              </div>
            </div>

            <section class="dashboard-detail-section">
              <h3>Conducted Classes — {{ classesBreakdown.conducted.length }}</h3>
              <div v-if="classesBreakdown.conducted.length === 0" class="dashboard-detail-empty">
                No classes conducted yet in this period.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Lesson Date</th>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(s, idx) in classesBreakdown.conducted" :key="`c-${idx}`">
                      <td>{{ formatFullDate(s.date) }}</td>
                      <td>{{ formatDayName(s.date) }}</td>
                      <td>{{ formatTimeRange(s.startTime, s.endTime) }}</td>
                      <td>{{ s.className }}</td>
                      <td>{{ s.teacherName }}</td>
                      <td><span class="pill pill-success">Conducted</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="dashboard-detail-section">
              <h3>Missed or Cancelled — {{ classesBreakdown.missed.length }}</h3>
              <div v-if="classesBreakdown.missed.length === 0" class="dashboard-detail-empty">
                No missed or cancelled class sessions recorded in this period.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Lesson Date</th>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Remark</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(s, idx) in classesBreakdown.missed" :key="`m-${idx}`">
                      <td>{{ formatFullDate(s.date) }}</td>
                      <td>{{ formatDayName(s.date) }}</td>
                      <td>{{ formatTimeRange(s.startTime, s.endTime) }}</td>
                      <td>{{ s.className }}</td>
                      <td>{{ s.teacherName }}</td>
                      <td>{{ s.remark || '—' }}</td>
                      <td><span class="pill pill-missed">Missed</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="dashboard-detail-section">
              <h3>Scheduled but Not Yet Recorded — {{ classesBreakdown.notConducted.length }}</h3>
              <div v-if="classesBreakdown.notConducted.length === 0" class="dashboard-detail-empty">
                All scheduled classes in this period have lesson records.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Scheduled Date</th>
                      <th>Day</th>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(s, idx) in classesBreakdown.notConducted" :key="`nc-${idx}`">
                      <td>{{ formatFullDate(s.date) }}</td>
                      <td>{{ formatDayName(s.date) }}</td>
                      <td>{{ formatTimeRange(s.startTime, s.endTime) }}</td>
                      <td>{{ s.className }}</td>
                      <td>{{ s.teacherName }}</td>
                      <td><span class="pill pill-warning">Not conducted yet</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>

          <!-- Attendance breakdown -->
          <template v-else-if="dashboardDetailModal === 'attendance'">
            <div class="dashboard-detail-summary">
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">In attendance (excl. missed class)</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.total }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Missed class (cancelled) rows</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.missedClassSessionCount }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Present</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.present }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Late</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.late }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Absent (Valid)</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.absentValid }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Absent (Charged)</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.absentCharged }}</span>
              </div>
              <div class="dashboard-detail-stat dashboard-detail-stat-accent">
                <span class="dashboard-detail-stat-label">Present + Late</span>
                <span class="dashboard-detail-stat-value">{{ attendanceBreakdown.presentLate }}</span>
              </div>
            </div>

            <section class="dashboard-detail-section">
              <h3>Students Who Missed Lessons — {{ attendanceBreakdown.absentRecords.length }}</h3>
              <div v-if="attendanceBreakdown.absentRecords.length === 0" class="dashboard-detail-empty">
                No missed lessons in this period.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Lesson Date</th>
                      <th>Time</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Attendance Status</th>
                      <th class="num">Fee Charged</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(r, idx) in attendanceBreakdown.absentRecords" :key="`abs-${idx}`">
                      <td>{{ formatFullDate(r.lessonDate) }}</td>
                      <td>{{ formatTimeRange(r.startTime, r.endTime) }}</td>
                      <td>{{ r.studentName }}</td>
                      <td>{{ r.className }}</td>
                      <td>{{ r.status }}</td>
                      <td class="num">{{ formatCurrency(r.fee) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>

          <!-- Revenue breakdown -->
          <template v-else-if="dashboardDetailModal === 'revenue'">
            <div class="dashboard-detail-summary">
              <div class="dashboard-detail-stat dashboard-detail-stat-accent">
                <span class="dashboard-detail-stat-label">Actual revenue</span>
                <span class="dashboard-detail-stat-value">{{ formatCurrency(revenueForSelectedPeriod) }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Maximum possible revenue</span>
                <span class="dashboard-detail-stat-value">{{ formatCurrency(maxPossibleRevenueForSelectedPeriod) }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Percentage earned</span>
                <span class="dashboard-detail-stat-value">{{ formatPercent(revenueEarnedPercentage) }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Lesson revenue</span>
                <span class="dashboard-detail-stat-value">{{ formatCurrency(revenueLessonOnly) }}</span>
              </div>
              <div
                v-if="dashboardPeriod === 'monthly' && billAdjustmentsSumForSelectedPeriod !== 0"
                class="dashboard-detail-stat"
              >
                <span class="dashboard-detail-stat-label">Bill adjustments</span>
                <span class="dashboard-detail-stat-value">{{ formatCurrency(billAdjustmentsSumForSelectedPeriod) }}</span>
              </div>
              <div class="dashboard-detail-stat">
                <span class="dashboard-detail-stat-label">Conducted lessons</span>
                <span class="dashboard-detail-stat-value">{{ revenueBreakdown.rows.length }}</span>
              </div>
            </div>
            <p class="revenue-modal-note">Actual revenue is from chargeable attendance records. Maximum possible is from scheduled class sessions and active enrolled students.</p>

            <section class="dashboard-detail-section">
              <h3>Per-Lesson Revenue</h3>
              <div v-if="revenueBreakdown.rows.length === 0" class="dashboard-detail-empty">
                No conducted lessons in this period.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Lesson Date</th>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th class="num">Students Charged</th>
                      <th class="num">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="(row, idx) in revenueBreakdown.rows" :key="`rev-${idx}`">
                      <tr>
                        <td>{{ formatFullDate(row.lessonDate) }}</td>
                        <td>{{ formatTimeRange(row.startTime, row.endTime) }}</td>
                        <td>{{ row.className }}</td>
                        <td>{{ row.teacherName }}</td>
                        <td class="num">{{ row.studentsCharged }}</td>
                        <td class="num">{{ formatCurrency(row.revenue) }}</td>
                      </tr>
                      <tr v-if="row.chargedDetails.length > 0" class="detail-subrow">
                        <td colspan="6">
                          <ul class="charged-detail-list">
                            <li v-for="(d, i2) in row.chargedDetails" :key="`det-${idx}-${i2}`">
                              <span class="charged-detail-name">{{ d.studentName }}</span>
                              <span class="charged-detail-status">{{ d.status }}</span>
                              <span class="charged-detail-duration">{{ d.duration }}h</span>
                              <span class="charged-detail-fee">{{ formatCurrency(d.fee) }}</span>
                            </li>
                          </ul>
                        </td>
                      </tr>
                    </template>
                    <tr class="detail-total-row">
                      <td colspan="5" class="num">Lesson revenue total</td>
                      <td class="num">{{ formatCurrency(revenueLessonOnly) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="dashboard-detail-section">
              <h3>Maximum Revenue Breakdown</h3>
              <p class="revenue-section-hint">Each scheduled class occurrence: rate/hour × default duration × active students enrolled.</p>
              <div v-if="maximumRevenueBreakdownRows.length === 0" class="dashboard-detail-empty">
                No scheduled class sessions in this period.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Date / Occurrence</th>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th class="num">Students (active)</th>
                      <th class="num">Rate / h</th>
                      <th class="num">Duration (h)</th>
                      <th class="num">Max revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(mrow, midx) in maximumRevenueBreakdownRows"
                      :key="`mrev-${midx}`"
                    >
                      <td>{{ formatFullDate(mrow.date) }} ({{ formatDayName(mrow.date) }})</td>
                      <td>{{ formatTimeRange(mrow.startTime, mrow.endTime) }}</td>
                      <td>{{ mrow.className }}</td>
                      <td>{{ mrow.teacherName }}</td>
                      <td class="num">{{ mrow.studentCount }}</td>
                      <td class="num">{{ formatCurrency(mrow.ratePerHour) }}</td>
                      <td class="num">{{ mrow.durationHours }}</td>
                      <td class="num">{{ formatCurrency(mrow.maxRevenue) }}</td>
                    </tr>
                    <tr class="detail-total-row">
                      <td colspan="7" class="num">Maximum possible (sum)</td>
                      <td class="num">{{ formatCurrency(maxPossibleRevenueForSelectedPeriod) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section
              v-if="dashboardPeriod === 'monthly' && revenueModalBillAdjustmentRows.length > 0"
              class="dashboard-detail-section"
            >
              <h3>Bill Adjustments</h3>
              <div class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Adjustment</th>
                      <th>Month</th>
                      <th class="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(br, bidx) in revenueModalBillAdjustmentRows"
                      :key="`badj-${bidx}`"
                    >
                      <td>{{ br.studentName }}</td>
                      <td>{{ br.type }}</td>
                      <td>{{ br.monthKey }}</td>
                      <td class="num">{{ formatSignedCurrency(br.amount) }}</td>
                    </tr>
                    <tr class="detail-total-row">
                      <td colspan="3" class="num">Adjustments total</td>
                      <td class="num">{{ formatCurrency(revenueModalAdjustmentsSum) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section
              v-if="dashboardPeriod === 'monthly'"
              class="dashboard-detail-section bill-adj-revenue-totals"
            >
              <div class="bill-rev-summary">
                <div class="bill-rev-line">
                  <span>Lesson revenue total</span>
                  <strong>{{ formatCurrency(revenueLessonOnly) }}</strong>
                </div>
                <div class="bill-rev-line">
                  <span>Adjustments total</span>
                  <strong>{{ formatCurrency(billAdjustmentsSumForSelectedPeriod) }}</strong>
                </div>
                <div class="bill-rev-line bill-rev-line-final">
                  <span>Final revenue total</span>
                  <strong>{{ formatCurrency(revenueForSelectedPeriod) }}</strong>
                </div>
              </div>
            </section>
          </template>

          <!-- Active students breakdown -->
          <template v-else-if="dashboardDetailModal === 'activeStudents'">
            <div class="dashboard-detail-summary">
              <div class="dashboard-detail-stat dashboard-detail-stat-accent">
                <span class="dashboard-detail-stat-label">Active students</span>
                <span class="dashboard-detail-stat-value">{{ activeStudentsList.length }}</span>
              </div>
            </div>

            <section class="dashboard-detail-section">
              <h3>Currently Active</h3>
              <div v-if="activeStudentsList.length === 0" class="dashboard-detail-empty">
                No active students yet.
              </div>
              <div v-else class="detail-table-scroll">
                <table class="table detail-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Level</th>
                      <th>School</th>
                      <th>Parent Name</th>
                      <th>Parent Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in activeStudentsList" :key="s.id">
                      <td>{{ s.name || '—' }}</td>
                      <td>{{ s.level || '—' }}</td>
                      <td>{{ s.school || '—' }}</td>
                      <td>{{ s.parent_name || '—' }}</td>
                      <td>{{ s.parent_contact || '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
        </div>
      </div>

      <div v-if="periodLoading" class="period-loading">
        Loading {{ dashboardPeriod }} data…
      </div>

      <div class="card card-chart">
        <h2>{{ revenueChartTitle }}</h2>
        <p class="card-subtitle">{{ revenueChartSubtitle }}</p>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="revenueChartData.length === 0" class="loading">
          No revenue data yet.
        </div>
        <div v-else class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Recent Lesson Submissions</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="recentLessons.length === 0" class="loading">
          No recent lessons
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Class</th>
              <th>Teacher</th>
              <th>Students Present</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lesson in recentLessons" :key="lesson.id">
              <td>{{ formatDate(lesson.lesson_date) }}</td>
              <td>{{ lesson.className }}</td>
              <td>{{ lesson.teacherName }}</td>
              <td>
                <span v-if="isMissedLesson(lesson)">Missed (no charge)</span>
                <span v-else>{{ getPresentCount(lesson.attendance) }} / {{ getTotalCount(lesson.attendance) }}</span>
              </td>
              <td>
                <router-link :to="`/class/${lesson.class_id}`" class="btn btn-primary btn-sm">
                  View
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="showMissedModal"
      class="modal-overlay missed-lesson-overlay"
      @click.self="closeMissedModal"
    >
      <div
        class="modal-content missed-lesson-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missed-modal-title"
        @click.stop
      >
        <h2 id="missed-modal-title">Mark Lesson as Missed</h2>
        <div v-if="missedModalRow" class="missed-lesson-form">
          <div class="form-group">
            <label>Class</label>
            <input
              type="text"
              class="input-readonly"
              :value="missedModalRow.className"
              readonly
            />
          </div>
          <div class="form-group">
            <label>Date</label>
            <input
              type="text"
              class="input-readonly"
              :value="formatFullDate(missedModalRow.sessionDate)"
              readonly
            />
          </div>
          <div class="form-group">
            <label>Time</label>
            <input
              type="text"
              class="input-readonly"
              :value="missedModalRow.timeLabel"
              readonly
            />
          </div>
          <div class="form-group">
            <label>Remark *</label>
            <textarea
              v-model="missedRemark"
              rows="3"
              placeholder="e.g. Teacher sick, public holiday, class cancelled, student unable to attend"
            ></textarea>
          </div>
        </div>
        <p v-if="missedError" class="error missed-lesson-error">{{ missedError }}</p>
        <div class="missed-modal-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="missedSaving"
            @click="closeMissedModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-missed"
            :disabled="missedSaving"
            @click="saveMissedLesson"
          >
            {{ missedSaving ? 'Saving…' : 'Save Missed Lesson' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import { api } from '../api'
import { db, auth } from '../firebase'
import { collection, getDocs } from 'firebase/firestore'
import { Chart, registerables } from 'chart.js'
import {
  ATTENDANCE_STATUSES,
  isPresentLike,
  isChargeableAttendance,
  normalizeAttendanceStatus
} from '../constants/attendance'
import {
  getClassRatePerHour,
  getAttendanceDuration,
  getClassDefaultDuration
} from '../constants/billing'
import { isStudentActive } from '../constants/studentStatus'
import { formatSignedCurrency } from '../constants/billAdjustments'
import { isMissedLesson, resolveLessonClockTimes } from '../constants/lessons'
import { useAdminData } from '../composables/useAdminData'

Chart.register(...registerables)

// --- Date helpers (Monday-start week) ---
function getStartOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // Sunday = 0, Monday = 1
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getEndOfWeek(date = new Date()) {
  const start = getStartOfWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

function getEndOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseLessonDate(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (value?.toDate) return value.toDate()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function isWithinPeriod(dateValue, range, includeFuture = false) {
  const date = parseLessonDate(dateValue)
  if (!date) return false
  if (date < range.start || date > range.end) return false
  if (!includeFuture && date > range.cutoff) return false
  return true
}

const DAY_NAME_TO_NUMBER = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
}

function getClassDayOfWeek(classObj) {
  const raw =
    classObj?.day_of_week ??
    classObj?.dayOfWeek ??
    classObj?.schedule?.dayOfWeek ??
    classObj?.schedule?.day_of_week ??
    ''
  return String(raw || '').trim().toLowerCase()
}

function isClassActive(classObj) {
  if (!classObj) return false
  if (classObj.active === false) return false
  if (classObj.status === 'inactive') return false
  return true
}

function getScheduledDatesForClassInRange(classObj, range) {
  const targetDay = DAY_NAME_TO_NUMBER[getClassDayOfWeek(classObj)]
  if (targetDay === undefined) return []
  const dates = []
  const d = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate()
  )
  const endNorm = new Date(
    range.end.getFullYear(),
    range.end.getMonth(),
    range.end.getDate()
  )
  while (d <= endNorm) {
    if (d.getDay() === targetDay) {
      dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    }
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function countScheduledOccurrencesInPeriod(classObj, range) {
  return getScheduledDatesForClassInRange(classObj, range).length
}

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDayName(date) {
  const d = date instanceof Date ? date : parseLessonDate(date)
  return d ? d.toLocaleDateString('en-SG', { weekday: 'long' }) : ''
}

function formatFullDate(date) {
  const d = date instanceof Date ? date : parseLessonDate(date)
  return d
    ? d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
}

function formatTimeRange(start, end) {
  if (!start && !end) return '—'
  if (start && end) return `${start} – ${end}`
  return start || end
}

// --- Weekly timetable (Admin Dashboard calendar) ---
// Weekdays: 3:00 PM – 9:30 PM. Weekends: 8:30 AM – 9:30 PM (separate grids).
const TIMETABLE_MAX_MIN = 21 * 60 + 30
const TIMETABLE_MIN_WEEKDAY = 15 * 60
const TIMETABLE_MIN_WEEKEND = 8 * 60 + 30
const TIMETABLE_SLOT_MIN = 30
const TIMETABLE_SLOT_PX = 48
const TIMETABLE_BODY_SLOTS_WEEKDAY =
  (TIMETABLE_MAX_MIN - TIMETABLE_MIN_WEEKDAY) / TIMETABLE_SLOT_MIN
const TIMETABLE_BODY_SLOTS_WEEKEND =
  (TIMETABLE_MAX_MIN - TIMETABLE_MIN_WEEKEND) / TIMETABLE_SLOT_MIN

const WEEK_ORDER_MON_FIRST = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]
const SHORT_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LONG_DAY = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
]

const TIMETABLE_PASTELS = [
  '#e0e7ff',
  '#fce7f3',
  '#d1fae5',
  '#fef3c7',
  '#e0f2fe',
  '#ede9fe',
  '#ffedd5',
  '#ecfccb',
  '#fae8ff'
]

function getTimetableColorKey(classId, dayIndex) {
  const s = String(classId || 'x') + String(dayIndex ?? 0)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % TIMETABLE_PASTELS.length
}

function timeToMinutesFromClock(timeStr) {
  if (timeStr == null || timeStr === '') return null
  const str = String(timeStr).trim()
  if (/am|pm/i.test(str)) {
    const m =
      str.match(
        /(\d{1,2})\s*:\s*(\d{2})\s*([ap]m)/i
      ) || str.match(/(\d{1,2})\s*:\s*(\d{2})([ap]m)/i)
    if (m) {
      let h = Number(m[1])
      const min = Number(m[2])
      const ap = m[3].toLowerCase()
      if (ap === 'pm' && h !== 12) h += 12
      if (ap === 'am' && h === 12) h = 0
      if (Number.isFinite(h) && Number.isFinite(min)) return h * 60 + min
    }
  }
  const p = str.split(/[:.]/)
  if (p.length >= 2) {
    const h = Number(p[0])
    const min = Number(String(p[1]).replace(/\D/g, '')) || 0
    if (Number.isFinite(h) && Number.isFinite(min)) return h * 60 + min
  }
  return null
}

function getClockStart(cls) {
  return cls.start_time || cls.startTime || ''
}
function getClockEnd(cls) {
  return cls.end_time || cls.endTime || ''
}
function getDashboardStudentCount(cls) {
  if (typeof cls.studentCount === 'number' && cls.studentCount >= 0) {
    return cls.studentCount
  }
  if (Array.isArray(cls.studentIds)) return cls.studentIds.length
  if (Array.isArray(cls.students)) {
    return cls.students.filter((o) => o && o.status !== 'inactive').length
  }
  return 0
}

export default {
  name: 'DashboardView',
  components: {
    Navbar
  },
  setup() {
    const router = useRouter()
    // --- Existing dashboard (chart + recent lessons) ---
    const loading = ref(true)
    const recentLessons = ref([])
    const {
      students,
      classes,
      lessons,
      attendance,
      teachers,
      loadAdminData,
      refreshLessons,
      refreshAttendance,
      isLoaded,
      isLoading
    } = useAdminData()

    const selectedTeacherId = ref('all')
    const dashboardPeriod = ref('weekly')

    const getClassTeacherId = (cls) =>
      cls?.teacherId ||
      cls?.mainTeacherId ||
      cls?.teacher_id ||
      cls?.main_teacher_id ||
      ''

    const getClassTeacherName = (cls) => {
      const teacherId = getClassTeacherId(cls)
      if (teacherId) {
        const matchedTeacher = teachers.value.find((t) => t.id === teacherId)
        if (matchedTeacher?.name) return matchedTeacher.name
      }
      return (
        cls?.teacherName ||
        cls?.mainTeacher ||
        cls?.mainTeacherName ||
        cls?.teacher ||
        'Unassigned'
      )
    }

    const isClassForSelectedTeacher = (cls) => {
      if (!selectedTeacherId.value || selectedTeacherId.value === 'all') {
        return true
      }
      const classTeacherId = getClassTeacherId(cls)
      if (classTeacherId && classTeacherId === selectedTeacherId.value) {
        return true
      }
      const selectedTeacher = teachers.value.find(
        (t) => t.id === selectedTeacherId.value
      )
      const selectedTeacherName = selectedTeacher?.name
      if (!selectedTeacherName) return false
      return getClassTeacherName(cls) === selectedTeacherName
    }

    const filteredClasses = computed(() =>
      classes.value.filter((cls) => isClassForSelectedTeacher(cls))
    )

    const filteredClassIds = computed(
      () => new Set(filteredClasses.value.map((cls) => cls.id).filter(Boolean))
    )

    const filteredLessons = computed(() => {
      const ids = filteredClassIds.value
      return lessons.value.filter((lesson) => {
        const classId = lesson.class_id || lesson.classId
        return classId && ids.has(classId)
      })
    })

    const filteredAttendance = computed(() => {
      const lessonIds = new Set(
        filteredLessons.value.map((lesson) => lesson.id).filter(Boolean)
      )
      if (lessonIds.size === 0) return []
      return attendance.value.filter((att) => {
        const lid = att.lesson_id || att.lessonId
        return lid && lessonIds.has(lid)
      })
    })

    const getStudentEnrolledClassIds = (student) => {
      const ids = new Set()
      for (const ec of student.enrolledClasses || []) {
        const c = classes.value.find((cl) => cl.name === ec.className)
        if (c?.id) ids.add(c.id)
      }
      return ids
    }

    const filteredStudents = computed(() => {
      if (selectedTeacherId.value === 'all') {
        return students.value
      }
      const classIds = filteredClassIds.value
      const attendanceStudentIds = new Set(
        filteredAttendance.value
          .map((att) => att.student_id || att.studentId)
          .filter(Boolean)
      )
      return students.value.filter((student) => {
        const enrolled = getStudentEnrolledClassIds(student)
        const enrolledInTeacherClass = [...enrolled].some((id) => classIds.has(id))
        const hasTeacherAttendance = attendanceStudentIds.has(student.id)
        return enrolledInTeacherClass || hasTeacherAttendance
      })
    })

    const dashboardClasses = filteredClasses
    const dashboardLessons = filteredLessons
    const dashboardAttendance = filteredAttendance
    const dashboardStudents = filteredStudents

    const filteredClassesForDashboard = dashboardClasses

    const teacherOptions = computed(() => [
      { label: 'All Teachers', value: 'all' },
      ...teachers.value.map((t) => ({
        label: t.name || t.id,
        value: t.id
      }))
    ])

    const teacherFilterLabel = computed(() => {
      if (selectedTeacherId.value === 'all') return 'All Teachers'
      return (
        teachers.value.find((t) => t.id === selectedTeacherId.value)?.name ||
        'Teacher'
      )
    })

    const dashboardPageTitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'Admin Dashboard'
        : `Teacher Dashboard — ${teacherFilterLabel.value}`
    )

    const periodLabelShort = computed(() =>
      dashboardPeriod.value === 'monthly' ? 'Monthly' : 'Weekly'
    )

    const dashboardPageSubtitle = computed(() => {
      if (selectedTeacherId.value === 'all') {
        return 'Overall performance across all teachers'
      }
      return `${periodLabelShort.value} performance for ${teacherFilterLabel.value}'s classes`
    })

    const classesTodayTitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'Classes Today'
        : `${teacherFilterLabel.value}'s classes today`
    )

    const classesWeekTitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'Classes This Week'
        : `${teacherFilterLabel.value}'s classes this week`
    )

    const weeklyCalendarTitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'All Teachers Weekly Schedule'
        : `${teacherFilterLabel.value}'s Weekly Schedule`
    )

    const monthlyCalendarTitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'All Teachers Monthly Schedule'
        : `${teacherFilterLabel.value}'s Monthly Schedule`
    )

    const currentMonthCalendarLabel = computed(() => {
      const d = new Date()
      return d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
    })

    const activeStudentsStatSubtitle = computed(() =>
      selectedTeacherId.value === 'all'
        ? 'Currently active students'
        : `Active in ${teacherFilterLabel.value}'s classes`
    )

    const allBillAdjustments = ref([])
    const chartCanvas = ref(null)

    // Sums `billAdjustments` docs by calendar month (YYYY-MM). Monthly chart /
    // revenue card add this to lesson revenue. Weekly views use lesson revenue
    // only—adjustments are month-scoped and are not spread across weeks.
    const adjustmentTotalsByMonth = computed(() => {
      const m = {}
      for (const d of allBillAdjustments.value) {
        if (!d.monthKey) continue
        m[d.monthKey] =
          (m[d.monthKey] || 0) + Number(d.totalAdjustmentAmount || 0)
      }
      return m
    })

    const adjustmentTotalsByMonthForTeacher = computed(() => {
      const m = {}
      const allowed =
        selectedTeacherId.value === 'all'
          ? null
          : new Set(dashboardStudents.value.map((s) => s.id).filter(Boolean))
      for (const d of allBillAdjustments.value) {
        if (!d.monthKey) continue
        if (allowed && !allowed.has(d.studentId)) continue
        m[d.monthKey] =
          (m[d.monthKey] || 0) + Number(d.totalAdjustmentAmount || 0)
      }
      return m
    })
    let chartInstance = null

    // --- Period toggle state (dashboardPeriod declared above with teacher filter) ---
    const periodLoading = computed(() => isLoading.value && !isLoaded.value)

    const getPeriodWindowStr = () => {
      const now = new Date()
      const weekStart = getStartOfWeek(now)
      const weekEnd = getEndOfWeek(now)
      const monthStart = getStartOfMonth(now)
      const monthEnd = getEndOfMonth(now)
      const windowStart = weekStart < monthStart ? weekStart : monthStart
      const windowEnd = weekEnd > monthEnd ? weekEnd : monthEnd
      return { firstStr: toDateString(windowStart), lastStr: toDateString(windowEnd) }
    }
    const periodLessons = computed(() => {
      if (!dashboardLessons.value?.length) return []
      const { firstStr, lastStr } = getPeriodWindowStr()
      return dashboardLessons.value.filter((l) => {
        const d = l.lesson_date || l.lessonDate || l.date
        if (!d || typeof d !== 'string' || d.length < 10) return false
        return d >= firstStr && d <= lastStr
      })
    })
    const periodAttendance = computed(() => {
      const pLess = periodLessons.value
      const idSet = new Set(pLess.map((l) => l.id).filter(Boolean))
      if (idSet.size === 0) return []
      return (dashboardAttendance.value || []).filter((a) =>
        idSet.has(a.lesson_id || a.lessonId)
      )
    })

    const currencyFormatter = new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0)

    const formatPercent = (value) => {
      const n = Number(value) || 0
      // One decimal for sub-whole numbers, otherwise a clean integer.
      return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`
    }

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      const date = typeof timestamp === 'string'
        ? new Date(timestamp)
        : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp))
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const getPresentCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.filter((a) => isPresentLike(a?.status)).length
    }

    const getTotalCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.length
    }

    // --- Selected period range ---
    const selectedPeriodRange = computed(() => {
      const now = new Date()
      if (dashboardPeriod.value === 'weekly') {
        return { start: getStartOfWeek(now), end: getEndOfWeek(now), cutoff: now }
      }
      return { start: getStartOfMonth(now), end: getEndOfMonth(now), cutoff: now }
    })

    const periodSubtitle = computed(() => {
      const { start, end } = selectedPeriodRange.value
      const fmt = (d) =>
        d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
      return `${fmt(start)} — ${fmt(end)}`
    })

    // --- Weekly timetable (Classes Today / This Week / split calendar grids) ---
    const TIMETABLE_SLOT_PX_EXPORT = TIMETABLE_SLOT_PX
    const timetableBodyPixelHeightWeekday =
      TIMETABLE_BODY_SLOTS_WEEKDAY * TIMETABLE_SLOT_PX
    const timetableBodyPixelHeightWeekend =
      TIMETABLE_BODY_SLOTS_WEEKEND * TIMETABLE_SLOT_PX

    const buildTimetableTimeSlots = (minStartMin) => {
      const slotCount = (TIMETABLE_MAX_MIN - minStartMin) / TIMETABLE_SLOT_MIN
      const out = []
      for (let i = 0; i < slotCount; i++) {
        const m = minStartMin + i * TIMETABLE_SLOT_MIN
        const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60, 0, 0)
        out.push({
          label: d.toLocaleTimeString('en-SG', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        })
      }
      return out
    }

    const timetableTimeSlotsWeekday = computed(() =>
      buildTimetableTimeSlots(TIMETABLE_MIN_WEEKDAY)
    )
    const timetableTimeSlotsWeekend = computed(() =>
      buildTimetableTimeSlots(TIMETABLE_MIN_WEEKEND)
    )

    const timetableWeekdayColumns = computed(() => {
      const start = getStartOfWeek(new Date())
      return [0, 1, 2, 3, 4].map((i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return {
          id: WEEK_ORDER_MON_FIRST[i],
          dayKey: WEEK_ORDER_MON_FIRST[i],
          dayIndex: i,
          short: SHORT_DAY[i],
          dateLabel: d.toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short'
          })
        }
      })
    })

    const timetableWeekendColumns = computed(() => {
      const start = getStartOfWeek(new Date())
      return [5, 6].map((i) => {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        return {
          id: WEEK_ORDER_MON_FIRST[i],
          dayKey: WEEK_ORDER_MON_FIRST[i],
          dayIndex: i,
          short: SHORT_DAY[i],
          dateLabel: d.toLocaleDateString('en-SG', {
            day: 'numeric',
            month: 'short'
          })
        }
      })
    })

    const sessionRevenueForClassDate = (cls, sessionDate) => {
      const dKey = dateKey(sessionDate)
      const lesson = dashboardLessons.value.find((l) => {
        const cid = l.class_id || l.classId
        if (cid !== cls.id) return false
        const ld = parseLessonDate(
          l.lesson_date || l.lessonDate || l.date
        )
        return ld && dateKey(ld) === dKey
      })
      if (lesson) {
        if (isMissedLesson(lesson)) {
          return { amount: 0, isActual: true }
        }
        let sum = 0
        for (const att of dashboardAttendance.value) {
          if ((att.lesson_id || att.lessonId) !== lesson.id) continue
          if (!isChargeableAttendance(att.status)) continue
          const rate = getClassRatePerHour(cls)
          const dur = getAttendanceDuration(att, lesson, cls)
          sum += rate * dur
        }
        return { amount: sum, isActual: true }
      }
      const n = getDashboardStudentCount(cls)
      const est = getClassRatePerHour(cls) * getClassDefaultDuration(cls) * n
      return { amount: est, isActual: false }
    }

    const weekTimetableSessions = computed(() => {
      const start = getStartOfWeek(new Date())
      const list = []
      for (const cls of filteredClassesForDashboard.value) {
        if (!isClassActive(cls)) continue
        const dn = getClassDayOfWeek(cls)
        const di = WEEK_ORDER_MON_FIRST.indexOf(dn)
        if (di < 0) continue
        const startM = timeToMinutesFromClock(getClockStart(cls))
        const endM = timeToMinutesFromClock(getClockEnd(cls))
        if (startM == null || endM == null) continue
        const sessionDate = new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + di
        )
        const rev = sessionRevenueForClassDate(cls, sessionDate)
        list.push({
          _key: `${cls.id}-${dateKey(sessionDate)}`,
          classId: cls.id,
          className: cls.name || '—',
          class: cls,
          dayIndex: di,
          dayKey: WEEK_ORDER_MON_FIRST[di],
          sessionDate,
          startMin: startM,
          endMin: endM,
          timeLabel: formatTimeRange(getClockStart(cls), getClockEnd(cls)),
          teacherName: getClassTeacherName(cls),
          studentCount: getDashboardStudentCount(cls),
          revenue: rev.amount,
          revenueIsActual: rev.isActual
        })
      }
      return list
        .slice()
        .sort((a, b) => {
          const diff = a.sessionDate - b.sessionDate
          if (diff !== 0) return diff
          return a.startMin - b.startMin
        })
    })

    const todayTimetableClasses = computed(() => {
      const tkey = dateKey(new Date())
      const lessons = dashboardLessons.value
      const hasRecordFor = (classId, sessionDate) => {
        if (!classId || !sessionDate) return false
        const want = dateKey(sessionDate)
        for (const l of lessons) {
          const cid = l.class_id || l.classId
          if (cid !== classId) continue
          const ld = parseLessonDate(l.lesson_date || l.lessonDate || l.date)
          if (ld && dateKey(ld) === want) return true
        }
        return false
      }
      return weekTimetableSessions.value
        .filter((s) => dateKey(s.sessionDate) === tkey)
        .sort((a, b) => a.startMin - b.startMin)
        .map((s) => ({
          ...s,
          hasLessonRecord: hasRecordFor(s.classId, s.sessionDate)
        }))
    })

    const weekTimetableRevenueTotal = computed(() =>
      weekTimetableSessions.value.reduce(
        (sum, s) => sum + (Number(s.revenue) || 0),
        0
      )
    )

    const weekSessionsLeftCount = computed(() => {
      const now = new Date()
      return weekTimetableSessions.value.filter((s) => {
        const end = new Date(
          s.sessionDate.getFullYear(),
          s.sessionDate.getMonth(),
          s.sessionDate.getDate(),
          Math.floor(s.endMin / 60),
          s.endMin % 60,
          0,
          0
        )
        return end.getTime() > now.getTime()
      }).length
    })

    const weekGroupedByDay = computed(() =>
      LONG_DAY.map((dayLabel, dayIndex) => {
        const sessions = weekTimetableSessions.value
          .filter((s) => s.dayIndex === dayIndex)
          .sort((a, b) => a.startMin - b.startMin)
        return { dayLabel, dayIndex, sessions }
      }).filter((b) => b.sessions.length > 0)
    )

    const getSessionsForTimetableDay = (dayIndex) =>
      weekTimetableSessions.value.filter((s) => s.dayIndex === dayIndex)

    /** Calendar only: one card per (day, time range, teacher); multiple classes merged. */
    const getMergedSessionsForTimetableDay = (dayIndex) => {
      const daySessions = weekTimetableSessions.value.filter(
        (s) => s.dayIndex === dayIndex
      )
      const groups = new Map()
      for (const s of daySessions) {
        const tid = String(
          getClassTeacherId(s.class) || getClassTeacherName(s.class) || ''
        )
        const key = `${s.startMin}|${s.endMin}|${tid}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(s)
      }
      const out = []
      for (const group of groups.values()) {
        group.sort((a, b) =>
          String(a.className || '').localeCompare(
            String(b.className || ''),
            undefined,
            { sensitivity: 'base' }
          )
        )
        if (group.length === 1) {
          const s = group[0]
          out.push({ kind: 'single', ...s })
        } else {
          const first = group[0]
          out.push({
            kind: 'merged',
            _key: group.map((g) => g._key).join('+'),
            dayIndex: first.dayIndex,
            startMin: first.startMin,
            endMin: first.endMin,
            timeLabel: first.timeLabel,
            teacherName: first.teacherName,
            sessionDate: first.sessionDate,
            classId: first.classId,
            revenueIsActual: group.every((g) => g.revenueIsActual),
            parts: group
          })
        }
      }
      return out.sort((a, b) => a.startMin - b.startMin)
    }

    const monthlyScheduleList = computed(() => {
      const now = new Date()
      const y = now.getFullYear()
      const mon = now.getMonth()
      const range = {
        start: new Date(y, mon, 1, 0, 0, 0, 0),
        end: new Date(y, mon + 1, 0, 23, 59, 59, 999)
      }
      const list = []
      for (const cls of filteredClassesForDashboard.value) {
        if (!isClassActive(cls)) continue
        if (DAY_NAME_TO_NUMBER[getClassDayOfWeek(cls)] === undefined) {
          continue
        }
        for (const dt of getScheduledDatesForClassInRange(cls, range)) {
          const st = getClockStart(cls)
          const en = getClockEnd(cls)
          const startM = timeToMinutesFromClock(st) ?? 0
          list.push({
            _key: `${cls.id}|${dateKey(dt)}`,
            classId: cls.id,
            class: cls,
            className: cls.name || '—',
            date: dt,
            dateKey: dateKey(dt),
            teacherName: getClassTeacherName(cls),
            timeLabel: formatTimeRange(st, en),
            startMin: startM,
            studentCount: getDashboardStudentCount(cls)
          })
        }
      }
      return list.sort((a, b) => {
        const diff = a.date - b.date
        if (diff !== 0) return diff
        return a.startMin - b.startMin
      })
    })

    const monthlyCalendarGrid = computed(() => {
      const d = new Date()
      const y = d.getFullYear()
      const mon = d.getMonth()
      const byKey = new Map()
      for (const s of monthlyScheduleList.value) {
        if (!byKey.has(s.dateKey)) byKey.set(s.dateKey, [])
        byKey.get(s.dateKey).push(s)
      }
      const first = new Date(y, mon, 1)
      const firstDow = first.getDay()
      const offset = firstDow === 0 ? 6 : firstDow - 1
      const gridStart = new Date(y, mon, 1 - offset)
      const weeks = []
      const cur = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate()
      )
      for (let w = 0; w < 6; w++) {
        const week = []
        for (let i = 0; i < 7; i++) {
          const dk = dateKey(cur)
          const inM = cur.getMonth() === mon && cur.getFullYear() === y
          const sessions = (byKey.get(dk) || []).slice()
          week.push({
            date: new Date(
              cur.getFullYear(),
              cur.getMonth(),
              cur.getDate()
            ),
            inCurrentMonth: inM,
            dayNum: cur.getDate(),
            dateKey: dk,
            sessions
          })
          cur.setDate(cur.getDate() + 1)
        }
        weeks.push(week)
      }
      return { weeks }
    })

    const monthlyPillColor = (classId) =>
      TIMETABLE_PASTELS[getTimetableColorKey(classId, 0)]

    const timetableBlockStyleForRange = (startMin, endMin, classId, dayIndex, rangeMin) => {
      const vStart = Math.max(startMin, rangeMin)
      const vEnd = Math.min(endMin, TIMETABLE_MAX_MIN)
      if (vEnd <= vStart) {
        return { display: 'none' }
      }
      const top = ((vStart - rangeMin) / TIMETABLE_SLOT_MIN) * TIMETABLE_SLOT_PX
      const h = ((vEnd - vStart) / TIMETABLE_SLOT_MIN) * TIMETABLE_SLOT_PX
      return {
        top: `${top}px`,
        minHeight: `${Math.max(h, 32)}px`,
        background: TIMETABLE_PASTELS[getTimetableColorKey(classId, dayIndex)]
      }
    }

    const timetableBlockStyleWeekday = (startMin, endMin, classId, dayIndex) =>
      timetableBlockStyleForRange(
        startMin,
        endMin,
        classId,
        dayIndex,
        TIMETABLE_MIN_WEEKDAY
      )

    const timetableBlockStyleWeekend = (startMin, endMin, classId, dayIndex) =>
      timetableBlockStyleForRange(
        startMin,
        endMin,
        classId,
        dayIndex,
        TIMETABLE_MIN_WEEKEND
      )

    const getTimetableColor = (classId, dayIndex) => {
      const c = TIMETABLE_PASTELS[getTimetableColorKey(classId, dayIndex)]
      return c || '#e0e7ff'
    }

    // --- Shared lookups used by both the summary cards and the breakdown
    //     modals so numbers always agree.
    const classById = computed(() => {
      const m = new Map()
      for (const c of dashboardClasses.value) if (c?.id) m.set(c.id, c)
      return m
    })

    const studentById = computed(() => {
      const m = new Map()
      for (const s of students.value) if (s?.id) m.set(s.id, s)
      return m
    })

    const goToClass = (payload) => {
      const cls = payload?.class
      const id =
        payload?.classId ||
        payload?.class_id ||
        cls?.id ||
        cls?.classId ||
        cls?.class_id
      if (!id) return
      router.push({ name: 'Class', params: { id: String(id) } })
    }

    const onClassCardKeydown = (e, payload) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        goToClass(payload)
      }
    }

    const onTimetableBlockClick = (session) => {
      if (session.kind === 'merged') return
      goToClass(session)
    }

    const onTimetableBlockKeydown = (e, session) => {
      if (session.kind === 'merged') return
      onClassCardKeydown(e, session)
    }

    const attendanceByLessonId = computed(() => {
      const m = new Map()
      for (const att of periodAttendance.value) {
        const lid = att.lesson_id || att.lessonId
        if (!lid) continue
        const list = m.get(lid) || []
        list.push(att)
        m.set(lid, list)
      }
      return m
    })

    // --- Breakdown #1: Classes ---
    // Expected sessions come from enumerating each active class's scheduled
    // day within the selected period. Conducted sessions come from the
    // lesson records loaded for the period (date ≤ today). Sessions are
    // matched on (classId + normalised date) so the modal can show which
    // expected sessions still have no lesson recorded.
    const classesBreakdown = computed(() => {
      const range = selectedPeriodRange.value

      const expectedByKey = new Map()
      const expectedSessions = []
      for (const cls of dashboardClasses.value) {
        if (!isClassActive(cls)) continue
        for (const d of getScheduledDatesForClassInRange(cls, range)) {
          const sess = {
            date: d,
            dateStr: dateKey(d),
            classId: cls.id,
            className: cls.name || '—',
            teacherName: getClassTeacherName(cls) || '—',
            startTime: cls.start_time || cls.startTime || '',
            endTime: cls.end_time || cls.endTime || ''
          }
          expectedSessions.push(sess)
          expectedByKey.set(`${sess.classId}|${sess.dateStr}`, sess)
        }
      }

      const keyNonMissed = new Set()
      const keyMissed = new Set()
      const conducted = []
      const missed = []

      for (const lesson of periodLessons.value) {
        const lessonDate = parseLessonDate(
          lesson.lesson_date || lesson.lessonDate || lesson.date
        )
        if (!lessonDate) continue
        if (!isWithinPeriod(lessonDate, range, false)) continue
        const classId = lesson.class_id || lesson.classId
        const cls = classId ? classById.value.get(classId) : null
        const key = `${classId}|${dateKey(lessonDate)}`
        const { startTime: st, endTime: en } = resolveLessonClockTimes(
          lesson,
          cls
        )
        const row = {
          lesson,
          date: lessonDate,
          dateStr: dateKey(lessonDate),
          classId,
          className: cls?.name || lesson.className || '—',
          teacherName: cls?.teacherName || lesson.teacherName || '—',
          startTime: st,
          endTime: en,
          remark: lesson.remark || lesson.remarks || ''
        }
        if (isMissedLesson(lesson)) {
          missed.push(row)
          if (expectedByKey.has(key)) keyMissed.add(key)
        } else {
          conducted.push(row)
          if (expectedByKey.has(key)) keyNonMissed.add(key)
        }
      }
      conducted.sort((a, b) => a.date - b.date)
      missed.sort((a, b) => a.date - b.date)

      const conductedOnScheduleCount = keyNonMissed.size
      const missedOnScheduleCount = [...keyMissed].filter(
        (k) => !keyNonMissed.has(k)
      ).length

      const notConducted = expectedSessions
        .filter((s) => {
          const k = `${s.classId}|${s.dateStr}`
          if (keyNonMissed.has(k) || keyMissed.has(k)) return false
          return true
        })
        .sort((a, b) => a.date - b.date)

      return {
        conducted,
        missed,
        notConducted,
        total: expectedSessions.length,
        conductedOnScheduleCount,
        missedOnScheduleCount,
        notRecordedCount: notConducted.length
      }
    })

    const conductedClassesCount = computed(
      () => classesBreakdown.value.conductedOnScheduleCount
    )
    const expectedClassesCount = computed(
      () => classesBreakdown.value.total
    )
    const classesPercentage = computed(() => {
      if (!expectedClassesCount.value) return 0
      return (conductedClassesCount.value / expectedClassesCount.value) * 100
    })

    // --- Breakdown #2: Attendance ---
    const attendanceBreakdown = computed(() => {
      const range = selectedPeriodRange.value
      const lessonMap = new Map()
      for (const l of periodLessons.value) if (l?.id) lessonMap.set(l.id, l)

      const records = []
      let present = 0
      let late = 0
      let absentValid = 0
      let absentCharged = 0
      const absentRecords = []
      let missedClassSessionCount = 0

      for (const att of periodAttendance.value) {
        const lesson = lessonMap.get(att.lesson_id || att.lessonId)
        if (!lesson) continue
        const lessonDate = parseLessonDate(
          lesson.lesson_date || lesson.lessonDate || lesson.date
        )
        if (!lessonDate || !isWithinPeriod(lessonDate, range, false)) continue
        const status = normalizeAttendanceStatus(att.status)
        if (isMissedLesson(lesson) || status === ATTENDANCE_STATUSES.MISSED) {
          missedClassSessionCount += 1
          continue
        }
        if (!status) continue

        const classId =
          lesson.class_id || lesson.classId || att.class_id || att.classId
        const cls = classId ? classById.value.get(classId) : null
        const student = studentById.value.get(att.student_id || att.studentId)
        const duration = getAttendanceDuration(att, lesson, cls)
        const rate = cls ? getClassRatePerHour(cls) : 0
        const fee = isChargeableAttendance(status) ? rate * duration : 0
        const { startTime: lessonStart, endTime: lessonEnd } =
          resolveLessonClockTimes(lesson, cls)

        const entry = {
          att,
          lesson,
          lessonDate,
          cls,
          classId,
          className: cls?.name || lesson.className || '—',
          studentName: student?.name || 'Unknown student',
          status,
          duration,
          fee,
          startTime: lessonStart,
          endTime: lessonEnd
        }
        records.push(entry)

        if (status === ATTENDANCE_STATUSES.PRESENT) present += 1
        else if (status === ATTENDANCE_STATUSES.LATE) late += 1
        else if (status === ATTENDANCE_STATUSES.ABSENT_VALID) {
          absentValid += 1
          absentRecords.push(entry)
        } else if (status === ATTENDANCE_STATUSES.ABSENT_CHARGED) {
          absentCharged += 1
          absentRecords.push(entry)
        }
      }

      records.sort((a, b) => a.lessonDate - b.lessonDate)
      absentRecords.sort((a, b) => a.lessonDate - b.lessonDate)

      const total = records.length
      const presentLate = present + late

      return {
        total,
        present,
        late,
        absentValid,
        absentCharged,
        presentLate,
        missedClassSessionCount,
        percentage: total ? (presentLate / total) * 100 : 0,
        records,
        absentRecords
      }
    })

    const attendanceSummary = computed(() => ({
      presentLate: attendanceBreakdown.value.presentLate,
      total: attendanceBreakdown.value.total,
      percentage: attendanceBreakdown.value.percentage
    }))

    // --- Breakdown #3: Revenue ---
    const revenueBreakdown = computed(() => {
      const range = selectedPeriodRange.value
      const rows = []

      for (const lesson of periodLessons.value) {
        const lessonDate = parseLessonDate(
          lesson.lesson_date || lesson.lessonDate || lesson.date
        )
        if (!lessonDate || !isWithinPeriod(lessonDate, range, false)) continue
        if (isMissedLesson(lesson)) continue
        const classId = lesson.class_id || lesson.classId
        const cls = classId ? classById.value.get(classId) : null
        const attList = attendanceByLessonId.value.get(lesson.id) || []

        let studentsCharged = 0
        let revenue = 0
        const chargedDetails = []

        for (const att of attList) {
          const status = normalizeAttendanceStatus(att.status)
          if (status === ATTENDANCE_STATUSES.MISSED) continue
          if (!isChargeableAttendance(status)) continue
          const rate = cls ? getClassRatePerHour(cls) : 0
          const duration = getAttendanceDuration(att, lesson, cls)
          const fee = rate * duration
          studentsCharged += 1
          revenue += fee
          const student = studentById.value.get(att.student_id || att.studentId)
          chargedDetails.push({
            studentName: student?.name || 'Unknown student',
            status,
            duration,
            fee
          })
        }

        const { startTime: revStart, endTime: revEnd } = resolveLessonClockTimes(
          lesson,
          cls
        )
        rows.push({
          lesson,
          lessonDate,
          classId,
          className: cls?.name || lesson.className || '—',
          teacherName: cls?.teacherName || lesson.teacherName || '—',
          startTime: revStart,
          endTime: revEnd,
          studentsCharged,
          revenue,
          chargedDetails
        })
      }

      rows.sort((a, b) => a.lessonDate - b.lessonDate)
      const total = rows.reduce((s, r) => s + r.revenue, 0)
      return { rows, total }
    })

    const revenueLessonOnly = computed(() => revenueBreakdown.value.total)

    const selectedDashboardMonthKey = computed(() => {
      if (dashboardPeriod.value !== 'monthly') return null
      const s = selectedPeriodRange.value.start
      return `${s.getFullYear()}-${pad2(s.getMonth() + 1)}`
    })

    const billAdjustmentsSumForSelectedPeriod = computed(() => {
      if (dashboardPeriod.value !== 'monthly' || !selectedDashboardMonthKey.value) {
        return 0
      }
      const mk = selectedDashboardMonthKey.value
      if (selectedTeacherId.value === 'all') {
        return adjustmentTotalsByMonth.value[mk] || 0
      }
      return adjustmentTotalsByMonthForTeacher.value[mk] || 0
    })

    const revenueForSelectedPeriod = computed(
      () => revenueLessonOnly.value + billAdjustmentsSumForSelectedPeriod.value
    )

    const getClassActiveStudentCount = (cls) => {
      if (!cls) return 0
      const allStudents = students.value
      let studentRefs = []
      if (Array.isArray(cls.studentIds) && cls.studentIds.length) {
        studentRefs = cls.studentIds
      } else if (
        Array.isArray(cls.enrolledStudentIds) &&
        cls.enrolledStudentIds.length
      ) {
        studentRefs = cls.enrolledStudentIds
      } else if (Array.isArray(cls.students) && cls.students.length) {
        studentRefs = cls.students
      } else if (Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.length) {
        studentRefs = cls.enrolledStudents
      }
      if (!studentRefs.length) {
        return Number(cls.studentCount || 0)
      }
      return studentRefs.filter((item) => {
        if (typeof item === 'string') {
          const matchedStudent = allStudents.find((s) => s.id === item)
          return matchedStudent ? isStudentActive(matchedStudent) : true
        }
        const studentId = item.id || item.studentId || item.student_id
        const matchedStudent = allStudents.find((s) => s.id === studentId)
        if (matchedStudent) {
          return isStudentActive(matchedStudent)
        }
        if (item.status) {
          return item.status === 'active'
        }
        return true
      }).length
    }

    const getMaxRevenueForClassSession = (cls) =>
      getClassRatePerHour(cls) *
      getClassDefaultDuration(cls) *
      getClassActiveStudentCount(cls)

    const maxPossibleRevenueForSelectedPeriod = computed(() => {
      const range = selectedPeriodRange.value
      let sum = 0
      for (const cls of dashboardClasses.value) {
        if (!isClassActive(cls)) continue
        const occ = countScheduledOccurrencesInPeriod(cls, range)
        if (occ === 0) continue
        sum += occ * getMaxRevenueForClassSession(cls)
      }
      return sum
    })

    const revenueEarnedPercentage = computed(() => {
      const m = maxPossibleRevenueForSelectedPeriod.value
      if (!m) return 0
      return (revenueForSelectedPeriod.value / m) * 100
    })

    const maximumRevenueBreakdownRows = computed(() => {
      const range = selectedPeriodRange.value
      const rows = []
      for (const cls of dashboardClasses.value) {
        if (!isClassActive(cls)) continue
        const dates = getScheduledDatesForClassInRange(cls, range)
        if (dates.length === 0) continue
        const rate = getClassRatePerHour(cls)
        const dur = getClassDefaultDuration(cls)
        const nStud = getClassActiveStudentCount(cls)
        const perSession = getMaxRevenueForClassSession(cls)
        const teacher = getClassTeacherName(cls) || '—'
        for (const d of dates) {
          rows.push({
            date: d,
            className: cls.name || '—',
            teacherName: teacher,
            studentCount: nStud,
            ratePerHour: rate,
            durationHours: dur,
            maxRevenue: perSession,
            startTime: cls.start_time || cls.startTime || '',
            endTime: cls.end_time || cls.endTime || ''
          })
        }
      }
      return rows.sort((a, b) => a.date - b.date)
    })

    // Flattened rows for the revenue breakdown modal (monthly mode): one line
    // per applied preset line item, for the selected calendar month.
    const revenueModalBillAdjustmentRows = computed(() => {
      if (dashboardPeriod.value !== 'monthly' || !selectedDashboardMonthKey.value) {
        return []
      }
      const mk = selectedDashboardMonthKey.value
      const allowed =
        selectedTeacherId.value === 'all'
          ? null
          : new Set(dashboardStudents.value.map((s) => s.id).filter(Boolean))
      const out = []
      for (const d of allBillAdjustments.value) {
        if (d.monthKey !== mk) continue
        if (allowed && !allowed.has(d.studentId)) continue
        const sname =
          studentById.value.get(d.studentId)?.name || d.studentId || '—'
        for (const it of d.items || []) {
          out.push({
            studentName: sname,
            type: it.label || it.key,
            amount: Number(it.amount) || 0,
            monthKey: mk
          })
        }
      }
      return out.sort((a, b) =>
        a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' })
      )
    })

    const revenueModalAdjustmentsSum = computed(() =>
      revenueModalBillAdjustmentRows.value.reduce(
        (s, r) => s + Number(r.amount || 0),
        0
      )
    )

    // --- Breakdown #4: Active students ---
    // Counts only records whose status is missing/active (or legacy
    // active === true). Dropped / graduated / stopped / inactive are excluded.
    const activeStudentsList = computed(() =>
      dashboardStudents.value
        .filter((s) => isStudentActive(s))
        .slice()
        .sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), undefined, {
            sensitivity: 'base'
          })
        )
    )

    const activeStudentsCount = computed(() => activeStudentsList.value.length)

    // --- Detail modal state ---
    const dashboardDetailModal = ref(null) // 'classes' | 'attendance' | 'revenue' | 'activeStudents' | null
    const openDashboardDetail = (type) => {
      dashboardDetailModal.value = type
    }
    const closeDashboardDetail = () => {
      dashboardDetailModal.value = null
    }

    const showMissedModal = ref(false)
    const missedModalRow = ref(null)
    const missedRemark = ref('')
    const missedError = ref('')
    const missedSaving = ref(false)

    const openMissedModal = (row) => {
      missedModalRow.value = row
      missedRemark.value = ''
      missedError.value = ''
      showMissedModal.value = true
    }
    const closeMissedModal = () => {
      if (missedSaving.value) return
      showMissedModal.value = false
      missedModalRow.value = null
      missedRemark.value = ''
      missedError.value = ''
    }
    const sessionDateToParam = (d) => toDateString(d)

    const periodTitleLabel = computed(() =>
      dashboardPeriod.value === 'monthly' ? 'Monthly' : 'Weekly'
    )

    const detailModalTitle = computed(() => {
      switch (dashboardDetailModal.value) {
        case 'classes':
          return 'Classes Breakdown'
        case 'attendance':
          return 'Attendance Breakdown'
        case 'revenue':
          return 'Revenue Breakdown'
        case 'activeStudents':
          return 'Active Students'
        default:
          return ''
      }
    })

    const detailModalSubtitle = computed(() => {
      if (dashboardDetailModal.value === 'activeStudents') {
        if (selectedTeacherId.value === 'all') {
          return 'All students currently counted as active'
        }
        return `Active students for ${teacherFilterLabel.value}'s classes`
      }
      const teacherSuffix =
        selectedTeacherId.value === 'all'
          ? ''
          : ` — ${teacherFilterLabel.value}`
      return `${periodTitleLabel.value} view — ${periodSubtitle.value}${teacherSuffix}`
    })

    // --- Weekly revenue chart (unchanged) ---
    const pointValueLabelsPlugin = {
      id: 'pointValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart
        const meta = chart.getDatasetMeta(0)
        if (!meta || !Array.isArray(meta.data)) return
        const dataset = chart.data.datasets[0]
        if (!dataset) return
        ctx.save()
        ctx.font = '600 11px Inter, system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#1e293b'
        meta.data.forEach((point, idx) => {
          const raw = Number(dataset.data[idx]) || 0
          const label = `$${raw.toFixed(2)}`
          const x = point.x
          const y = point.y - 10
          ctx.fillText(label, x, y)
        })
        ctx.restore()
      }
    }

    const renderRevenueChart = (entries, periodLabel) => {
      if (!chartCanvas.value) return
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      const labels = entries.map((e) => e.label)
      const values = entries.map((e) => Number(e.revenue) || 0)
      const tooltipTitlePrefix = periodLabel === 'monthly' ? '' : 'Week of '
      chartInstance = new Chart(chartCanvas.value, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Revenue ($)',
            data: values,
            borderColor: 'rgba(79, 70, 229, 1)',
            backgroundColor: 'rgba(79, 70, 229, 0.15)',
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgba(79, 70, 229, 1)',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          }]
        },
        plugins: [pointValueLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2,
          layout: { padding: { top: 24, right: 12, bottom: 0, left: 0 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items?.[0]?.dataIndex ?? 0
                  const label = entries[idx]?.label || ''
                  return `${tooltipTitlePrefix}${label}`
                },
                label: (ctx) => `Revenue: $${Number(ctx.raw || 0).toFixed(2)}`
              }
            }
          },
          scales: {
            x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 } },
            y: { beginAtZero: true, ticks: { callback: (value) => '$' + value } }
          }
        }
      })
    }

    const loadDashboardExtras = async () => {
      try {
        const data = await api.get('/api/dashboard')
        recentLessons.value = data.recentLessons ?? []
      } catch (err) {
        console.error('Error loading dashboard extras:', err)
      } finally {
        await nextTick()
        renderCurrentChart()
      }
    }

    const saveMissedLesson = async () => {
      const row = missedModalRow.value
      const cls = row?.class
      if (!cls?.id) {
        closeMissedModal()
        return
      }
      const t = missedRemark.value.trim()
      if (!t) {
        missedError.value = 'Please enter a reason for the missed lesson.'
        return
      }
      missedError.value = ''
      missedSaving.value = true
      try {
        await api.post('/api/lessons/missed', {
          classId: row.classId,
          lessonDate: toDateString(row.sessionDate),
          startTime: cls.start_time || cls.startTime || '',
          endTime: cls.end_time || cls.endTime || '',
          teacherId:
            cls.main_teacher_id || cls.mainTeacherId || getClassTeacherId(cls) || '',
          remark: t
        })
        // Close immediately (closeMissedModal refuses while missedSaving is true)
        missedSaving.value = false
        closeMissedModal()
        await Promise.all([refreshLessons(), refreshAttendance()])
        await loadDashboardExtras()
      } catch (e) {
        missedError.value = e.message || 'Failed to save missed lesson.'
      } finally {
        missedSaving.value = false
      }
    }

    const loadBillAdjustmentsForDashboard = async () => {
      try {
        await auth.authStateReady?.()
        if (!auth.currentUser) {
          allBillAdjustments.value = []
          return
        }
        const snap = await getDocs(collection(db, 'billAdjustments'))
        allBillAdjustments.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      } catch (err) {
        console.error('Error loading bill adjustments:', err)
        allBillAdjustments.value = []
      }
    }

    // --- Shared revenue extraction ---
    // Produces one entry per chargeable attendance record, using the same
    // fallback logic as the Revenue summary card (and the backend's Revenue
    // Thus Far calculation). This is the single source of truth for the chart.
    const getRevenueEntries = () => {
      const entries = []
      const now = new Date()

      // Build fast lookups by id AND by legacy aliases to guard against
      // schema inconsistencies.
      const lessonById = new Map()
      for (const l of dashboardLessons.value) {
        if (l.id) lessonById.set(l.id, l)
        if (l.lesson_id && !lessonById.has(l.lesson_id)) lessonById.set(l.lesson_id, l)
        if (l.lessonId && !lessonById.has(l.lessonId)) lessonById.set(l.lessonId, l)
      }
      const classByIdLocal = new Map()
      for (const c of dashboardClasses.value) {
        if (c.id) classByIdLocal.set(c.id, c)
        if (c.class_id && !classByIdLocal.has(c.class_id)) classByIdLocal.set(c.class_id, c)
        if (c.classId && !classByIdLocal.has(c.classId)) classByIdLocal.set(c.classId, c)
      }

      for (const att of dashboardAttendance.value) {
        const lessonId = att.lesson_id || att.lessonId
        const lesson = lessonId ? lessonById.get(lessonId) : null
        if (!lesson) continue
        if (isMissedLesson(lesson)) continue

        const lessonDate = parseLessonDate(
          lesson.lesson_date ||
            lesson.lessonDate ||
            lesson.date ||
            att.lesson_date ||
            att.lessonDate
        )
        if (!lessonDate) continue
        if (lessonDate > now) continue

        const status = normalizeAttendanceStatus(att.status)
        if (status === ATTENDANCE_STATUSES.MISSED) continue
        if (!isChargeableAttendance(status)) continue

        const classId =
          lesson.class_id ||
          lesson.classId ||
          att.class_id ||
          att.classId
        const classObj = classId ? classByIdLocal.get(classId) : null
        if (!classObj) continue

        const ratePerHour = getClassRatePerHour(classObj)
        const durationHours = getAttendanceDuration(att, lesson, classObj)
        const revenue = ratePerHour * durationHours
        if (!Number.isFinite(revenue) || revenue <= 0) continue

        entries.push({ lessonDate, revenue })
      }
      return entries
    }

    const getMondayOfWeek = (date) => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dow = d.getDay()
      const offset = dow === 0 ? -6 : 1 - dow
      d.setDate(d.getDate() + offset)
      d.setHours(0, 0, 0, 0)
      return d
    }

    const weeklyRevenueData = computed(() => {
      const grouped = {}
      for (const entry of getRevenueEntries()) {
        const monday = getMondayOfWeek(entry.lessonDate)
        const key = toDateString(monday)
        if (!grouped[key]) {
          grouped[key] = {
            key,
            label: monday.toLocaleDateString('en-SG', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }),
            revenue: 0
          }
        }
        grouped[key].revenue += entry.revenue
      }
      return Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key))
    })

    const monthlyRevenueData = computed(() => {
      const grouped = {}
      for (const entry of getRevenueEntries()) {
        const d = entry.lessonDate
        const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
        if (!grouped[key]) {
          const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
          grouped[key] = {
            key,
            label: firstOfMonth.toLocaleDateString('en-SG', {
              month: 'short',
              year: 'numeric'
            }),
            revenue: 0
          }
        }
        grouped[key].revenue += entry.revenue
      }
      // Always include the current month so the chart has a trailing point
      // for the ongoing period, even if there is no chargeable revenue yet.
      const now = new Date()
      const currentKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
      if (!grouped[currentKey]) {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        grouped[currentKey] = {
          key: currentKey,
          label: firstOfMonth.toLocaleDateString('en-SG', {
            month: 'short',
            year: 'numeric'
          }),
          revenue: 0
        }
      }
      const adj =
        selectedTeacherId.value === 'all'
          ? adjustmentTotalsByMonth.value
          : adjustmentTotalsByMonthForTeacher.value
      return Object.values(grouped)
        .map((g) => ({
          ...g,
          revenue: g.revenue + (adj[g.key] || 0)
        }))
        .sort((a, b) => a.key.localeCompare(b.key))
    })

    // --- Chart data / title switcher ---
    const revenueChartData = computed(() =>
      dashboardPeriod.value === 'monthly' ? monthlyRevenueData.value : weeklyRevenueData.value
    )

    const revenueChartTitle = computed(() => {
      const base =
        dashboardPeriod.value === 'monthly' ? 'Monthly Revenue' : 'Weekly Revenue'
      if (selectedTeacherId.value === 'all') return base
      return `${base} — ${teacherFilterLabel.value}`
    })

    const revenueChartSubtitle = computed(() =>
      dashboardPeriod.value === 'monthly'
        ? 'Grouped by month'
        : 'Grouped by Monday of each week'
    )

    const renderCurrentChart = () => {
      if (!chartCanvas.value) {
        if (chartInstance) {
          chartInstance.destroy()
          chartInstance = null
        }
        return
      }
      const entries = revenueChartData.value
      if (entries.length === 0) {
        if (chartInstance) {
          chartInstance.destroy()
          chartInstance = null
        }
        return
      }
      renderRevenueChart(entries, dashboardPeriod.value)
    }

    watch(
      [dashboardPeriod, revenueChartData, allBillAdjustments, selectedTeacherId],
      async () => {
        await nextTick()
        renderCurrentChart()
      }
    )

    onMounted(async () => {
      await loadAdminData()
      await Promise.all([loadBillAdjustmentsForDashboard(), loadDashboardExtras()])
      loading.value = false
      await nextTick()
      renderCurrentChart()
    })

    onBeforeUnmount(() => {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    })

    return {
      loading,
      periodLoading,
      selectedTeacherId,
      teacherOptions,
      dashboardPageTitle,
      dashboardPageSubtitle,
      classesTodayTitle,
      classesWeekTitle,
      weeklyCalendarTitle,
      monthlyCalendarTitle,
      currentMonthCalendarLabel,
      monthlyCalendarGrid,
      monthlyPillColor,
      filteredClassesForDashboard,
      activeStudentsStatSubtitle,
      dashboardPeriod,
      periodSubtitle,
      expectedClassesCount,
      conductedClassesCount,
      classesPercentage,
      attendanceSummary,
      revenueForSelectedPeriod,
      maxPossibleRevenueForSelectedPeriod,
      revenueEarnedPercentage,
      maximumRevenueBreakdownRows,
      revenueLessonOnly,
      billAdjustmentsSumForSelectedPeriod,
      revenueModalBillAdjustmentRows,
      revenueModalAdjustmentsSum,
      formatSignedCurrency,
      activeStudentsCount,
      recentLessons,
      weeklyRevenueData,
      monthlyRevenueData,
      revenueChartData,
      revenueChartTitle,
      revenueChartSubtitle,
      chartCanvas,
      classesBreakdown,
      attendanceBreakdown,
      revenueBreakdown,
      activeStudentsList,
      dashboardDetailModal,
      openDashboardDetail,
      closeDashboardDetail,
      detailModalTitle,
      detailModalSubtitle,
      formatFullDate,
      formatDayName,
      formatTimeRange,
      formatDate,
      formatCurrency,
      formatPercent,
      isMissedLesson,
      getPresentCount,
      getTotalCount,
      TIMETABLE_BODY_SLOTS_WEEKDAY,
      TIMETABLE_BODY_SLOTS_WEEKEND,
      TIMETABLE_SLOT_PX: TIMETABLE_SLOT_PX_EXPORT,
      timetableTimeSlotsWeekday,
      timetableTimeSlotsWeekend,
      timetableWeekdayColumns,
      timetableWeekendColumns,
      todayTimetableClasses,
      weekTimetableSessions,
      weekTimetableRevenueTotal,
      weekSessionsLeftCount,
      weekGroupedByDay,
      getSessionsForTimetableDay,
      getMergedSessionsForTimetableDay,
      timetableBlockStyleWeekday,
      timetableBlockStyleWeekend,
      getTimetableColor,
      timetableBodyPixelHeightWeekday,
      timetableBodyPixelHeightWeekend,
      goToClass,
      onClassCardKeydown,
      onTimetableBlockClick,
      onTimetableBlockKeydown,
      showMissedModal,
      missedModalRow,
      missedRemark,
      missedError,
      missedSaving,
      openMissedModal,
      closeMissedModal,
      saveMissedLesson,
      sessionDateToParam
    }
  }
}
</script>

<style scoped>
.page-header h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.025em; }
.page-header p { margin-top: 4px; font-size: 0.9375rem; color: var(--color-text-muted); }
.page-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-header-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.teacher-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.teacher-filter-label {
  font-weight: 600;
  color: var(--color-text, #1e293b);
  white-space: nowrap;
}

.teacher-filter-select {
  min-width: 180px;
  max-width: min(280px, 100vw);
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--color-surface, #fff);
  color: var(--color-text, #1e293b);
}
.period-subtitle {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.period-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 999px;
  padding: 4px;
  background: var(--color-surface, #fff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.period-toggle-btn {
  appearance: none;
  border: none;
  background: transparent;
  padding: 6px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted, #475569);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.period-toggle-btn:hover { color: var(--color-text, #0f172a); }
.period-toggle-btn.active {
  background: #4f46e5;
  color: #fff;
  box-shadow: 0 1px 2px rgba(79, 70, 229, 0.35);
}

.card-stat { position: relative; padding-left: 20px; border-left: 4px solid var(--color-border); }
.card-stat-classes { border-left-color: #4f46e5; }
.card-stat-attendance { border-left-color: #0ea5e9; }
.card-stat-revenue { border-left-color: #8b5cf6; }
.card-stat-students { border-left-color: #059669; }
.card-stat .stat-number {
  font-size: 1.75rem; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-top: 4px;
}
.card-stat .stat-number--revenue-compare { font-size: 1.3rem; line-height: 1.25; word-break: break-word; }
.card-stat .stat-subtitle { margin-top: 6px; font-size: 0.8125rem; color: var(--color-text-muted); }
.card-stat .stat-hint { margin-top: 6px; font-size: 0.7rem; line-height: 1.3; color: var(--color-text-muted, #64748b); }
.card-stat .stat-percent { font-weight: 700; color: var(--color-text, #0f172a); margin-right: 4px; }
.revenue-modal-note { font-size: 0.8rem; color: var(--color-text-muted, #64748b); margin: 0 0 12px; line-height: 1.4; }
.revenue-section-hint { font-size: 0.78rem; color: var(--color-text-muted, #64748b); margin: 0 0 10px; }

.period-loading {
  margin: 8px 0 16px;
  padding: 10px 14px;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.card-chart .chart-container { position: relative; max-width: 100%; min-height: 300px; margin-top: 8px; }
.card-chart .card-subtitle { margin: 4px 0 12px; font-size: 0.8125rem; color: var(--color-text-muted); }
.btn-sm { padding: 6px 12px; font-size: 0.8125rem; }

/* Clickable summary cards */
.card-stat-clickable {
  cursor: pointer;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease,
    border-color 140ms ease;
}
.card-stat-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}
.card-stat-classes.card-stat-clickable:hover { border-color: #4f46e5; }
.card-stat-attendance.card-stat-clickable:hover { border-color: #0ea5e9; }
.card-stat-revenue.card-stat-clickable:hover { border-color: #8b5cf6; }
.card-stat-students.card-stat-clickable:hover { border-color: #059669; }
.card-stat-clickable:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}
.stat-click-hint {
  margin-top: 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted, #64748b);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stat-click-hint::before {
  content: 'ⓘ';
  font-size: 0.8125rem;
}

/* Detail breakdown modal */
.dashboard-detail-modal {
  max-width: 1000px;
  width: min(1000px, 96vw);
  max-height: 90vh;
  overflow-y: auto;
}
.dashboard-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.dashboard-detail-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}
.dashboard-detail-subtitle {
  margin-top: 4px;
  font-size: 0.875rem;
  color: var(--color-text-muted, #64748b);
}
.dashboard-detail-close {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted, #64748b);
  padding: 4px 8px;
  border-radius: 6px;
}
.dashboard-detail-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.dashboard-detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  margin-bottom: 16px;
}
.dashboard-detail-stat {
  flex: 1 1 140px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}
.dashboard-detail-stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  font-weight: 500;
}
.dashboard-detail-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  letter-spacing: -0.01em;
}
.dashboard-detail-stat-accent {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.dashboard-detail-stat-accent .dashboard-detail-stat-value { color: #4338ca; }
.dashboard-detail-section {
  margin-top: 20px;
}
.dashboard-detail-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--color-text, #0f172a);
}
.dashboard-detail-empty {
  padding: 14px;
  background: #f8fafc;
  border: 1px dashed var(--color-border, #e2e8f0);
  border-radius: 8px;
  color: var(--color-text-muted, #64748b);
  font-size: 0.875rem;
}
.detail-table-scroll {
  overflow-x: auto;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}
.detail-table {
  margin: 0;
  min-width: 640px;
}
.detail-table .num { text-align: right; white-space: nowrap; }
.detail-total-row td {
  font-weight: 700;
  background: #f8fafc;
  border-top: 2px solid var(--color-border, #e2e8f0);
}
.detail-subrow td {
  background: #f8fafc;
  padding: 6px 12px;
}
.charged-detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.charged-detail-list li {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto auto;
  gap: 12px;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--color-text, #0f172a);
}
.charged-detail-name { font-weight: 600; }
.charged-detail-status { color: var(--color-text-muted, #64748b); }
.charged-detail-duration { color: var(--color-text-muted, #64748b); }
.charged-detail-fee { font-weight: 600; text-align: right; }

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.pill-success { background: #dcfce7; color: #166534; }
.pill-warning { background: #fef3c7; color: #92400e; }

.bill-adj-revenue-totals {
  margin-top: 8px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
}
.bill-rev-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 400px;
}
.bill-rev-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 0.9375rem;
  color: var(--color-text, #0f172a);
}
.bill-rev-line-final {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border, #e2e8f0);
  font-size: 1.0625rem;
}
.bill-rev-line-final strong {
  color: var(--color-primary, #4f46e5);
}

/* Admin weekly timetable */
.dashboard-timetable-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}
.dt-card { padding: 20px 22px; }
.dt-section-title {
  margin: 0 0 6px;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  letter-spacing: -0.02em;
}
.dt-calendar-sub {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
}
.monthly-calendar-card { min-width: 0; }
.monthly-cal { overflow: auto; -webkit-overflow-scrolling: touch; }
.monthly-cal-dow {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  margin-bottom: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  text-align: center;
}
.monthly-cal-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  min-height: 100px;
}
.monthly-cal-cell {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 4px 6px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.monthly-cal-cell--muted {
  background: #f8fafc;
  border-style: dashed;
  opacity: 0.9;
}
.monthly-cal-daynum {
  font-size: 0.7rem;
  font-weight: 700;
  color: #0f172a;
  flex-shrink: 0;
  line-height: 1.2;
}
.monthly-cal-daynum--muted { color: #94a3b8; font-weight: 600; }
.monthly-cal-pills {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  flex: 1;
  max-height: 200px;
  overflow-y: auto;
}
.monthly-pill {
  text-align: left;
  width: 100%;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 5px;
  padding: 4px 5px;
  font-size: 0.65rem;
  line-height: 1.2;
  cursor: pointer;
  color: #0f172a;
  box-shadow: 0 1px 1px rgba(15, 23, 42, 0.06);
}
.monthly-pill:hover { filter: brightness(0.98); }
.monthly-pill:focus {
  outline: 2px solid #4f46e5;
  outline-offset: 1px;
}
.monthly-pill-name { display: block; font-weight: 700; }
.monthly-pill-time, .monthly-pill-count { display: block; color: #334155; }
.timetable-split {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.timetable-section {
  min-width: 0;
}
.timetable-section-title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  letter-spacing: -0.02em;
}
.timetable-section-hint {
  margin: 0 0 10px;
  font-size: 0.78rem;
  color: var(--color-text-muted, #64748b);
}
.dt-loading { font-size: 0.9rem; color: var(--color-text-muted, #64748b); }
.dt-empty {
  padding: 16px;
  color: var(--color-text-muted, #64748b);
  background: #f8fafc;
  border-radius: 10px;
  font-size: 0.9rem;
}
.dt-today-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dt-today-card {
  border: 1px solid var(--color-border, #e2e8f0);
  border-left-width: 4px;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.dt-today-title { font-weight: 700; font-size: 0.95rem; color: #0f172a; }
.dt-today-meta { font-size: 0.85rem; color: #64748b; margin-top: 2px; }
.dt-today-teacher { color: #334155; margin-top: 2px; }
.dt-today-time { font-size: 0.9rem; font-weight: 600; margin-top: 6px; color: #4f46e5; }
.dt-today-count { font-size: 0.8rem; font-weight: 600; color: #334155; margin-top: 6px; }
.dt-today-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #475569;
  flex-wrap: wrap;
  gap: 6px;
}
.dt-today-rev { font-weight: 600; color: #0f172a; }
.dt-today-logged-hint {
  margin-top: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #16a34a;
}
.dt-today-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.dt-today-actions .btn { text-decoration: none; text-align: center; }
.btn-missed {
  background: #fff7ed;
  border: 1px solid #ea580c;
  color: #9a3412;
  font-weight: 600;
}
.btn-missed:hover:not(:disabled) {
  background: #ffedd5;
  color: #7c2d12;
}
.pill-missed {
  background: #ffedd5;
  color: #9a3412;
  font-weight: 600;
}
.missed-lesson-overlay { z-index: 1200; }
.missed-lesson-modal {
  max-width: 420px;
  width: 100%;
  padding: 1.25rem 1.5rem;
}
.missed-lesson-modal h2 { margin: 0 0 1rem; font-size: 1.125rem; }
.missed-lesson-form .form-group { margin-bottom: 0.75rem; }
.missed-lesson-form label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px; color: #334155; }
.missed-lesson-form textarea {
  width: 100%;
  min-height: 88px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.9rem;
}
.missed-lesson-error { margin: 0.5rem 0 0; font-size: 0.875rem; }
.missed-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem; }
.input-readonly {
  width: 100%;
  padding: 8px 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  font-size: 0.9rem;
}
.dt-week-kpis {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.dt-kpi {
  flex: 1 1 160px;
  background: #f8fafc;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  padding: 10px 12px;
}
.dt-kpi-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 600; }
.dt-kpi-value { display: block; font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-top: 4px; }
.dt-week-grouped { display: flex; flex-direction: column; gap: 12px; }
.dt-day-block {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
}
.dt-day-name {
  margin: 0 0 8px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}
.dt-day-sessions {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #475569;
  font-size: 0.88rem;
}
.dt-week-session {
  padding: 8px 10px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background: #f8fafc;
}
.dt-week-session-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.dt-week-session-name { font-weight: 600; color: #0f172a; }
.dt-week-session-time { font-size: 0.8rem; color: #4f46e5; font-weight: 600; }
.dt-week-session-count { font-size: 0.75rem; font-weight: 600; color: #334155; margin-top: 4px; }

.timetable-scroll {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  max-height: min(75vh, 1400px);
}
.timetable-outer { min-width: 720px; }
.timetable-top {
  display: flex;
  align-items: flex-end;
  gap: 0;
  margin-bottom: 4px;
}
.timetable-corner {
  width: 64px;
  flex-shrink: 0;
}
.tt-day-head {
  flex: 1 1 0;
  min-width: 96px;
  text-align: center;
  padding: 4px 4px 8px;
  border-bottom: 1px solid #e2e8f0;
}
.tt-day-short { display: block; font-size: 0.75rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; }
.tt-day-date { display: block; font-size: 0.8rem; color: #64748b; margin-top: 2px; }
.timetable-bottom {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.tt-time-rail {
  width: 64px;
  flex-shrink: 0;
  border-right: 1px solid #e2e8f0;
  height: var(--timetable-body-px, 624px);
}
.tt-time-cell {
  height: var(--timetable-slot-px, 48px);
  font-size: 0.7rem;
  color: #94a3b8;
  padding-right: 6px;
  text-align: right;
  line-height: 1.1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  border-top: 1px solid #f1f5f9;
  box-sizing: border-box;
}
.tt-time-cell:first-child { border-top: 0; }
.tt-day-col {
  position: relative;
  flex: 1 1 0;
  min-width: 96px;
  height: var(--timetable-body-px, 624px);
  border-right: 1px solid #e2e8f0;
  box-sizing: border-box;
}
.tt-day-col:last-child { border-right: 0; }
.tt-grid-bg { position: absolute; inset: 0; z-index: 0; }
.tt-grid-line {
  height: var(--timetable-slot-px, 48px);
  border-top: 1px solid #f1f5f9;
  box-sizing: border-box;
}
.tt-block {
  position: absolute;
  z-index: 1;
  left: 3px;
  right: 3px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 0.7rem;
  line-height: 1.2;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
  border: 1px solid rgba(15, 23, 42, 0.12);
  box-sizing: border-box;
}
.tt-block--est { font-style: italic; opacity: 0.95; }
.tt-block--merged { cursor: default; overflow: visible; z-index: 2; }
.tt-block-title { font-weight: 700; color: #0f172a; }
.tt-block-teacher, .tt-block-time { color: #334155; margin-top: 2px; }
.tt-block-foot { font-size: 0.65rem; color: #64748b; }
.tt-block > .tt-block-foot { margin-top: 2px; }
.tt-block-merged-list { margin-top: 2px; display: flex; flex-direction: column; gap: 4px; }
.tt-block-merged-row { min-width: 0; }
.tt-block-class-link {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
  text-decoration: none;
}
.tt-block-class-link .tt-block-foot { font-size: 0.62rem; color: #64748b; font-weight: 500; }
.tt-block-class-link:hover { text-decoration: underline; }
.tt-block-class-link:focus-visible { outline: 2px solid #4f46e5; outline-offset: 1px; border-radius: 2px; }
.calendar-class-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.calendar-class-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
}
.tt-block--merged.calendar-class-card:hover { transform: none; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1); }
.calendar-class-card:focus {
  outline: none;
}
.calendar-class-card:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}
.tt-block.calendar-class-card:focus-visible { z-index: 2; }
.tt-block--merged .tt-block-foot { display: inline; margin-top: 0; }

@media (max-width: 640px) {
  .page-header-row { align-items: stretch; }
  .period-toggle { width: 100%; justify-content: center; }
  .dashboard-detail-modal { max-height: 94vh; }
  .dashboard-detail-header h2 { font-size: 1.125rem; }
  .dashboard-detail-stat { flex: 1 1 calc(50% - 6px); }
  .charged-detail-list li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .charged-detail-fee { text-align: left; }
}
</style>
