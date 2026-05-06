<template>
  <div>
    <Navbar />
    <div class="container past-data-container">
      <header class="page-header">
        <h1>View Past Data</h1>
        <p>Historical lesson records and monthly student fee tracking, from January {{ floorYear }} onwards.</p>
      </header>

      <!-- ============== Section 1: Past Classes ============== -->
      <section class="card past-data-section">
        <div class="past-data-section-header">
          <div>
            <h2 class="past-data-section-title">Past Classes</h2>
            <p class="past-data-section-sub">
              Actual lesson records grouped by month. Revenue uses the same
              chargeable-attendance × duration × hourly rate formula as the
              "Fees This Month" column.
            </p>
          </div>
          <label class="teacher-filter">
            <span class="teacher-filter-label">Teacher</span>
            <select
              v-model="selectedTeacherId"
              class="teacher-filter-select"
              aria-label="Filter past classes by teacher"
            >
              <option value="">All Teachers</option>
              <option v-for="t in teacherOptions" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="loading" class="past-data-state">Loading past lesson records…</div>
        <div v-else-if="error" class="past-data-state past-data-error">{{ error }}</div>
        <div
          v-else-if="filteredLessonMonthGroups.length === 0"
          class="past-data-state past-data-empty"
        >
          <p v-if="selectedTeacherId">
            No past lessons for this teacher in the selected period.
          </p>
          <p v-else>
            No past lesson records yet. Once classes start being submitted,
            they'll appear here grouped by month.
          </p>
        </div>
        <div v-else class="past-data-month-list">
          <article
            v-for="group in filteredLessonMonthGroups"
            :key="group.monthKey"
            class="past-month-card"
          >
            <header class="past-month-header">
              <div>
                <h3>{{ group.monthLabel }}</h3>
                <p class="past-month-meta">
                  {{ group.lessonCount }}
                  {{ group.lessonCount === 1 ? 'lesson' : 'lessons' }}
                </p>
              </div>
              <span class="past-month-total past-month-total--revenue">
                {{ formatCurrency(group.totalRevenue) }}
              </span>
            </header>
            <ul class="past-lesson-list">
              <li
                v-for="row in group.rows"
                :key="row.lessonId"
                class="past-lesson-row past-lesson-row--interactive"
                :class="{ 'past-lesson-row--missed': row.isMissed }"
                role="button"
                tabindex="0"
                :aria-label="'View details for ' + row.className + ' on ' + formatLessonDateShort(row.lessonDate)"
                @click="openLessonDetail(row)"
                @keydown.enter.prevent="openLessonDetail(row)"
                @keydown.space.prevent="openLessonDetail(row)"
              >
                <div class="past-lesson-primary">
                  <div class="past-lesson-date">
                    <span class="past-lesson-date-day">
                      {{ formatLessonDateShort(row.lessonDate) }}
                    </span>
                    <span class="past-lesson-date-time">{{ row.timeLabel || '—' }}</span>
                  </div>
                  <div class="past-lesson-class">
                    <span class="past-lesson-classname">{{ row.className }}</span>
                    <span
                      v-if="row.isMissed"
                      class="past-lesson-tag past-lesson-tag--missed"
                    >Missed</span>
                  </div>
                </div>
                <div class="past-lesson-secondary">
                  <span class="past-lesson-teacher" :title="row.teacherName">
                    {{ row.teacherName }}
                  </span>
                  <span class="past-lesson-counts">
                    <span title="Students attended (Present + Late)">
                      {{ row.attendedCount }} attended
                    </span>
                    <span class="past-lesson-counts-sep">·</span>
                    <span title="Students charged (Present + Late + Absent (Charged))">
                      {{ row.chargedCount }} charged
                    </span>
                  </span>
                </div>
                <div class="past-lesson-revenue">
                  {{ formatCurrency(row.revenue) }}
                </div>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <!-- ============== Section 2: Student Monthly Fees ============== -->
      <section class="card past-data-section">
        <div class="past-data-section-header">
          <div>
            <h2 class="past-data-section-title">Student Monthly Fees</h2>
            <p class="past-data-section-sub">
              One row per student, one column per month from January {{ floorYear }}
              onwards. Each cell shows the calculated monthly fee (lessons +
              bill adjustments). Tap the tick / cross to mark that
              student-month paid or unpaid — saved instantly to Firestore.
            </p>
          </div>
        </div>

        <div v-if="loading" class="past-data-state">Loading student fees…</div>
        <div
          v-else-if="feeError"
          class="past-data-state past-data-error"
        >{{ feeError }}</div>
        <div
          v-else-if="studentRows.length === 0"
          class="past-data-state past-data-empty"
        >
          No student fee records yet for this period.
        </div>
        <div v-else class="fees-table-wrapper" role="region" aria-label="Student monthly fees">
          <table class="fees-table">
            <thead>
              <tr>
                <th scope="col" class="fees-th-student">Student</th>
                <th
                  v-for="m in monthColumns"
                  :key="m.monthKey"
                  scope="col"
                  class="fees-th-month"
                >
                  {{ m.monthLabel }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in studentRows" :key="row.studentId">
                <th scope="row" class="fees-td-student">
                  {{ row.studentName }}
                </th>
                <td
                  v-for="m in monthColumns"
                  :key="m.monthKey"
                  class="fees-td-month"
                  :class="{
                    'fees-td-month--paid': row.cells[m.monthKey] && isPaid(row.cells[m.monthKey].paymentRow),
                    'fees-td-month--unpaid': row.cells[m.monthKey] && !isPaid(row.cells[m.monthKey].paymentRow)
                  }"
                >
                  <div v-if="row.cells[m.monthKey]" class="fees-cell">
                    <span class="fees-cell-amount">
                      {{ formatCurrency(row.cells[m.monthKey].finalTotal) }}
                    </span>
                    <button
                      type="button"
                      class="fees-cell-toggle"
                      :class="{
                        'fees-cell-toggle--paid': isPaid(row.cells[m.monthKey].paymentRow),
                        'fees-cell-toggle--unpaid': !isPaid(row.cells[m.monthKey].paymentRow)
                      }"
                      :disabled="isToggling(row.cells[m.monthKey].paymentRow)"
                      :aria-label="
                        (isPaid(row.cells[m.monthKey].paymentRow) ? 'Mark unpaid: ' : 'Mark paid: ') +
                        row.studentName + ' — ' + m.monthLabel
                      "
                      :title="
                        isPaid(row.cells[m.monthKey].paymentRow)
                          ? 'Paid — click to mark unpaid'
                          : 'Unpaid — click to mark paid'
                      "
                      @click="onTogglePaid(row.cells[m.monthKey].paymentRow)"
                    >
                      {{ isPaid(row.cells[m.monthKey].paymentRow) ? '✅' : '❌' }}
                    </button>
                  </div>
                  <span
                    v-else
                    class="fees-cell-empty"
                    aria-label="No lessons or bill items in this month"
                  >—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div
        v-if="lessonModalOpen"
        class="modal-overlay past-lesson-modal-overlay"
        role="presentation"
        @click.self="closeLessonDetail"
      >
        <div
          class="modal-content past-lesson-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="past-lesson-modal-title"
          @click.stop
        >
          <div class="past-lesson-modal-header">
            <h2 id="past-lesson-modal-title" class="past-lesson-modal-title">
              Edit Lesson Details
            </h2>
            <button
              type="button"
              class="btn btn-secondary past-lesson-modal-close"
              aria-label="Close"
              :disabled="editLessonSaving"
              @click="closeLessonDetail"
            >
              Close
            </button>
          </div>

          <div v-if="lessonModalLoading" class="past-lesson-modal-body">
            <p class="past-lesson-modal-note">Loading lesson…</p>
          </div>
          <div v-else-if="lessonModalError" class="past-lesson-modal-body">
            <p class="past-lesson-modal-error">{{ lessonModalError }}</p>
          </div>
          <div
            v-else-if="lessonModalLessonDoc"
            class="past-lesson-modal-body past-lesson-edit-body"
          >
            <section class="past-lesson-edit-section">
              <h3 class="past-lesson-edit-section-title">Lesson details</h3>
              <div class="past-lesson-edit-grid">
                <div class="form-group">
                  <label>Class</label>
                  <p class="past-lesson-readonly-value">{{ classDisplayName }}</p>
                  <p class="past-lesson-field-hint">
                    The class for this lesson is fixed; only the linked class record can rename it.
                  </p>
                </div>
                <div class="form-group">
                  <label for="past-edit-teacher">Teacher</label>
                  <select
                    id="past-edit-teacher"
                    v-model="editForm.teacherId"
                    class="past-lesson-select"
                  >
                    <option value="">— None —</option>
                    <option
                      v-for="t in teachersListForSelect"
                      :key="t.id"
                      :value="t.id"
                    >
                      {{ t.name }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="past-edit-date">Lesson date *</label>
                  <input
                    id="past-edit-date"
                    v-model="editForm.lessonDate"
                    type="date"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="past-edit-start">Start time *</label>
                  <input
                    id="past-edit-start"
                    v-model="editForm.startTime"
                    type="time"
                    required
                  >
                </div>
                <div class="form-group">
                  <label for="past-edit-end">End time *</label>
                  <input
                    id="past-edit-end"
                    v-model="editForm.endTime"
                    type="time"
                    required
                  >
                </div>
              </div>

              <div v-if="editingIsMissed" class="form-group">
                <label for="past-edit-missed-remark">Remark / reason *</label>
                <textarea
                  id="past-edit-missed-remark"
                  v-model="editForm.remark"
                  rows="3"
                  placeholder="e.g. Teacher sick, public holiday, class cancelled"
                  required
                />
              </div>
              <template v-else>
                <div class="form-group">
                  <label for="past-edit-desc">Description</label>
                  <textarea
                    id="past-edit-desc"
                    v-model="editForm.description"
                    rows="2"
                    placeholder="What was covered in this lesson?"
                  />
                </div>
                <div class="form-group">
                  <label for="past-edit-homework">Homework</label>
                  <textarea
                    id="past-edit-homework"
                    v-model="editForm.homework"
                    rows="2"
                    placeholder="Homework assigned"
                  />
                </div>
                <div class="form-group">
                  <label for="past-edit-materials">Materials link</label>
                  <input
                    id="past-edit-materials"
                    v-model="editForm.materialsLink"
                    type="url"
                    placeholder="https://..."
                  >
                </div>
                <div class="form-group">
                  <label for="past-edit-remark">Lesson notes / remarks</label>
                  <textarea
                    id="past-edit-remark"
                    v-model="editForm.remark"
                    rows="2"
                    placeholder="Notes for this lesson"
                  />
                </div>
              </template>
            </section>

            <section v-if="!editingIsMissed" class="past-lesson-edit-section">
              <div class="past-lesson-attendance-heading">
                <h3 class="past-lesson-edit-section-title">Student attendance</h3>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm past-lesson-add-makeup-btn"
                  @click="openMakeupSearch"
                >
                  + Add Makeup Student
                </button>
              </div>
              <p class="past-lesson-field-hint past-lesson-attend-hint">
                Fees preview uses the same rules as elsewhere (chargeable status × duration × class hourly rate).
              </p>

              <div
                v-if="visibleAttendanceRows.length === 0"
                class="past-lesson-modal-empty"
              >
                No attendance rows for this lesson.
              </div>

              <!-- Desktop: table -->
              <div class="past-edit-students-desktop table-wrapper">
                <table class="table past-edit-student-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Type</th>
                      <th>Status *</th>
                      <th>Duration *</th>
                      <th>Charged</th>
                      <th>Fee</th>
                      <th>Remark</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in visibleAttendanceRows"
                      :key="row.key"
                    >
                      <td>
                        <div class="past-edit-name">{{ row.studentName }}</div>
                        <span v-if="row.isMakeup" class="past-edit-makeup-badge">Makeup</span>
                        <div v-if="row.meta" class="past-edit-student-meta">{{ row.meta }}</div>
                      </td>
                      <td>
                        <span v-if="row.isMakeup" class="past-edit-type-makeup">Makeup</span>
                        <span v-else class="past-edit-type-reg">Regular</span>
                      </td>
                      <td>
                        <select v-model="row.status" class="past-lesson-select" required>
                          <option
                            v-for="opt in attendanceStatusOptions"
                            :key="opt"
                            :value="opt"
                          >
                            {{ opt }}
                          </option>
                        </select>
                      </td>
                      <td>
                        <select
                          v-model.number="row.durationHours"
                          class="past-lesson-select"
                          required
                        >
                          <option
                            v-for="opt in durationOptions"
                            :key="opt"
                            :value="opt"
                          >
                            {{ formatDurationLabel(opt) }}
                          </option>
                        </select>
                      </td>
                      <td>{{ rowChargedLabel(row) }}</td>
                      <td class="past-edit-fee-cell">
                        {{ formatCurrency(rowFeePreview(row)) }}
                      </td>
                      <td>
                        <input
                          v-model="row.remark"
                          type="text"
                          class="past-edit-remark-input"
                          placeholder="Optional"
                          :aria-label="'Remark for ' + row.studentName"
                        >
                      </td>
                      <td>
                        <button
                          v-if="row.isMakeup"
                          type="button"
                          class="btn btn-danger btn-sm"
                          :disabled="editLessonSaving"
                          @click="removeMakeupStudentFromLesson(row)"
                        >
                          Remove
                        </button>
                        <span v-else class="past-edit-actions-dash">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile: stacked cards -->
              <div class="past-edit-students-mobile">
                <article
                  v-for="row in visibleAttendanceRows"
                  :key="'m-' + row.key"
                  class="past-edit-student-card"
                >
                  <div class="past-edit-card-header">
                    <span class="past-edit-card-name">{{ row.studentName }}</span>
                    <span v-if="row.isMakeup" class="past-edit-makeup-badge">Makeup</span>
                  </div>
                  <p v-if="row.meta" class="past-edit-card-meta">{{ row.meta }}</p>
                  <div class="form-group">
                    <label class="past-edit-card-label">Attendance *</label>
                    <select v-model="row.status" class="past-lesson-select" required>
                      <option
                        v-for="opt in attendanceStatusOptions"
                        :key="opt"
                        :value="opt"
                      >
                        {{ opt }}
                      </option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="past-edit-card-label">Duration *</label>
                    <select
                      v-model.number="row.durationHours"
                      class="past-lesson-select"
                      required
                    >
                      <option
                        v-for="opt in durationOptions"
                        :key="opt"
                        :value="opt"
                      >
                        {{ formatDurationLabel(opt) }}
                      </option>
                    </select>
                  </div>
                  <div class="past-edit-card-row">
                    <span class="past-edit-card-k">Charged</span>
                    <span class="past-edit-card-v">{{ rowChargedLabel(row) }}</span>
                  </div>
                  <div class="past-edit-card-row">
                    <span class="past-edit-card-k">Fee</span>
                    <span class="past-edit-card-v past-edit-card-fee">
                      {{ formatCurrency(rowFeePreview(row)) }}
                    </span>
                  </div>
                  <div class="form-group">
                    <label class="past-edit-card-label">Remark</label>
                    <input
                      v-model="row.remark"
                      type="text"
                      class="past-edit-remark-input"
                      placeholder="Optional"
                    >
                  </div>
                  <div v-if="row.isMakeup" class="past-edit-card-actions">
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      :disabled="editLessonSaving"
                      @click="removeMakeupStudentFromLesson(row)"
                    >
                      Remove makeup
                    </button>
                  </div>
                </article>
              </div>
            </section>

            <div v-if="editLessonError" class="error past-lesson-edit-error">
              {{ editLessonError }}
            </div>
            <div v-if="editLessonSuccess" class="success past-lesson-edit-success">
              Lesson saved successfully.
            </div>

            <div class="past-lesson-edit-actions">
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="editLessonSaving"
                @click="closeLessonDetail"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="editLessonSaving || lessonModalLoading"
                @click="saveLessonDetail"
              >
                {{ editLessonSaving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showMakeupSearchModal"
        class="modal-overlay past-makeup-search-overlay"
        role="presentation"
        @click.self="closeMakeupSearch"
      >
        <div class="modal-content past-makeup-search-modal" @click.stop>
          <div class="past-makeup-search-header">
            <h3>Add Makeup Student</h3>
            <button
              type="button"
              class="past-makeup-search-close"
              aria-label="Close"
              @click="closeMakeupSearch"
            >
              &times;
            </button>
          </div>
          <p class="past-makeup-search-hint">
            Search by name, level, school, or parent contact. Active and inactive
            students are included. The student is added only to this lesson —
            not enrolled in the class permanently.
          </p>
          <input
            v-model="makeupSearch"
            type="text"
            placeholder="Search student…"
            class="past-makeup-search-input"
          >
          <div v-if="makeupLoading" class="past-makeup-search-empty">Loading students…</div>
          <div
            v-else-if="filteredMakeupStudents.length === 0"
            class="past-makeup-search-empty"
          >
            No matching students.
          </div>
          <ul v-else class="past-makeup-results">
            <li
              v-for="option in filteredMakeupStudents"
              :key="option.id"
              :class="[
                'past-makeup-result-item',
                { 'past-makeup-result-inactive': !isStudentActive(option) }
              ]"
            >
              <div class="past-makeup-result-info">
                <div class="past-makeup-result-name">
                  <span>{{ option.name }}</span>
                  <span :class="getStudentStatusClass(option)">
                    {{ getStudentStatusLabel(option) }}
                  </span>
                </div>
                <div class="past-makeup-result-meta">
                  <span v-if="option.level">{{ option.level }}</span>
                  <span v-if="option.school"> · {{ option.school }}</span>
                  <span v-if="option.parent_contact"> · {{ option.parent_contact }}</span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="isStudentAlreadyAdded(option.id)"
                @click="addMakeupStudentToLesson(option)"
              >
                {{ isStudentAlreadyAdded(option.id) ? 'Added' : 'Add' }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { api } from '../api'
import Navbar from '../components/Navbar.vue'
import { useAdminData } from '../composables/useAdminData'
import {
  STUDENT_PAYMENTS_COLLECTION,
  getPaymentDocKey
} from '../constants/studentPayments'
import { sumBillItemAmounts } from '../constants/billAdjustments'
import {
  ATTENDANCE_STATUS_OPTIONS,
  ATTENDANCE_STATUSES,
  normalizeAttendanceStatus,
  isChargeableAttendance
} from '../constants/attendance'
import {
  isStudentActive,
  getStudentStatusRank,
  getStudentStatusLabel,
  getStudentStatusClass
} from '../constants/studentStatus'
import {
  DURATION_OPTIONS,
  getClassDefaultDuration,
  calculateAttendanceFee,
  formatDurationLabel
} from '../constants/billing'
import { resolveLessonClockTimes, isMissedLesson } from '../constants/lessons'
import {
  buildLessonSummaryRows,
  groupLessonSummariesByMonth,
  buildStudentMonthlyFees,
  defaultPastDataMonthFloor,
  getMonthLabelFromKey
} from '../utils/pastData'
import { resolveAttendanceStudentName } from '../utils/attendanceDisplay'

const BILL_ADJ_COLLECTION = 'billAdjustments'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export default {
  name: 'PastDataView',
  components: { Navbar },
  setup () {
    const {
      students,
      classes,
      teachers,
      lessons,
      attendance,
      isLoaded,
      isLoading,
      loadAdminData,
      refreshLessons,
      refreshAttendance
    } = useAdminData()

    // ---------- core state ----------
    const error = ref('')
    const feeError = ref('')
    const selectedTeacherId = ref('')

    // Bill adjustments + payment status are loaded directly here so we don't
    // mutate StudentsView's state. Keys are `${studentId}_${monthKey}`.
    const billAdjustmentsByKey = ref({})
    const paymentStatusMap = ref({})
    const togglingKey = ref(null)
    const adjLoading = ref(false)
    const paymentsLoading = ref(false)

    const fromMonthKey = computed(() => defaultPastDataMonthFloor())
    const floorYear = computed(() => Number(fromMonthKey.value.slice(0, 4)))

    const loading = computed(
      () => (isLoading.value && !isLoaded.value) || adjLoading.value || paymentsLoading.value
    )

    // ---------- helpers ----------
    const formatCurrency = (v) => currencyFormatter.format(Number(v) || 0)
    const formatSignedAmount = (v) => {
      const n = Number(v) || 0
      if (n === 0) return '$0.00'
      const formatted = currencyFormatter.format(Math.abs(n))
      return n > 0 ? `+${formatted}` : `-${formatted}`
    }
    const formatLessonDateShort = (d) => {
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        weekday: 'short'
      })
    }

    const attendanceStatusOptions = ATTENDANCE_STATUS_OPTIONS
    const durationOptions = DURATION_OPTIONS

    const parseTimeToMinutes = (timeStr) => {
      const s = String(timeStr || '').trim()
      if (!s) return null
      const parts = s.split(':')
      if (parts.length < 2) return null
      const h = Number(parts[0])
      const m = Number(parts[1])
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null
      return h * 60 + m
    }

    const allowedAttendanceStatuses = new Set([
      ...ATTENDANCE_STATUS_OPTIONS,
      ATTENDANCE_STATUSES.MISSED
    ])

    // ---------- lesson edit modal (Past Classes) ----------
    const lessonModalOpen = ref(false)
    const lessonModalLoading = ref(false)
    const lessonModalError = ref('')
    const lessonModalLessonDoc = ref(null)
    const editingLessonId = ref(null)
    const editLessonSaving = ref(false)
    const editLessonError = ref('')
    const editLessonSuccess = ref(false)

    const editForm = reactive({
      lessonDate: '',
      startTime: '',
      endTime: '',
      teacherId: '',
      remark: '',
      description: '',
      homework: '',
      materialsLink: '',
      attendanceRows: []
    })

    const editingIsMissed = computed(() =>
      Boolean(lessonModalLessonDoc.value && isMissedLesson(lessonModalLessonDoc.value))
    )

    const resolvedClassForEdit = computed(() => {
      const doc = lessonModalLessonDoc.value
      if (!doc) return null
      const cid = doc.class_id || doc.classId || ''
      if (!cid) return null
      return classes.value.find((c) => c.id === cid) || null
    })

    const classDisplayName = computed(() => {
      if (resolvedClassForEdit.value?.name) return resolvedClassForEdit.value.name
      const doc = lessonModalLessonDoc.value
      if (!doc) return '—'
      return (
        doc.class_name ||
        doc.className ||
        (doc.class_id || doc.classId
          ? `Class ${String(doc.class_id || doc.classId).slice(0, 8)}`
          : '—')
      )
    })

    const teachersListForSelect = computed(() =>
      [...(teachers.value || [])].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      )
    )

    const visibleAttendanceRows = computed(() =>
      editForm.attendanceRows.filter((r) => !r.shouldDelete)
    )

    const draftLessonForFee = computed(() => {
      const base = lessonModalLessonDoc.value
      if (!base) return null
      const st = String(editForm.startTime || '').trim()
      const en = String(editForm.endTime || '').trim()
      const timing = st && en ? `${st}-${en}` : ''
      return {
        ...base,
        lesson_date: editForm.lessonDate,
        lessonDate: editForm.lessonDate,
        start_time: editForm.startTime,
        startTime: editForm.startTime,
        end_time: editForm.endTime,
        endTime: editForm.endTime,
        lesson_timing: timing,
        lessonTiming: timing
      }
    })

    const rowFeePreview = (row) => {
      if (editingIsMissed.value || !row) return 0
      const cls = resolvedClassForEdit.value
      const lesson = draftLessonForFee.value
      if (!cls || !lesson) return 0
      const att = {
        status: row.status,
        durationHours: row.durationHours,
        duration_hours: row.durationHours
      }
      return calculateAttendanceFee(att, lesson, cls)
    }

    const rowChargedLabel = (row) => {
      if (editingIsMissed.value) return 'No'
      const n = normalizeAttendanceStatus(row.status)
      return isChargeableAttendance(n) ? 'Yes' : 'No'
    }

    const resetEditForm = () => {
      editForm.lessonDate = ''
      editForm.startTime = ''
      editForm.endTime = ''
      editForm.teacherId = ''
      editForm.remark = ''
      editForm.description = ''
      editForm.homework = ''
      editForm.materialsLink = ''
      editForm.attendanceRows = []
    }

    const closeLessonDetail = () => {
      if (editLessonSaving.value) return
      closeMakeupSearch()
      lessonModalOpen.value = false
      lessonModalLoading.value = false
      lessonModalError.value = ''
      lessonModalLessonDoc.value = null
      editingLessonId.value = null
      editLessonError.value = ''
      editLessonSuccess.value = false
      resetEditForm()
    }

    const openLessonDetail = async (row) => {
      if (!row?.lessonId) return
      lessonModalOpen.value = true
      lessonModalLoading.value = true
      lessonModalError.value = ''
      lessonModalLessonDoc.value = null
      editingLessonId.value = row.lessonId
      editLessonError.value = ''
      editLessonSuccess.value = false
      resetEditForm()

      try {
        let lessonDoc = lessons.value.find((l) => l.id === row.lessonId)
        if (!lessonDoc) {
          await auth.authStateReady?.()
          if (!auth.currentUser) {
            throw new Error('Not signed in. Please log in again.')
          }
          const snap = await getDoc(doc(db, 'lessons', row.lessonId))
          if (!snap.exists()) {
            throw new Error('This lesson could not be found. It may have been deleted.')
          }
          lessonDoc = { id: snap.id, ...snap.data() }
        }

        lessonModalLessonDoc.value = { ...lessonDoc, id: lessonDoc.id || row.lessonId }

        const classId = lessonDoc.class_id || lessonDoc.classId || ''
        const cls = classId
          ? classes.value.find((c) => c.id === classId)
          : null
        const classDefault = getClassDefaultDuration(cls || {})
        const validDurations = new Set(DURATION_OPTIONS)

        editForm.lessonDate =
          lessonDoc.lesson_date || lessonDoc.lessonDate || ''
        const clock = resolveLessonClockTimes(lessonDoc, cls)
        editForm.startTime =
          lessonDoc.start_time || lessonDoc.startTime || clock.startTime || ''
        editForm.endTime =
          lessonDoc.end_time || lessonDoc.endTime || clock.endTime || ''
        editForm.teacherId = lessonDoc.teacher_id || lessonDoc.teacherId || ''
        editForm.remark = lessonDoc.remark || lessonDoc.remarks || ''
        editForm.description = lessonDoc.description || ''
        editForm.homework = lessonDoc.homework || ''
        editForm.materialsLink =
          lessonDoc.materials_link || lessonDoc.materialsLink || ''

        const atts = (attendance.value || []).filter(
          (a) => (a.lesson_id || a.lessonId) === row.lessonId
        )
        const studentById = Object.fromEntries(
          (students.value || []).map((s) => [s.id, s])
        )
        editForm.attendanceRows = atts.map((att) => {
          const studentId = att.student_id || att.studentId || ''
          let durationHours = Number(att.duration_hours ?? att.durationHours)
          if (!validDurations.has(durationHours)) {
            durationHours = classDefault
          }
          const norm = normalizeAttendanceStatus(att.status)
          const status =
            norm && allowedAttendanceStatuses.has(norm)
              ? norm
              : ATTENDANCE_STATUSES.PRESENT
          return {
            key: `att-${att.id || 'row'}-${studentId || 'unknown'}`,
            attendanceId: att.id || null,
            studentId,
            studentName: resolveAttendanceStudentName(att, { studentById }),
            status,
            durationHours,
            isMakeup: Boolean(att.is_makeup ?? att.isMakeup),
            isNew: false,
            shouldDelete: false,
            remark: att.remark || att.remarks || '',
            meta: ''
          }
        })
      } catch (e) {
        console.error('[PastData] openLessonDetail:', e)
        lessonModalError.value =
          e?.message || 'Could not load lesson details. Please try again.'
        lessonModalLessonDoc.value = null
      } finally {
        lessonModalLoading.value = false
      }
    }

    const saveLessonDetail = async () => {
      editLessonError.value = ''
      editLessonSuccess.value = false
      if (!editingLessonId.value) return

      if (!editForm.lessonDate) {
        editLessonError.value = 'Lesson date is required.'
        return
      }
      if (!editForm.startTime || !String(editForm.startTime).trim()) {
        editLessonError.value = 'Start time is required.'
        return
      }
      if (!editForm.endTime || !String(editForm.endTime).trim()) {
        editLessonError.value = 'End time is required.'
        return
      }
      const startM = parseTimeToMinutes(editForm.startTime)
      const endM = parseTimeToMinutes(editForm.endTime)
      if (startM == null || endM == null) {
        editLessonError.value = 'Start and end time must be valid times.'
        return
      }
      if (endM <= startM) {
        editLessonError.value = 'End time must be after start time.'
        return
      }

      const editedLessonTiming = `${String(editForm.startTime).trim()}-${String(
        editForm.endTime
      ).trim()}`

      if (editingIsMissed.value) {
        const r = (editForm.remark || '').trim()
        if (!r) {
          editLessonError.value = 'Please enter a reason for the missed lesson.'
          return
        }
        const payload = {
          lesson_date: editForm.lessonDate,
          lesson_timing: editedLessonTiming,
          start_time: editForm.startTime,
          end_time: editForm.endTime,
          teacher_id: editForm.teacherId || '',
          teacherId: editForm.teacherId || '',
          remark: r,
          lesson_type: 'missed',
          status: 'missed',
          description: '',
          homework: '',
          materials_link: ''
        }
        editLessonSaving.value = true
        try {
          await api.put(`/api/lessons/${editingLessonId.value}`, payload)
          editLessonSuccess.value = true
          await refreshLessons()
          await refreshAttendance()
          setTimeout(() => {
            editLessonSuccess.value = false
            closeLessonDetail()
          }, 900)
        } catch (err) {
          console.error('[PastData] saveLessonDetail (missed):', err)
          editLessonError.value = err.message || 'Failed to save lesson.'
        } finally {
          editLessonSaving.value = false
        }
        return
      }

      const validDurations = new Set(DURATION_OPTIONS)
      for (const row of editForm.attendanceRows) {
        if (row.shouldDelete) continue
        const st = normalizeAttendanceStatus(row.status)
        if (!st || !allowedAttendanceStatuses.has(st)) {
          editLessonError.value = `Pick a valid attendance status for ${row.studentName || 'each student'}.`
          return
        }
        if (!validDurations.has(Number(row.durationHours))) {
          editLessonError.value = `Pick a valid duration for ${row.studentName || 'each student'}.`
          return
        }
      }

      const payload = {
        lesson_date: editForm.lessonDate,
        lesson_timing: editedLessonTiming,
        start_time: editForm.startTime,
        end_time: editForm.endTime,
        teacher_id: editForm.teacherId || '',
        teacherId: editForm.teacherId || '',
        description: editForm.description || '',
        homework: editForm.homework || '',
        materials_link: editForm.materialsLink || '',
        remark: editForm.remark || '',
        attendance: editForm.attendanceRows.map((row) => ({
          id: row.attendanceId || undefined,
          student_id: row.studentId,
          student_name: row.studentName,
          studentName: row.studentName,
          status: row.status,
          duration_hours: Number(row.durationHours),
          is_makeup: Boolean(row.isMakeup),
          remark: row.remark || '',
          _remove: Boolean(row.shouldDelete)
        }))
      }

      editLessonSaving.value = true
      try {
        await api.put(`/api/lessons/${editingLessonId.value}`, payload)
        editLessonSuccess.value = true
        await refreshLessons()
        await refreshAttendance()
        setTimeout(() => {
          editLessonSuccess.value = false
          closeLessonDetail()
        }, 900)
      } catch (err) {
        console.error('[PastData] saveLessonDetail:', err)
        editLessonError.value = err.message || 'Failed to save lesson.'
      } finally {
        editLessonSaving.value = false
      }
    }

    // ---------- makeup student picker (edit lesson modal) ----------
    const showMakeupSearchModal = ref(false)
    const makeupSearch = ref('')
    const makeupLoading = ref(false)
    const makeupCatalog = ref([])
    const makeupRowCounter = ref(0)

    const sortMakeupCandidates = (list) =>
      [...(list || [])].sort((a, b) => {
        const rankDiff = getStudentStatusRank(a) - getStudentStatusRank(b)
        if (rankDiff !== 0) return rankDiff
        return (a.name || '').localeCompare(b.name || '', undefined, {
          sensitivity: 'base'
        })
      })

    const filteredMakeupStudents = computed(() => {
      const term = makeupSearch.value.trim().toLowerCase()
      const list = makeupCatalog.value || []
      const matched = term
        ? list.filter((s) => {
          const hay = [s.name, s.school, s.level, s.parent_contact, s.parent_name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(term)
        })
        : list
      return sortMakeupCandidates(matched).slice(0, 50)
    })

    const isStudentAlreadyAdded = (studentId) =>
      editForm.attendanceRows.some(
        (r) => !r.shouldDelete && r.studentId === studentId
      )

    const loadMakeupCatalog = async () => {
      makeupLoading.value = true
      try {
        const list = await api.getPublic('/api/public/students-minimal')
        makeupCatalog.value = Array.isArray(list) ? list : []
      } catch (err) {
        console.error('[PastData] loadMakeupCatalog:', err)
        makeupCatalog.value = []
      } finally {
        makeupLoading.value = false
      }
    }

    const openMakeupSearch = async () => {
      if (editingIsMissed.value || !lessonModalLessonDoc.value) return
      makeupSearch.value = ''
      showMakeupSearchModal.value = true
      await loadMakeupCatalog()
    }

    const closeMakeupSearch = () => {
      showMakeupSearchModal.value = false
      makeupSearch.value = ''
    }

    const addMakeupStudentToLesson = (student) => {
      if (!student?.id || isStudentAlreadyAdded(student.id)) return
      const cls = resolvedClassForEdit.value
      const classDefault = getClassDefaultDuration(cls || {})
      const metaParts = [student.level, student.school].filter(Boolean)
      makeupRowCounter.value += 1
      editForm.attendanceRows.push({
        key: `new-${makeupRowCounter.value}`,
        attendanceId: null,
        studentId: student.id,
        studentName: student.name || 'Unknown',
        status: ATTENDANCE_STATUSES.PRESENT,
        durationHours: classDefault,
        isMakeup: true,
        isNew: true,
        shouldDelete: false,
        remark: '',
        meta: metaParts.join(' · ')
      })
    }

    const removeMakeupStudentFromLesson = (row) => {
      if (!row?.isMakeup) return
      if (row.isNew) {
        editForm.attendanceRows = editForm.attendanceRows.filter(
          (r) => r.key !== row.key
        )
      } else {
        row.shouldDelete = true
      }
    }

    const onLessonModalKeydown = (e) => {
      if (e.key !== 'Escape' || editLessonSaving.value) return
      if (showMakeupSearchModal.value) {
        closeMakeupSearch()
        return
      }
      if (lessonModalOpen.value) closeLessonDetail()
    }

    // ---------- teacher filter options ----------
    // Built from the list of teachers used in the visible past lessons so the
    // dropdown never lists teachers without history. Always alphabetical.
    const teacherOptions = computed(() => {
      const inUse = new Map()
      for (const row of allLessonRows.value) {
        if (!row.teacherId) continue
        if (!inUse.has(row.teacherId)) {
          inUse.set(row.teacherId, row.teacherName)
        }
      }
      const list = [...inUse.entries()].map(([id, name]) => ({
        id,
        name: name || '—'
      }))
      list.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      )
      return list
    })

    // ---------- past lessons ----------
    const allLessonRows = computed(() =>
      buildLessonSummaryRows(
        lessons.value,
        attendance.value,
        classes.value,
        teachers.value,
        { fromMonthKey: fromMonthKey.value }
      )
    )

    const filteredLessonRows = computed(() => {
      if (!selectedTeacherId.value) return allLessonRows.value
      return allLessonRows.value.filter(
        (row) => row.teacherId === selectedTeacherId.value
      )
    })

    const filteredLessonMonthGroups = computed(() =>
      groupLessonSummariesByMonth(filteredLessonRows.value)
    )

    // ---------- monthly student fees ----------
    const allStudentFeeRows = computed(() =>
      buildStudentMonthlyFees(
        students.value,
        lessons.value,
        attendance.value,
        classes.value,
        billAdjustmentsByKey.value,
        { fromMonthKey: fromMonthKey.value }
      )
    )

    /**
     * Columns: every month from January <floor year> through max(current month,
     * latest month with any data). Always chronological so the user reads
     * left → right (oldest to newest).
     */
    const monthColumns = computed(() => {
      const [startYStr] = fromMonthKey.value.split('-')
      const startY = Number(startYStr) || new Date().getFullYear()
      const startM = 1

      const now = new Date()
      let endY = now.getFullYear()
      let endM = now.getMonth() + 1
      for (const r of allStudentFeeRows.value) {
        const [yStr, mStr] = (r.monthKey || '').split('-')
        const y = Number(yStr)
        const m = Number(mStr)
        if (!Number.isFinite(y) || !Number.isFinite(m)) continue
        if (y > endY || (y === endY && m > endM)) {
          endY = y
          endM = m
        }
      }

      const list = []
      let y = startY
      let m = startM
      // Hard cap to avoid runaway loops if data is malformed.
      let safety = 0
      while ((y < endY || (y === endY && m <= endM)) && safety < 240) {
        const monthKey = `${y}-${String(m).padStart(2, '0')}`
        list.push({
          monthKey,
          monthLabel: getMonthLabelFromKey(monthKey)
        })
        m += 1
        if (m > 12) {
          m = 1
          y += 1
        }
        safety += 1
      }
      return list
    })

    /**
     * Pivot all (student × month) rows into one row per student with a
     * `cells[monthKey]` map. Students are sorted alphabetically. Only students
     * who have at least one cell in the visible window appear.
     */
    const studentRows = computed(() => {
      const byStudent = new Map()
      for (const r of allStudentFeeRows.value) {
        if (!byStudent.has(r.studentId)) {
          byStudent.set(r.studentId, {
            studentId: r.studentId,
            studentName: r.studentName,
            cells: {}
          })
        }
        byStudent.get(r.studentId).cells[r.monthKey] = {
          monthKey: r.monthKey,
          lessonTotal: r.lessonTotal,
          billAdjustmentTotal: r.billAdjustmentTotal,
          finalTotal: r.finalTotal,
          attendedCount: r.attendedCount,
          chargedCount: r.chargedCount,
          // Pre-shaped argument for isPaid / isToggling / onTogglePaid so the
          // template doesn't need to construct it on every render.
          paymentRow: {
            studentId: r.studentId,
            studentName: r.studentName,
            monthKey: r.monthKey,
            finalTotal: r.finalTotal
          }
        }
      }
      return [...byStudent.values()].sort((a, b) =>
        (a.studentName || '').localeCompare(b.studentName || '', undefined, {
          sensitivity: 'base'
        })
      )
    })

    // ---------- payment toggle (persists to Firestore) ----------
    /**
     * Display rule mirrors StudentsView so paid/unpaid is consistent across
     * the two views: when the final fee is exactly $0 and there's no doc
     * explicitly marking it unpaid, treat it as paid (✅).
     */
    const isPaid = (row) => {
      if (!row?.studentId || !row?.monthKey) return false
      const key = getPaymentDocKey(row.studentId, row.monthKey)
      const docRow = paymentStatusMap.value[key]
      const fee = Number(row.finalTotal)
      if (Number.isFinite(fee) && fee === 0) {
        if (docRow && docRow.paid === false) return false
        return true
      }
      return Boolean(docRow?.paid)
    }

    const isToggling = (row) =>
      togglingKey.value === getPaymentDocKey(row.studentId, row.monthKey)

    const onTogglePaid = async (row) => {
      if (!row?.studentId || !row?.monthKey) return
      const key = getPaymentDocKey(row.studentId, row.monthKey)
      if (togglingKey.value === key) return
      togglingKey.value = key

      const currentlyPaid = isPaid(row)
      const nextPaid = !currentlyPaid
      const now = new Date()
      try {
        await auth.authStateReady?.()
        if (!auth.currentUser) {
          throw new Error('Not signed in. Please log in again.')
        }
        await setDoc(
          doc(db, STUDENT_PAYMENTS_COLLECTION, key),
          {
            studentId: row.studentId,
            studentName: row.studentName || null,
            monthKey: row.monthKey,
            amount: Number(row.finalTotal) || 0,
            paid: nextPaid,
            paidAt: nextPaid ? now : null,
            updatedAt: now
          },
          { merge: true }
        )
        paymentStatusMap.value = {
          ...paymentStatusMap.value,
          [key]: {
            studentId: row.studentId,
            monthKey: row.monthKey,
            paid: nextPaid,
            paidAt: nextPaid ? now : null,
            updatedAt: now
          }
        }
      } catch (e) {
        console.error('[PastData] toggle payment failed:', e)
        feeError.value = e?.message || 'Failed to update payment status.'
      } finally {
        togglingKey.value = null
      }
    }

    // ---------- one-shot loads for adjustments + payment docs ----------
    const normalizePaymentDoc = (data) => {
      if (!data) return null
      const sid = data.studentId
      const mk = data.monthKey
      if (!sid || !mk) return null
      let paidAt = data.paidAt
      if (paidAt?.toDate) paidAt = paidAt.toDate()
      let updatedAt = data.updatedAt
      if (updatedAt?.toDate) updatedAt = updatedAt.toDate()
      return {
        studentId: sid,
        monthKey: mk,
        paid: Boolean(data.paid),
        paidAt: paidAt ?? null,
        updatedAt: updatedAt ?? null
      }
    }

    const loadAllBillAdjustments = async () => {
      adjLoading.value = true
      try {
        await auth.authStateReady?.()
        if (!auth.currentUser) {
          billAdjustmentsByKey.value = {}
          return
        }
        const snap = await getDocs(collection(db, BILL_ADJ_COLLECTION))
        const next = {}
        snap.forEach((d) => {
          const data = d.data()
          const sid = data.studentId
          const mk = data.monthKey
          if (!sid || !mk) return
          next[`${sid}_${mk}`] = {
            studentId: sid,
            monthKey: mk,
            items: Array.isArray(data.items) ? data.items : [],
            totalAdjustmentAmount:
              data.totalAdjustmentAmount != null
                ? Number(data.totalAdjustmentAmount) || 0
                : sumBillItemAmounts(data.items || [])
          }
        })
        billAdjustmentsByKey.value = next
      } catch (e) {
        console.error('[PastData] loadAllBillAdjustments:', e)
        feeError.value =
          e?.message || 'Failed to load bill adjustments. Fee totals may be missing extras.'
      } finally {
        adjLoading.value = false
      }
    }

    const loadAllStudentPayments = async () => {
      paymentsLoading.value = true
      try {
        await auth.authStateReady?.()
        if (!auth.currentUser) {
          paymentStatusMap.value = {}
          return
        }
        const snap = await getDocs(collection(db, STUDENT_PAYMENTS_COLLECTION))
        const patch = {}
        snap.forEach((d) => {
          const row = normalizePaymentDoc(d.data())
          if (!row) return
          patch[getPaymentDocKey(row.studentId, row.monthKey)] = row
        })
        paymentStatusMap.value = patch
      } catch (e) {
        console.error('[PastData] loadAllStudentPayments:', e)
        feeError.value =
          e?.message || 'Failed to load payment status. Tick / cross may be out of date.'
      } finally {
        paymentsLoading.value = false
      }
    }

    onMounted(async () => {
      window.addEventListener('keydown', onLessonModalKeydown)
      try {
        await loadAdminData()
      } catch (e) {
        console.error('[PastData] loadAdminData failed:', e)
        error.value =
          e?.message ||
          'Failed to load core data (lessons, classes, teachers, students). Please refresh.'
      }
      // These two run in parallel; if either fails, the rest of the page still renders.
      await Promise.all([loadAllBillAdjustments(), loadAllStudentPayments()])
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onLessonModalKeydown)
    })

    return {
      loading,
      error,
      feeError,
      floorYear,
      selectedTeacherId,
      teacherOptions,
      filteredLessonMonthGroups,
      monthColumns,
      studentRows,
      formatCurrency,
      formatSignedAmount,
      formatLessonDateShort,
      formatDurationLabel,
      lessonModalOpen,
      lessonModalLoading,
      lessonModalError,
      lessonModalLessonDoc,
      editingIsMissed,
      editForm,
      editLessonSaving,
      editLessonError,
      editLessonSuccess,
      classDisplayName,
      teachersListForSelect,
      attendanceStatusOptions,
      durationOptions,
      visibleAttendanceRows,
      openLessonDetail,
      closeLessonDetail,
      saveLessonDetail,
      rowFeePreview,
      rowChargedLabel,
      isPaid,
      isToggling,
      onTogglePaid,
      showMakeupSearchModal,
      makeupSearch,
      makeupLoading,
      filteredMakeupStudents,
      openMakeupSearch,
      closeMakeupSearch,
      addMakeupStudentToLesson,
      removeMakeupStudentFromLesson,
      isStudentAlreadyAdded,
      isStudentActive,
      getStudentStatusClass,
      getStudentStatusLabel
    }
  }
}
</script>

<style scoped>
.past-data-container {
  padding-bottom: 48px;
}

.past-data-section {
  margin-bottom: 24px;
}

.past-data-section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.past-data-section-title {
  margin: 0 0 4px 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}

.past-data-section-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  max-width: 60ch;
  line-height: 1.5;
}

/* Reuses the dashboard's teacher-filter visual language. */
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
  min-width: 200px;
  max-width: min(280px, 100vw);
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--color-surface, #fff);
  color: var(--color-text, #1e293b);
}

/* ----- shared month / list visuals ----- */
.past-data-state {
  padding: 18px;
  border: 1px dashed var(--color-border, #e2e8f0);
  border-radius: 12px;
  text-align: center;
  color: var(--color-text-muted, #64748b);
  font-size: 0.9375rem;
  background: var(--color-surface-muted, #f8fafc);
}
.past-data-error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}
.past-data-empty p {
  margin: 0;
}

.past-data-month-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.past-month-card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 14px;
  padding: 18px 18px 12px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.past-month-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.past-month-header h3 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  line-height: 1.2;
}
.past-month-meta {
  margin: 4px 0 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
}
.past-month-total {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.past-month-total--revenue {
  background: #eef2ff;
  color: #3730a3;
}
.past-month-total--final {
  background: #ecfdf5;
  color: #065f46;
}

/* ----- past lesson rows ----- */
.past-lesson-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.past-lesson-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.6fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 4px;
  border-top: 1px solid var(--color-border, #f1f5f9);
}
.past-lesson-row:first-child {
  border-top: none;
  padding-top: 6px;
}
.past-lesson-row--missed {
  opacity: 0.75;
}
.past-lesson-row--interactive {
  cursor: pointer;
  border-radius: 10px;
  margin: 2px -6px;
  padding-left: 10px;
  padding-right: 10px;
  transition: background-color 0.15s ease;
}
.past-lesson-row--interactive:hover {
  background: #f1f5f9;
}
.past-lesson-row--interactive:focus-visible {
  outline: 2px solid var(--color-primary, #6366f1);
  outline-offset: 2px;
}
.past-lesson-row--interactive:active {
  background: #e2e8f0;
}

/* ----- lesson detail modal (teleported to body) ----- */
.past-lesson-modal-overlay {
  z-index: 1100;
}
.past-lesson-modal {
  max-width: 760px;
  width: 100%;
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  padding: 22px 22px 20px;
}
.past-lesson-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}
.past-lesson-modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}
.past-lesson-modal-close {
  flex-shrink: 0;
  min-height: 38px;
}
.past-lesson-modal-body {
  padding-top: 16px;
}
.past-lesson-edit-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.past-lesson-edit-section {
  margin-bottom: 8px;
}
.past-lesson-edit-section-title {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
}
.past-lesson-edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px 18px;
}
.past-lesson-readonly-value {
  margin: 0;
  font-weight: 600;
  color: var(--color-text, #0f172a);
  font-size: 0.9375rem;
}
.past-lesson-field-hint {
  margin: 6px 0 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.4;
}
.past-lesson-attendance-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.past-lesson-attendance-heading .past-lesson-edit-section-title {
  margin-bottom: 0;
}
.past-lesson-add-makeup-btn {
  flex-shrink: 0;
}
.past-lesson-attend-hint {
  margin: -4px 0 12px 0;
}
.past-edit-student-meta {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
}
.past-edit-card-meta {
  margin: -4px 0 10px 0;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
}
.past-edit-card-actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border, #f1f5f9);
}
.past-edit-actions-dash {
  color: var(--color-text-muted, #94a3b8);
  font-size: 0.875rem;
}
.past-makeup-search-overlay {
  z-index: 1200;
  align-items: flex-start;
  padding-top: 24px;
}
.past-makeup-search-modal {
  max-width: 520px;
  width: 100%;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 20px 22px;
}
.past-makeup-search-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.past-makeup-search-header h3 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
}
.past-makeup-search-close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted, #64748b);
  padding: 0 4px;
}
.past-makeup-search-hint {
  margin: 0 0 14px 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.5;
}
.past-makeup-search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 1rem;
  margin-bottom: 12px;
}
.past-makeup-search-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-muted, #64748b);
  font-size: 0.875rem;
}
.past-makeup-results {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 50vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.past-makeup-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border, #f1f5f9);
}
.past-makeup-result-item:last-child {
  border-bottom: none;
}
.past-makeup-result-inactive {
  opacity: 0.9;
}
.past-makeup-result-info {
  min-width: 0;
  flex: 1;
}
.past-makeup-result-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}
.past-makeup-result-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  margin-top: 4px;
}

/* Status badges in makeup picker (same visual language as ClassView). */
.past-makeup-search-modal .student-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 999px;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  white-space: nowrap;
}
.past-makeup-search-modal .student-status-active {
  color: #065f46;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.past-makeup-search-modal .student-status-dropped {
  color: #9a3412;
  background: #ffedd5;
  border-color: #fed7aa;
}
.past-makeup-search-modal .student-status-graduated {
  color: #4c1d95;
  background: #ede9fe;
  border-color: #ddd6fe;
}
.past-makeup-search-modal .student-status-stopped {
  color: #334155;
  background: #e2e8f0;
  border-color: #cbd5e1;
}
.past-makeup-search-modal .student-status-inactive {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}
.past-lesson-select {
  width: 100%;
  max-width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--color-surface, #fff);
}
.past-edit-student-table {
  min-width: 800px;
  font-size: 0.8125rem;
  margin: 0;
}
.past-edit-students-desktop.table-wrapper :deep(.past-edit-student-table thead th:first-child) {
  position: sticky;
  left: 0;
  z-index: 2;
  background: #f8fafc;
  box-shadow: 1px 0 0 var(--color-border, #e5e7eb);
}
.past-edit-students-desktop.table-wrapper :deep(.past-edit-student-table tbody td:first-child) {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #ffffff;
  box-shadow: 1px 0 0 var(--color-border, #e5e7eb);
}
.past-edit-students-desktop.table-wrapper :deep(.past-edit-student-table tbody tr:hover td:first-child) {
  background: #f8fafc;
}
.past-edit-student-table :deep(th),
.past-edit-student-table :deep(td) {
  vertical-align: middle;
}
.past-edit-fee-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.past-edit-name {
  font-weight: 600;
}
.past-edit-makeup-badge {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #ede9fe;
  color: #5b21b6;
}
.past-edit-type-makeup,
.past-edit-type-reg {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
}
.past-edit-remark-input {
  width: 100%;
  max-width: 220px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.8125rem;
}
/* Desktop: table; mobile: hide table, show cards */
.past-edit-students-mobile {
  display: none;
}
.past-edit-students-desktop {
  display: block;
}
.past-edit-student-card {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  padding: 14px 14px 8px;
  margin-bottom: 12px;
  background: #fafafa;
}
.past-edit-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.past-edit-card-name {
  font-weight: 700;
  font-size: 0.9375rem;
  color: var(--color-text, #0f172a);
}
.past-edit-card-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 4px;
  display: block;
}
.past-edit-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--color-border, #f1f5f9);
}
.past-edit-card-k {
  color: var(--color-text-muted, #64748b);
}
.past-edit-card-v {
  font-weight: 600;
}
.past-edit-card-fee {
  font-variant-numeric: tabular-nums;
}
.past-lesson-edit-error {
  margin-top: 12px;
}
.past-lesson-edit-success {
  margin-top: 12px;
}
.past-lesson-edit-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}
.past-lesson-modal-note,
.past-lesson-modal-empty {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted, #64748b);
}
.past-lesson-modal-error {
  margin: 0;
  font-size: 0.9375rem;
  color: #991b1b;
}

@media (max-width: 768px) {
  .past-lesson-modal {
    padding: 18px 16px 16px;
    max-height: calc(100dvh - 16px);
  }
  .past-lesson-edit-grid {
    grid-template-columns: 1fr;
  }
  .past-edit-students-desktop {
    display: none;
  }
  .past-edit-students-mobile {
    display: block;
  }
  .past-edit-remark-input {
    max-width: none;
  }
  .past-lesson-edit-actions {
    flex-direction: column-reverse;
  }
  .past-lesson-edit-actions .btn {
    width: 100%;
  }
}

.past-lesson-primary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.past-lesson-date {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  color: var(--color-text-muted, #64748b);
  font-size: 0.8125rem;
}
.past-lesson-date-day {
  color: var(--color-text, #0f172a);
  font-weight: 600;
  font-size: 0.875rem;
}
.past-lesson-date-time {
  font-variant-numeric: tabular-nums;
}
.past-lesson-class {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.past-lesson-classname {
  font-weight: 600;
  color: var(--color-text, #0f172a);
  font-size: 0.9375rem;
  word-break: break-word;
}
.past-lesson-tag {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.past-lesson-tag--missed {
  background: #fef2f2;
  color: #991b1b;
}

.past-lesson-secondary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  min-width: 0;
}
.past-lesson-teacher {
  font-weight: 600;
  color: var(--color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.past-lesson-counts {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.past-lesson-counts-sep {
  color: var(--color-border, #cbd5e1);
}

.past-lesson-revenue {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text, #0f172a);
  white-space: nowrap;
}

/* ----- single pivoted fees table -----
   One row per student, one column per month. Outer wrapper handles horizontal
   scrolling on narrow viewports; the first column (Student) is sticky on
   desktop and mobile so names stay visible while scrolling sideways. */
.fees-table-wrapper {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: #ffffff;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  /* Allow up to ~70vh of vertical scroll if the student list is long; the
     header stays sticky inside this scroll container. */
  max-height: 70vh;
  overflow-y: auto;
}

.fees-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
  color: var(--color-text, #0f172a);
}

.fees-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f8fafc;
  color: var(--color-text-muted, #475569);
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  white-space: nowrap;
}

.fees-table tbody th.fees-td-student,
.fees-table thead th.fees-th-student {
  position: sticky;
  left: 0;
}

/* Top-left corner needs to win against both the row sticky-th and the column
   sticky-th, so it gets the highest z-index. */
.fees-table thead th.fees-th-student {
  z-index: 3;
  min-width: 180px;
  background: #f8fafc;
}

.fees-table tbody th.fees-td-student {
  z-index: 1;
  background: #ffffff;
  text-align: left;
  font-weight: 600;
  color: var(--color-text, #0f172a);
  font-size: 0.9375rem;
  padding: 10px 14px;
  border-right: 1px solid var(--color-border, #f1f5f9);
  border-bottom: 1px solid var(--color-border, #f1f5f9);
  white-space: nowrap;
  /* Subtle right shadow so the sticky column visually separates from
     the scrolling cells. */
  box-shadow: 1px 0 0 var(--color-border, #e5e7eb);
}

.fees-table tbody tr:hover th.fees-td-student,
.fees-table tbody tr:hover td.fees-td-month {
  background: #f8fafc;
}
.fees-table tbody tr:hover th.fees-td-student {
  /* Maintain sticky background while still showing hover. */
  background: #f8fafc;
}

.fees-th-month {
  min-width: 130px;
}

.fees-td-month {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border, #f1f5f9);
  white-space: nowrap;
  vertical-align: middle;
}

.fees-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.fees-cell-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-text, #0f172a);
}
.fees-cell-empty {
  color: var(--color-text-muted, #94a3b8);
  font-variant-numeric: tabular-nums;
}

.fees-cell-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e2e8f0);
  background: #ffffff;
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
}
.fees-cell-toggle:hover:not(:disabled) {
  border-color: var(--color-primary, #6366f1);
}
.fees-cell-toggle:active:not(:disabled) {
  transform: translateY(1px);
}
.fees-cell-toggle:disabled {
  opacity: 0.5;
  cursor: progress;
}
.fees-cell-toggle--paid {
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.fees-cell-toggle--unpaid {
  background: #fef2f2;
  border-color: #fecaca;
}

/* ===========================================================================
   Mobile (<= 768px)
   ===========================================================================
   Lesson and fee rows become stacked cards. Header controls go full-width.
*/
@media (max-width: 768px) {
  .past-data-section-header {
    align-items: stretch;
  }
  .teacher-filter {
    width: 100%;
  }
  .teacher-filter-select {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .past-month-card {
    padding: 14px 14px 6px;
    border-radius: 12px;
  }
  .past-month-header {
    align-items: flex-start;
  }
  .past-month-total {
    font-size: 0.8125rem;
    padding: 5px 10px;
  }

  /* Lesson rows: card-like 2-row layout (date+class on top, teacher/counts/revenue below). */
  .past-lesson-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 12px 0;
  }
  .past-lesson-row:first-child {
    padding-top: 6px;
  }
  .past-lesson-secondary {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .past-lesson-revenue {
    align-self: flex-end;
    font-size: 0.9375rem;
  }

  /* Fees table: tighter cell padding so each month column fits in less width
     and more columns stay visible per swipe. The first column stays sticky
     via the desktop rules above. */
  .fees-table {
    font-size: 0.8125rem;
  }
  .fees-table thead th {
    padding: 10px 10px;
    font-size: 0.6875rem;
  }
  .fees-th-month {
    min-width: 118px;
  }
  .fees-table thead th.fees-th-student {
    min-width: 130px;
  }
  .fees-table tbody th.fees-td-student {
    padding: 10px 10px;
    font-size: 0.875rem;
  }
  .fees-td-month {
    padding: 10px 10px;
  }
  .fees-cell {
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .past-data-section-title {
    font-size: 1rem;
  }
  .past-data-section-sub {
    font-size: 0.75rem;
  }
  .past-month-card {
    padding: 12px 12px 4px;
  }
  /* Even tighter on phones — the sticky student name column shrinks but stays
     visible while users scroll horizontally through months. */
  .fees-table thead th.fees-th-student {
    min-width: 110px;
  }
  .fees-table tbody th.fees-td-student {
    font-size: 0.8125rem;
    padding: 8px 10px;
  }
  .fees-th-month {
    min-width: 108px;
  }
  .fees-cell-amount {
    font-size: 0.8125rem;
  }
  .fees-cell-toggle {
    font-size: 1.05rem;
    padding: 2px 6px;
  }
}
</style>
