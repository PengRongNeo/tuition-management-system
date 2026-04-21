<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header page-header-actions">
        <div>
          <h1>Students & Fee Overview</h1>
          <p>Manage students and fee breakdown</p>
        </div>
        <div class="student-toolbar-right">
          <div class="sort-controls">
            <label for="students-sort-by" class="sort-label">Sort by</label>
            <select
              id="students-sort-by"
              v-model="sortKey"
              class="sort-select"
              aria-label="Sort students by column"
            >
              <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            <button
              type="button"
              class="sort-direction-btn"
              :aria-label="sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'"
              @click="toggleSortDirection"
            >
              {{ sortDirection === 'asc' ? '↑ Asc' : '↓ Desc' }}
            </button>
          </div>
          <button @click="showCreateModal = true" class="btn btn-primary add-student-btn">
            + Add New Student
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading">Loading students...</div>
      <div v-else-if="students.length === 0" class="card">
        <p>No students found. Add your first student to get started.</p>
      </div>
      <div v-else>
        <div class="card students-table-card">
          <div class="students-table-scroll">
            <table class="table students-table">
              <thead>
                <tr>
                  <th
                    class="th-sortable col-name"
                    :class="{ 'is-sorted': sortKey === 'name' }"
                    :aria-sort="getAriaSort('name')"
                    @click="toggleSort('name')"
                  >
                    <span class="th-sortable-inner">
                      Name <span class="sort-indicator">{{ getSortIcon('name') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'school' }"
                    :aria-sort="getAriaSort('school')"
                    @click="toggleSort('school')"
                  >
                    <span class="th-sortable-inner">
                      School <span class="sort-indicator">{{ getSortIcon('school') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'level' }"
                    :aria-sort="getAriaSort('level')"
                    @click="toggleSort('level')"
                  >
                    <span class="th-sortable-inner">
                      Level <span class="sort-indicator">{{ getSortIcon('level') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'parent_name' }"
                    :aria-sort="getAriaSort('parent_name')"
                    @click="toggleSort('parent_name')"
                  >
                    <span class="th-sortable-inner">
                      Parent Name <span class="sort-indicator">{{ getSortIcon('parent_name') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'parent_contact' }"
                    :aria-sort="getAriaSort('parent_contact')"
                    @click="toggleSort('parent_contact')"
                  >
                    <span class="th-sortable-inner">
                      Parent Contact <span class="sort-indicator">{{ getSortIcon('parent_contact') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'classesEnrolled' }"
                    :aria-sort="getAriaSort('classesEnrolled')"
                    @click="toggleSort('classesEnrolled')"
                  >
                    <span class="th-sortable-inner">
                      Classes Enrolled <span class="sort-indicator">{{ getSortIcon('classesEnrolled') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable col-fees"
                    :class="{ 'is-sorted': sortKey === 'feesThisMonth' }"
                    :aria-sort="getAriaSort('feesThisMonth')"
                    @click="toggleSort('feesThisMonth')"
                  >
                    <span class="th-sortable-inner">
                      Fees This Month <span class="sort-indicator">{{ getSortIcon('feesThisMonth') }}</span>
                    </span>
                  </th>
                  <th
                    class="th-sortable"
                    :class="{ 'is-sorted': sortKey === 'status' }"
                    :aria-sort="getAriaSort('status')"
                    @click="toggleSort('status')"
                  >
                    <span class="th-sortable-inner">
                      Status <span class="sort-indicator">{{ getSortIcon('status') }}</span>
                    </span>
                  </th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="student in sortedStudents" :key="student.id">
                  <td class="col-name">{{ student.name }}</td>
                  <td>{{ student.school || '-' }}</td>
                  <td>{{ student.level || '-' }}</td>
                  <td>{{ student.parent_name || '-' }}</td>
                  <td>{{ student.parent_contact || '-' }}</td>
                  <td class="classes-enrolled-cell">
                    <template v-if="getClassesEnrolledList(student).length > 0">
                      <div class="class-tags">
                        <span
                          v-for="className in getClassesEnrolledList(student)"
                          :key="className"
                          class="class-tag"
                          :style="getClassTagStyle(className)"
                        >
                          {{ className }}
                        </span>
                      </div>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="col-fees">
                    <button
                      type="button"
                      class="fee-link"
                      :title="`View ${student.name}'s fee breakdown for ${currentMonthLabel}`"
                      @click="openFeeBreakdown(student)"
                    >
                      {{ formatCurrency(getStudentFeesThisMonth(student)) }}
                    </button>
                  </td>
                  <td>
                    <span :class="student.status === 'active' ? 'badge badge-success' : 'badge badge-danger'">
                      {{ student.status }}
                    </span>
                  </td>
                  <td class="col-actions">
                    <div class="row-actions">
                      <button @click="viewStudent(student)" class="btn btn-primary btn-sm">
                        View Details
                      </button>
                      <button @click="editStudent(student)" class="btn btn-secondary btn-sm">
                        Edit
                      </button>
                      <button @click="deleteStudent(student)" class="btn btn-danger btn-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PendingStudentsTable @approved="loadStudents" />

      <!-- Create/Edit Student Modal -->
      <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <h2>{{ showEditModal ? 'Edit Student' : 'Add New Student' }}</h2>
          <form @submit.prevent="saveStudent">
            <div class="form-group">
              <label>Student Name *</label>
              <input v-model="formData.name" required />
            </div>
            <div class="form-group">
              <label for="student-school">School</label>
              <SearchableSchoolSelect
                id="student-school"
                v-model="formData.school"
                placeholder="Search or select school"
              />
            </div>
            <div class="form-group">
              <label for="student-level">Level</label>
              <select id="student-level" v-model="formData.level" required>
                <option value="" disabled>Select level</option>
                <option v-for="lvl in studentLevels" :key="lvl" :value="lvl">{{ lvl }}</option>
                <option
                  v-if="formData.level && !studentLevels.includes(formData.level)"
                  :value="formData.level"
                >
                  {{ formData.level }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Parent Name *</label>
              <input v-model="formData.parent_name" required />
            </div>
            <div class="form-group">
              <label>Parent Contact *</label>
              <input v-model="formData.parent_contact" type="tel" required />
            </div>
            <div class="form-group">
              <label>Parent Email</label>
              <input v-model="formData.parent_email" type="email" />
            </div>
            <div class="form-group">
              <label>Status *</label>
              <select v-model="formData.status" required>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div v-if="error" class="error">{{ error }}</div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
              <button type="submit" class="btn btn-primary">
                {{ showEditModal ? 'Update' : 'Create' }}
              </button>
              <button type="button" @click="closeModal" class="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Student Detail Modal -->
      <div v-if="selectedStudent" class="modal-overlay" @click="selectedStudent = null">
        <div class="modal-content" @click.stop style="max-width: 600px;">
          <h2>{{ selectedStudent.name }} - Details</h2>
          
          <div style="margin-bottom: 20px;">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> {{ selectedStudent.name }}</p>
            <p><strong>School:</strong> {{ selectedStudent.school || '-' }}</p>
            <p><strong>Level:</strong> {{ selectedStudent.level || '-' }}</p>
            <p><strong>Parent Name:</strong> {{ selectedStudent.parent_name || '-' }}</p>
            <p><strong>Parent Contact:</strong> {{ selectedStudent.parent_contact || '-' }}</p>
            <p><strong>Parent Email:</strong> {{ selectedStudent.parent_email || '-' }}</p>
            <p>
              <strong>Status:</strong>
              <span :class="selectedStudent.status === 'active' ? 'badge badge-success' : 'badge badge-danger'">
                {{ selectedStudent.status }}
              </span>
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Enrolled Classes</h3>
            <div v-if="selectedStudent.enrolledClasses.length === 0">
              <p>Not enrolled in any classes.</p>
            </div>
            <table v-else class="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Join Date</th>
                  <th>Rate / Hour</th>
                  <th>Default Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="enrollment in selectedStudent.enrolledClasses" :key="enrollment.id">
                  <td>{{ enrollment.className }}</td>
                  <td>{{ formatDate(enrollment.join_date) }}</td>
                  <td>${{ enrollment.ratePerHour ?? enrollment.ratePerLesson ?? enrollment.monthlyFee ?? 0 }} / hour</td>
                  <td>{{ enrollment.defaultDurationHours ?? 2 }}h</td>
                  <td>
                    <button 
                      @click="unenrollStudent(selectedStudent.id, enrollment.id)" 
                      class="btn btn-danger btn-sm"
                    >
                      Unenroll
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Enroll in New Class</h3>
            <div class="form-group">
              <label>Select Class</label>
              <select v-model="newEnrollmentClassId">
                <option value="">-- Select a class --</option>
                <option 
                  v-for="classItem in availableClasses" 
                  :key="classItem.id" 
                  :value="classItem.id"
                >
                  {{ classItem.name }} (${{ classItem.rate_per_hour ?? classItem.ratePerHour ?? classItem.rate_per_lesson ?? classItem.monthly_fee ?? 0 }} / hour)
                </option>
              </select>
            </div>
            <button 
              @click="enrollStudent" 
              class="btn btn-primary"
              :disabled="!newEnrollmentClassId"
            >
              Enroll
            </button>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Hourly Rate Breakdown</h3>
            <div class="card" style="background: #f8f9fa;">
              <p><strong>Total Hourly Rate:</strong> ${{ Number(selectedStudent.totalRatePerLesson ?? selectedStudent.ratePerHourTotal ?? selectedStudent.monthlyFee ?? 0).toFixed(2) }} / hour</p>
              <ul style="margin-top: 10px; padding-left: 20px;">
                <li v-for="enrollment in selectedStudent.enrolledClasses" :key="enrollment.id">
                  {{ enrollment.className }}: ${{ enrollment.ratePerHour ?? enrollment.ratePerLesson ?? enrollment.monthlyFee ?? 0 }} / hour × {{ enrollment.defaultDurationHours ?? 2 }}h default
                </li>
              </ul>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button @click="selectedStudent = null" class="btn btn-secondary">Close</button>
            <button @click="deleteStudent(selectedStudent)" class="btn btn-danger">Delete student</button>
          </div>
        </div>
      </div>

      <!-- Fees This Month breakdown modal -->
      <div
        v-if="showFeeBreakdownModal && selectedFeeStudent"
        class="modal-overlay"
        @click="closeFeeBreakdown"
      >
        <div class="modal-content fee-modal" @click.stop>
          <div class="fee-modal-header">
            <h2>Fees This Month</h2>
            <p class="fee-modal-subtitle">
              {{ selectedFeeStudent.name }} — {{ currentMonthLabel }}
            </p>
          </div>

          <div v-if="feesLoading" class="loading">Loading fee breakdown...</div>
          <div v-else-if="selectedFeeBreakdown.length === 0" class="fee-empty">
            No lesson records found for this student this month.
          </div>
          <div v-else class="fee-breakdown-scroll">
            <div v-if="editingFeeRowError" class="error fee-edit-error">
              {{ editingFeeRowError }}
            </div>
            <table class="table fee-breakdown-table">
              <thead>
                <tr>
                  <th>Lesson Date</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th class="fee-col-rate">Rate / Hour</th>
                  <th class="fee-col-rate">Fee Charged</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in selectedFeeBreakdown"
                  :key="(item.attendanceId || item.className || '') + '-' + (item.lessonDate ? item.lessonDate.toISOString() : idx)"
                >
                  <td>{{ formatBreakdownDate(item.lessonDate) }}</td>
                  <td>{{ item.day }}</td>
                  <td>{{ item.time }}</td>
                  <td>
                    <div class="fee-class-cell">
                      <span>{{ item.className }}</span>
                      <span v-if="item.isMakeup" class="makeup-badge">Makeup</span>
                    </div>
                  </td>
                  <td>
                    <template v-if="editingFeeRowId === item.attendanceId">
                      <select v-model="editingFeeRowForm.status">
                        <option
                          v-for="option in attendanceStatusOptions"
                          :key="option"
                          :value="option"
                        >
                          {{ option }}
                        </option>
                      </select>
                    </template>
                    <template v-else>
                      <span :class="feeStatusBadgeClass(item.status)">{{ item.status }}</span>
                    </template>
                  </td>
                  <td>
                    <template v-if="editingFeeRowId === item.attendanceId">
                      <select v-model.number="editingFeeRowForm.durationHours">
                        <option
                          v-for="option in durationOptions"
                          :key="option"
                          :value="option"
                        >
                          {{ formatDurationLabel(option) }}
                        </option>
                      </select>
                    </template>
                    <template v-else>
                      {{ formatDurationLabel(item.durationHours) }}
                    </template>
                  </td>
                  <td class="fee-col-rate">{{ formatCurrency(item.ratePerHour) }}</td>
                  <td class="fee-col-rate">{{ formatCurrency(item.rateCharged) }}</td>
                  <td>
                    <template v-if="editingFeeRowId === item.attendanceId">
                      <div class="fee-edit-actions">
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          :disabled="editingFeeRowSaving"
                          @click="saveEditFeeRow(item)"
                        >
                          {{ editingFeeRowSaving ? 'Saving...' : 'Save' }}
                        </button>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          :disabled="editingFeeRowSaving"
                          @click="cancelEditFeeRow"
                        >
                          Cancel
                        </button>
                      </div>
                    </template>
                    <template v-else>
                      <div class="fee-edit-actions">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          :disabled="!item.attendanceId || editingFeeRowId !== null"
                          :title="item.attendanceId ? 'Edit attendance & duration' : 'Legacy record without an attendance ID'"
                          @click="startEditFeeRow(item)"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          :disabled="!item.attendanceId || editingFeeRowId !== null || editingFeeRowSaving"
                          :title="item.attendanceId ? 'Delete this lesson entry for the student' : 'Legacy record without an attendance ID'"
                          @click="deleteFeeRow(item)"
                        >
                          Delete
                        </button>
                      </div>
                    </template>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="fee-total-row">
                  <td colspan="7">Total</td>
                  <td class="fee-col-rate">{{ formatCurrency(selectedFeeTotal) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p
            v-if="relatedWhatsappStudents.length > 1"
            class="sibling-wa-note"
          >
            This WhatsApp message will include
            {{ relatedWhatsappStudents.length }} students under the same parent contact.
          </p>

          <div class="fee-modal-actions">
            <button
              type="button"
              class="btn btn-whatsapp"
              :disabled="!canSendWhatsappFees"
              :title="canSendWhatsappFees ? 'Open WhatsApp with this fee summary' : 'Parent contact number is required to send via WhatsApp.'"
              @click="sendFeesWhatsApp(selectedFeeStudent)"
            >
              Send to Parent via WhatsApp
            </button>
            <button type="button" class="btn btn-secondary" @click="closeFeeBreakdown">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { api } from '../api'
import { db, auth } from '../firebase'
import Navbar from '../components/Navbar.vue'
import SearchableSchoolSelect from '../components/SearchableSchoolSelect.vue'
import PendingStudentsTable from '../components/PendingStudentsTable.vue'
import { STUDENT_LEVELS } from '../constants/studentOptions'
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_OPTIONS,
  isChargeableAttendance,
  normalizeAttendanceStatus
} from '../constants/attendance'
import {
  DURATION_OPTIONS,
  getClassRatePerHour,
  getClassDefaultDuration,
  getAttendanceDuration,
  formatDurationLabel
} from '../constants/billing'

export default {
  name: 'StudentsView',
  components: {
    Navbar,
    SearchableSchoolSelect,
    PendingStudentsTable
  },
  setup() {
    const loading = ref(true)
    const students = ref([])
    const classes = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const selectedStudent = ref(null)
    const error = ref('')
    const formData = ref({
      name: '',
      school: '',
      level: '',
      parent_name: '',
      parent_contact: '',
      parent_email: '',
      status: 'active'
    })
    const editingId = ref(null)
    const newEnrollmentClassId = ref('')
    const availableClasses = ref([])

    const sortOptions = [
      { label: 'Name', value: 'name' },
      { label: 'School', value: 'school' },
      { label: 'Level', value: 'level' },
      { label: 'Parent Name', value: 'parent_name' },
      { label: 'Parent Contact', value: 'parent_contact' },
      { label: 'Classes Enrolled', value: 'classesEnrolled' },
      { label: 'Fees This Month', value: 'feesThisMonth' }
    ]

    // --- Fees This Month state ---
    const monthlyLessons = ref([])
    const monthlyAttendance = ref([])
    const feesLoading = ref(false)
    const showFeeBreakdownModal = ref(false)
    const selectedFeeStudent = ref(null)

    const parseLessonDate = (value) => {
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

    const pad2 = (n) => String(n).padStart(2, '0')

    const currencyFormatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0)

    const currentMonthLabel = computed(() =>
      new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
    )

    const loadMonthlyFees = async () => {
      feesLoading.value = true
      try {
        await auth.authStateReady?.()
        if (!auth.currentUser) {
          monthlyLessons.value = []
          monthlyAttendance.value = []
          return
        }

        const now = new Date()
        const y = now.getFullYear()
        const m = now.getMonth()
        const firstStr = `${y}-${pad2(m + 1)}-01`
        const lastStr = `${y}-${pad2(m + 1)}-${pad2(new Date(y, m + 1, 0).getDate())}`
        const todayEnd = new Date(y, m, now.getDate(), 23, 59, 59, 999)

        // Lessons collection uses snake_case `lesson_date` (string "YYYY-MM-DD").
        // Range query on a single field does not need a composite index.
        const lessonsQ = query(
          collection(db, 'lessons'),
          where('lesson_date', '>=', firstStr),
          where('lesson_date', '<=', lastStr)
        )
        const lessonsSnap = await getDocs(lessonsQ)
        const lessons = lessonsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((l) => {
            const d = parseLessonDate(l.lesson_date || l.lessonDate)
            return d && d <= todayEnd
          })
        monthlyLessons.value = lessons

        const lessonIds = lessons.map((l) => l.id)
        if (lessonIds.length === 0) {
          monthlyAttendance.value = []
          return
        }

        // Firestore `in` accepts up to 30 values per query, so we chunk.
        const chunks = []
        for (let i = 0; i < lessonIds.length; i += 30) {
          chunks.push(lessonIds.slice(i, i + 30))
        }
        const all = []
        for (const chunk of chunks) {
          const q2 = query(
            collection(db, 'attendance'),
            where('lesson_id', 'in', chunk)
          )
          const snap = await getDocs(q2)
          snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }))
        }
        monthlyAttendance.value = all
      } catch (err) {
        console.error('Error loading monthly fees:', err)
        monthlyLessons.value = []
        monthlyAttendance.value = []
      } finally {
        feesLoading.value = false
      }
    }

    // Build once per (lessons, attendance, classes) change: a per-student
    // object with { total, breakdown[] } covering the current month.
    const feesThisMonthByStudent = computed(() => {
      const lessonMap = {}
      for (const lesson of monthlyLessons.value) lessonMap[lesson.id] = lesson
      const classMap = {}
      for (const cls of classes.value) classMap[cls.id] = cls

      const result = {}
      for (const att of monthlyAttendance.value) {
        const studentId = att.student_id || att.studentId
        if (!studentId) continue
        const lesson = lessonMap[att.lesson_id || att.lessonId]
        if (!lesson) continue
        const classId = lesson.class_id || lesson.classId
        const cls = classId ? classMap[classId] : null
        const ratePerHour = getClassRatePerHour(cls)
        const durationHours = getAttendanceDuration(att, lesson, cls)
        const normalizedStatus = normalizeAttendanceStatus(att.status)
        const chargeable = isChargeableAttendance(att.status)
        const rateCharged = chargeable ? ratePerHour * durationHours : 0
        const isMakeup = Boolean(att.is_makeup ?? att.isMakeup)
        const lessonDate = parseLessonDate(lesson.lesson_date || lesson.lessonDate)
        const day = lessonDate
          ? lessonDate.toLocaleDateString('en-SG', { weekday: 'long' })
          : (cls?.day_of_week || '—')
        const startT = cls?.start_time || ''
        const endT = cls?.end_time || ''
        const time = startT && endT ? `${startT} - ${endT}` : (startT || '—')
        const entry = {
          attendanceId: att.id || null,
          lessonId: lesson.id,
          studentId,
          classId: classId || null,
          lessonDate,
          day,
          time,
          className: cls?.name || lesson.class_name || lesson.className || '—',
          subject: cls?.subject || lesson.subject || '',
          status: normalizedStatus,
          durationHours,
          ratePerHour,
          rateCharged,
          isMakeup
        }
        if (!result[studentId]) result[studentId] = { total: 0, breakdown: [] }
        result[studentId].total += rateCharged
        result[studentId].breakdown.push(entry)
      }
      for (const sid of Object.keys(result)) {
        result[sid].breakdown.sort((a, b) => {
          const ta = a.lessonDate ? a.lessonDate.getTime() : 0
          const tb = b.lessonDate ? b.lessonDate.getTime() : 0
          return ta - tb
        })
      }
      return result
    })

    const getStudentFeesThisMonth = (student) => {
      if (!student) return 0
      return feesThisMonthByStudent.value[student.id]?.total || 0
    }

    const getStudentFeeBreakdown = (student) => {
      if (!student) return []
      return feesThisMonthByStudent.value[student.id]?.breakdown || []
    }

    const openFeeBreakdown = (student) => {
      selectedFeeStudent.value = student
      showFeeBreakdownModal.value = true
    }

    const closeFeeBreakdown = () => {
      showFeeBreakdownModal.value = false
      selectedFeeStudent.value = null
    }

    const selectedFeeBreakdown = computed(() =>
      selectedFeeStudent.value ? getStudentFeeBreakdown(selectedFeeStudent.value) : []
    )

    const selectedFeeTotal = computed(() =>
      selectedFeeBreakdown.value.reduce((sum, item) => sum + (item.rateCharged || 0), 0)
    )

    // --- Inline attendance editing inside the fee breakdown popup ---
    const editingFeeRowId = ref(null)
    const editingFeeRowSaving = ref(false)
    const editingFeeRowError = ref('')
    const editingFeeRowForm = reactive({
      status: '',
      durationHours: 2
    })

    const startEditFeeRow = (item) => {
      if (!item?.attendanceId) {
        editingFeeRowError.value =
          'This row does not have an attendance record ID and cannot be edited.'
        return
      }
      editingFeeRowError.value = ''
      editingFeeRowId.value = item.attendanceId
      editingFeeRowForm.status =
        normalizeAttendanceStatus(item.status) || ATTENDANCE_STATUSES.PRESENT
      const dur = Number(item.durationHours)
      editingFeeRowForm.durationHours =
        Number.isFinite(dur) && dur > 0 ? dur : 2
    }

    const cancelEditFeeRow = () => {
      editingFeeRowId.value = null
      editingFeeRowError.value = ''
      editingFeeRowSaving.value = false
      editingFeeRowForm.status = ''
      editingFeeRowForm.durationHours = 2
    }

    const deleteFeeRow = async (item) => {
      editingFeeRowError.value = ''
      if (!item?.attendanceId) {
        editingFeeRowError.value =
          'Unable to delete this lesson because the attendance record ID is missing.'
        return
      }
      const studentName = selectedFeeStudent.value?.name || 'this student'
      const dateLabel = formatBreakdownDate(item.lessonDate) || 'this lesson'
      const ok = window.confirm(
        `Delete ${studentName}'s entry for ${dateLabel} (${item.className || 'lesson'})?\n\n` +
          'This removes only this student\'s attendance record for that lesson. ' +
          'Other students and the lesson itself are not affected.'
      )
      if (!ok) return

      editingFeeRowSaving.value = true
      try {
        await api.delete(`/api/attendance/${item.attendanceId}`)
        await loadMonthlyFees()
        cancelEditFeeRow()
      } catch (err) {
        console.error('Error deleting attendance record:', err)
        editingFeeRowError.value = err.message || 'Error deleting attendance record.'
      } finally {
        editingFeeRowSaving.value = false
      }
    }

    const saveEditFeeRow = async (item) => {
      editingFeeRowError.value = ''
      if (!item?.attendanceId) {
        editingFeeRowError.value =
          'Unable to update this lesson because the attendance record ID is missing.'
        return
      }
      if (!editingFeeRowForm.status) {
        editingFeeRowError.value = 'Please choose an attendance status.'
        return
      }
      const dur = Number(editingFeeRowForm.durationHours)
      if (!DURATION_OPTIONS.includes(dur)) {
        editingFeeRowError.value = 'Please choose a valid duration.'
        return
      }

      editingFeeRowSaving.value = true
      try {
        await api.put(`/api/attendance/${item.attendanceId}`, {
          status: editingFeeRowForm.status,
          duration_hours: dur
        })
        // Reload the underlying attendance/lessons so the breakdown,
        // monthly total, students table, and any sibling WhatsApp message
        // all use the updated record.
        await loadMonthlyFees()
        cancelEditFeeRow()
      } catch (err) {
        console.error('Error updating attendance record:', err)
        editingFeeRowError.value = err.message || 'Error updating attendance record.'
      } finally {
        editingFeeRowSaving.value = false
      }
    }

    const feeStatusBadgeClass = (status) => {
      const normalized = normalizeAttendanceStatus(status)
      switch (normalized) {
        case ATTENDANCE_STATUSES.PRESENT: return 'badge badge-success'
        case ATTENDANCE_STATUSES.LATE: return 'badge badge-warning'
        case ATTENDANCE_STATUSES.ABSENT_CHARGED: return 'badge badge-danger'
        case ATTENDANCE_STATUSES.ABSENT_VALID: return 'badge badge-muted'
        default: return 'badge'
      }
    }

    const formatBreakdownDate = (value) => {
      if (!value) return '—'
      const d = value instanceof Date ? value : parseLessonDate(value)
      if (!d) return '—'
      return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    // --- WhatsApp helpers for the fee modal ---
    const normalizeWhatsappPhone = (contact) => {
      if (!contact) return ''
      let digits = String(contact).replace(/\D/g, '')
      if (!digits) return ''
      // Already internationally prefixed.
      if (digits.startsWith('65') && digits.length >= 10) return digits
      // Local SG mobile/landline (8 digits) -> prefix 65.
      if (digits.length === 8) return `65${digits}`
      return digits
    }

    const formatWhatsappDate = (value) => {
      if (!value) return ''
      const d = value instanceof Date ? value : parseLessonDate(value)
      if (!d) return ''
      // e.g. "3 Apr 2026"
      const day = d.getDate()
      const month = d.toLocaleDateString('en-SG', { month: 'short' })
      const year = d.getFullYear()
      return `${day} ${month} ${year}`
    }

    const formatWhatsappTimePart = (timeStr) => {
      if (!timeStr) return ''
      const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/)
      if (!m) return timeStr
      let hours = Number(m[1])
      const minutes = m[2]
      const period = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12
      if (hours === 0) hours = 12
      return `${hours}:${minutes} ${period}`
    }

    const formatWhatsappTimeRange = (rangeStr) => {
      if (!rangeStr || rangeStr === '—') return ''
      const parts = String(rangeStr).split(/\s*-\s*/)
      if (parts.length === 2) {
        const start = formatWhatsappTimePart(parts[0])
        const end = formatWhatsappTimePart(parts[1])
        if (start && end) return `${start} - ${end}`
      }
      return formatWhatsappTimePart(rangeStr) || rangeStr
    }

    const formatWhatsappCurrency = (amount) => `$${Number(amount || 0).toFixed(2)}`

    // Derive a best-effort subject label from a class name string for use in
    // the WhatsApp fee message. Returns '' when no subject keyword is found
    // so callers can omit the brackets entirely.
    const SUBJECT_PATTERNS = [
      { pattern: /\bHigher\s+Chinese\b/i, subject: 'Higher Chinese' },
      { pattern: /\bSocial\s+Studies\b/i, subject: 'Social Studies' },
      { pattern: /\bA[\s-]?Math\b/i, subject: 'Amath' },
      { pattern: /\bE[\s-]?Math\b/i, subject: 'Emath' },
      { pattern: /\bAmath\b/i, subject: 'Amath' },
      { pattern: /\bEmath\b/i, subject: 'Emath' },
      { pattern: /\bMath(?:s|ematics)?\b/i, subject: 'Math' },
      { pattern: /\bScience\b/i, subject: 'Science' },
      { pattern: /\bChemistry\b/i, subject: 'Chemistry' },
      { pattern: /\bPhysics\b/i, subject: 'Physics' },
      { pattern: /\bBiology\b/i, subject: 'Biology' },
      { pattern: /\bEnglish\b/i, subject: 'English' },
      { pattern: /\bChinese\b/i, subject: 'Chinese' },
      { pattern: /\bPOA\b/i, subject: 'POA' },
      { pattern: /\bGeography\b/i, subject: 'Geography' },
      { pattern: /\bHistory\b/i, subject: 'History' },
      { pattern: /\bLiterature\b/i, subject: 'Literature' }
    ]

    const extractSubjectFromClassName = (className = '') => {
      const name = String(className || '').trim()
      if (!name) return ''
      const matched = SUBJECT_PATTERNS.find((item) => item.pattern.test(name))
      return matched ? matched.subject : ''
    }

    // "Remus" -> "Remus'",  "Aiden" -> "Aiden's"
    const getPossessiveName = (name) => {
      const cleanName = String(name || '').trim()
      if (!cleanName) return "your child's"
      return cleanName.toLowerCase().endsWith('s')
        ? `${cleanName}'`
        : `${cleanName}'s`
    }

    // Join unique charged-session subjects into "A", "A and B", or "A, B and C".
    const getWhatsappSubjectsText = (breakdown) => {
      const chargedBreakdown = (breakdown || []).filter(
        (item) => Number(item.rateCharged || 0) > 0
      )
      const subjects = chargedBreakdown
        .map((item) => item.subject || extractSubjectFromClassName(item.className))
        .filter(Boolean)
      const unique = [...new Set(subjects)]
      if (unique.length === 0) return ''
      if (unique.length === 1) return unique[0]
      if (unique.length === 2) return `${unique[0]} and ${unique[1]}`
      return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
    }

    // --- Per-student helpers used for combined sibling messages ---
    const getChargedBreakdownForStudent = (student) =>
      getStudentFeeBreakdown(student).filter(
        (item) => Number(item.rateCharged || 0) > 0
      )

    const getStudentSubjectSummary = (student) =>
      getWhatsappSubjectsText(getChargedBreakdownForStudent(student))

    const getStudentLessonLines = (student) => {
      const charged = getChargedBreakdownForStudent(student)
      if (!charged.length) {
        return 'No charged lesson records found for this month.'
      }
      return charged
        .map((item) => {
          const dateLabel = formatWhatsappDate(item.lessonDate) || '—'
          const timeLabel = formatWhatsappTimeRange(item.time) || '—'
          const subject =
            item.subject || extractSubjectFromClassName(item.className)
          const suffixParts = []
          if (subject) suffixParts.push(subject)
          if (item.isMakeup) suffixParts.push('Makeup')
          return suffixParts.length
            ? `${dateLabel}, ${timeLabel} (${suffixParts.join(', ')})`
            : `${dateLabel}, ${timeLabel}`
        })
        .join('\n')
    }

    // Find all students (including the passed-in one) whose normalized parent
    // contact matches the selected student's. Selected student is placed first
    // so the resulting message lists them at the top.
    const getStudentsWithSameParentContact = (selected) => {
      if (!selected) return []
      const selectedPhone = normalizeWhatsappPhone(
        selected.parent_contact || selected.parentContact
      )
      if (!selectedPhone) return [selected]

      const matches = students.value.filter((s) => {
        const phone = normalizeWhatsappPhone(s.parent_contact || s.parentContact)
        return phone && phone === selectedPhone
      })

      const inSelectedFirst = [
        ...matches.filter((s) => s.id === selected.id),
        ...matches.filter((s) => s.id !== selected.id)
      ]
      // Guarantee the selected student is included even if somehow filtered out.
      return inSelectedFirst.length ? inSelectedFirst : [selected]
    }

    const relatedWhatsappStudents = computed(() =>
      selectedFeeStudent.value
        ? getStudentsWithSameParentContact(selectedFeeStudent.value)
        : []
    )

    const getWhatsappFeeMessage = (student) => {
      const parentName =
        student?.parent_name || student?.parentName || 'Parent'
      const month = currentMonthLabel.value
      const related = getStudentsWithSameParentContact(student)

      // Single-student message (no matched siblings, or no contact match).
      if (related.length <= 1) {
        const only = related[0] || student
        const subjectsText = getStudentSubjectSummary(only)
        const possessive = getPossessiveName(only?.name)
        const tuitionText = subjectsText
          ? `${possessive} ${subjectsText} tuition`
          : `${possessive} tuition`
        const studentName = only?.name || 'Student'
        const studentTotal = getStudentFeesThisMonth(only)

        return (
          `Hi ${parentName}, this is the fees for ${tuitionText} for the month of ${month}.\n\n` +
          `Lesson dates and timings:\n${getStudentLessonLines(only)}\n\n` +
          `Total for ${studentName}: ${formatWhatsappCurrency(studentTotal)}\n\n` +
          `Please check and let us know if there are any errors. Thank you!`
        )
      }

      // Combined message for multiple students sharing the same parent contact.
      const sections = related
        .map((child) => {
          const subjectsText = getStudentSubjectSummary(child)
          const childName = child.name || 'Student'
          const header = subjectsText
            ? `${childName} — ${subjectsText}`
            : `${childName} — Tuition`
          const childTotal = getStudentFeesThisMonth(child)
          return (
            `${header}\n` +
            `Lesson dates and timings:\n${getStudentLessonLines(child)}\n` +
            `Total for ${childName}: ${formatWhatsappCurrency(childTotal)}`
          )
        })
        .join('\n\n')

      const combinedTotal = related.reduce(
        (sum, child) => sum + (getStudentFeesThisMonth(child) || 0),
        0
      )

      return (
        `Hi ${parentName}, this is the fees for your children's tuition for the month of ${month}.\n\n` +
        `${sections}\n\n` +
        `Total bill: ${formatWhatsappCurrency(combinedTotal)}\n\n` +
        `Please check and let us know if there are any errors. Thank you!`
      )
    }

    const canSendWhatsappFees = computed(() => {
      const s = selectedFeeStudent.value
      if (!s) return false
      return !!normalizeWhatsappPhone(s.parent_contact || s.parentContact)
    })

    const sendFeesWhatsApp = (student) => {
      if (!student) return
      const phone = normalizeWhatsappPhone(student.parent_contact || student.parentContact)
      if (!phone) {
        alert('This student does not have a parent contact number.')
        return
      }
      const message = getWhatsappFeeMessage(student)
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener')
      }
    }

    const LEVEL_ORDER = {
      'Pri 1': 1,
      'Pri 2': 2,
      'Pri 3': 3,
      'Pri 4': 4,
      'Pri 5': 5,
      'Pri 6': 6,
      'Sec 1': 7,
      'Sec 2': 8,
      'Sec 3': 9,
      'Sec 4': 10,
      'Sec 5': 11
    }

    const sortKey = ref('name')
    const sortDirection = ref('asc')

    const toggleSort = (key) => {
      if (sortKey.value === key) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      } else {
        sortKey.value = key
        sortDirection.value = 'asc'
      }
    }

    const toggleSortDirection = () => {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    }

    const getSortIcon = (key) => {
      if (sortKey.value !== key) return ''
      return sortDirection.value === 'asc' ? '↑' : '↓'
    }

    const getAriaSort = (key) => {
      if (sortKey.value !== key) return 'none'
      return sortDirection.value === 'asc' ? 'ascending' : 'descending'
    }

    const getClassesEnrolledList = (student) => {
      const enrolled = student?.enrolledClasses
      if (Array.isArray(enrolled) && enrolled.length > 0) {
        return enrolled
          .map((c) => (c && c.className ? c.className : ''))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))
      }
      return []
    }

    const getClassesEnrolled = (student) => {
      const names = getClassesEnrolledList(student)
      return names.length > 0 ? names.join(', ') : '—'
    }

    const CLASS_TAG_THEMES = [
      { background: '#EEF2FF', color: '#3730A3' },
      { background: '#E0F2FE', color: '#075985' },
      { background: '#DCFCE7', color: '#166534' },
      { background: '#FEF3C7', color: '#92400E' },
      { background: '#FCE7F3', color: '#9D174D' },
      { background: '#F3E8FF', color: '#6B21A8' },
      { background: '#CCFBF1', color: '#115E59' },
      { background: '#FFE4E6', color: '#9F1239' },
      { background: '#EDE9FE', color: '#5B21B6' },
      { background: '#ECFCCB', color: '#3F6212' },
      { background: '#FFEDD5', color: '#9A3412' },
      { background: '#DBEAFE', color: '#1E40AF' }
    ]

    const DEFAULT_CLASS_TAG_THEME = { background: '#F1F5F9', color: '#334155' }

    const uniqueClassNames = computed(() => {
      const names = new Set()
      for (const student of students.value) {
        for (const name of getClassesEnrolledList(student)) {
          if (name) names.add(name)
        }
      }
      return Array.from(names).sort((a, b) => a.localeCompare(b))
    })

    const classNameToTheme = computed(() => {
      const map = {}
      uniqueClassNames.value.forEach((className, index) => {
        map[className] = CLASS_TAG_THEMES[index % CLASS_TAG_THEMES.length]
      })
      return map
    })

    const getClassTagStyle = (className) =>
      classNameToTheme.value[className] || DEFAULT_CLASS_TAG_THEME

    const getSortValue = (student, key) => {
      if (key === 'classesEnrolled') return getClassesEnrolled(student)
      if (key === 'feesThisMonth') return getStudentFeesThisMonth(student)
      if (key === 'level') {
        const lvl = student.level
        if (lvl && Object.prototype.hasOwnProperty.call(LEVEL_ORDER, lvl)) {
          return LEVEL_ORDER[lvl]
        }
        return lvl ? 999 : ''
      }
      return student[key] ?? ''
    }

    const sortedStudents = computed(() => {
      const list = [...students.value]
      if (!sortKey.value) return list

      return list.sort((a, b) => {
        const valueA = getSortValue(a, sortKey.value)
        const valueB = getSortValue(b, sortKey.value)

        const emptyA =
          valueA === null || valueA === undefined || valueA === '' || valueA === '—'
        const emptyB =
          valueB === null || valueB === undefined || valueB === '' || valueB === '—'

        if (emptyA && !emptyB) return sortDirection.value === 'asc' ? 1 : -1
        if (!emptyA && emptyB) return sortDirection.value === 'asc' ? -1 : 1
        if (emptyA && emptyB) return 0

        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDirection.value === 'asc' ? valueA - valueB : valueB - valueA
        }

        const cmp = String(valueA).localeCompare(String(valueB), undefined, {
          sensitivity: 'base',
          numeric: true
        })
        return sortDirection.value === 'asc' ? cmp : -cmp
      })
    })

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const handleApiError = (err, resource) => {
      if (err?.status === 401) {
        error.value = 'Session expired. Please log in again.'
        return
      }
      console.error(`Error loading ${resource}:`, err)
      error.value = err?.message || `Error loading ${resource}`
    }

    const loadStudents = async () => {
      try {
        const list = await api.get('/api/students')
        students.value = (list || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      } catch (err) {
        handleApiError(err, 'students')
      } finally {
        loading.value = false
      }
    }

    const loadClasses = async () => {
      try {
        const list = await api.get('/api/classes')
        classes.value = list || []
      } catch (err) {
        handleApiError(err, 'classes')
      }
    }

    const editStudent = (student) => {
      editingId.value = student.id
      formData.value = {
        name: student.name,
        school: student.school || '',
        level: student.level || '',
        parent_name: student.parent_name || '',
        parent_contact: student.parent_contact || '',
        parent_email: student.parent_email || '',
        status: student.status || 'active'
      }
      showEditModal.value = true
    }

    const viewStudent = async (student) => {
      try {
        const data = await api.get(`/api/students/${student.id}`)
        if (data) {
          selectedStudent.value = data
          const enrolledClassIds = (data.enrolledClasses || []).map(e => {
            const c = classes.value.find(cl => cl.name === e.className)
            return c?.id
          }).filter(Boolean)
          availableClasses.value = classes.value.filter(c => c.active && !enrolledClassIds.includes(c.id))
        }
      } catch (err) {
        console.error('Error loading student:', err)
      }
    }

    const enrollStudent = async () => {
      if (!selectedStudent.value || !newEnrollmentClassId.value) return
      try {
        await api.post('/api/enrolments', { student_id: selectedStudent.value.id, class_id: newEnrollmentClassId.value })
        newEnrollmentClassId.value = ''
        await loadStudents()
        await viewStudent(selectedStudent.value)
      } catch (err) {
        console.error('Error enrolling student:', err)
        error.value = 'Error enrolling student'
      }
    }

    const unenrollStudent = async (studentId, enrollmentId) => {
      if (!confirm('Are you sure you want to unenroll this student from this class?')) return
      try {
        await api.put(`/api/enrolments/${enrollmentId}`, { status: 'inactive' })
        await loadStudents()
        if (selectedStudent.value) await viewStudent(selectedStudent.value)
      } catch (err) {
        console.error('Error unenrolling student:', err)
        error.value = 'Error unenrolling student'
      }
    }

    const deleteStudent = async (student) => {
      if (!confirm(`Permanently delete student "${student.name}"? This will also delete all their enrolments and attendance records. This cannot be undone.`)) return
      try {
        await api.delete(`/api/students/${student.id}`)
        if (selectedStudent.value?.id === student.id) selectedStudent.value = null
        await loadStudents()
      } catch (err) {
        console.error('Error deleting student:', err)
        error.value = err.message || 'Error deleting student'
        alert(err.message || 'Error deleting student')
      }
    }

    const saveStudent = async () => {
      error.value = ''
      try {
        if (showEditModal.value && editingId.value) {
          await api.put(`/api/students/${editingId.value}`, formData.value)
        } else {
          await api.post('/api/students', formData.value)
        }
        closeModal()
        await loadStudents()
      } catch (err) {
        error.value = err.message || 'Error saving student'
      }
    }

    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      editingId.value = null
      formData.value = {
        name: '',
        school: '',
        level: '',
        parent_name: '',
        parent_contact: '',
        parent_email: '',
        status: 'active'
      }
      error.value = ''
    }

    onMounted(async () => {
      await loadClasses()
      await loadStudents()
      loadMonthlyFees()
    })

    return {
      loading,
      students,
      classes,
      showCreateModal,
      showEditModal,
      selectedStudent,
      formData,
      error,
      editingId,
      newEnrollmentClassId,
      availableClasses,
      studentLevels: STUDENT_LEVELS,
      sortKey,
      sortDirection,
      sortOptions,
      sortedStudents,
      toggleSort,
      toggleSortDirection,
      getSortIcon,
      getAriaSort,
      getClassesEnrolled,
      getClassesEnrolledList,
      getClassTagStyle,
      formatDate,
      editStudent,
      viewStudent,
      enrollStudent,
      unenrollStudent,
      deleteStudent,
      saveStudent,
      closeModal,
      loadStudents,
      loadClasses,
      feesLoading,
      showFeeBreakdownModal,
      selectedFeeStudent,
      selectedFeeBreakdown,
      selectedFeeTotal,
      currentMonthLabel,
      formatCurrency,
      getStudentFeesThisMonth,
      openFeeBreakdown,
      closeFeeBreakdown,
      feeStatusBadgeClass,
      formatBreakdownDate,
      loadMonthlyFees,
      canSendWhatsappFees,
      sendFeesWhatsApp,
      relatedWhatsappStudents,
      formatDurationLabel,
      editingFeeRowId,
      editingFeeRowForm,
      editingFeeRowSaving,
      editingFeeRowError,
      startEditFeeRow,
      cancelEditFeeRow,
      saveEditFeeRow,
      deleteFeeRow,
      attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
      durationOptions: DURATION_OPTIONS
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 20px;
}

.modal-content h3 {
  margin-top: 20px;
  margin-bottom: 10px;
  font-size: 16px;
}

.student-toolbar-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sort-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 12px;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-sm);
}

.sort-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted, #64748b);
  white-space: nowrap;
}

.sort-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 6px 28px 6px 10px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-family: inherit;
  color: var(--color-text, #1e293b);
  background-color: var(--color-surface, #ffffff);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path d='M5.25 7.5 10 12.25 14.75 7.5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px 12px;
  cursor: pointer;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.sort-select:focus {
  outline: none;
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px var(--color-primary-light, #eef2ff);
}

.sort-direction-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-primary, #4f46e5);
  background: var(--color-primary-light, #eef2ff);
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--transition), color var(--transition), border-color var(--transition);
}

.sort-direction-btn:hover {
  background: var(--color-primary, #4f46e5);
  color: #ffffff;
}

.sort-direction-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-light, #eef2ff);
  border-color: var(--color-primary, #4f46e5);
}

@media (max-width: 640px) {
  .student-toolbar-right {
    width: 100%;
    justify-content: flex-start;
  }

  .sort-controls {
    flex: 1 1 auto;
    min-width: 0;
  }

  .sort-select {
    flex: 1 1 auto;
    min-width: 0;
  }

  .add-student-btn {
    width: 100%;
  }
}

.students-table-card {
  padding: 0;
  overflow: hidden;
}

.students-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.students-table {
  min-width: 1250px;
  width: 100%;
  margin: 0;
}

.students-table :deep(thead th),
.students-table :deep(tbody td) {
  vertical-align: middle;
}

.students-table :deep(.col-name) {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--color-surface, #ffffff);
  box-shadow: 1px 0 0 0 var(--color-border, #e2e8f0);
  min-width: 180px;
}

.students-table :deep(thead .col-name) {
  z-index: 3;
  background: var(--color-background, #f8fafc);
}

.students-table :deep(.col-actions) {
  position: sticky;
  right: 0;
  z-index: 2;
  background: var(--color-surface, #ffffff);
  box-shadow: -1px 0 0 0 var(--color-border, #e2e8f0);
  min-width: 220px;
}

.students-table :deep(thead .col-actions) {
  z-index: 3;
  background: var(--color-background, #f8fafc);
}

.students-table :deep(tbody tr:hover .col-name),
.students-table :deep(tbody tr:hover .col-actions) {
  background: var(--color-primary-light, #eef2ff);
}

.th-sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.th-sortable:hover {
  background-color: var(--color-primary-light, #eef2ff);
  color: var(--color-primary, #4f46e5);
}

.th-sortable.is-sorted {
  color: var(--color-primary, #4f46e5);
}

.th-sortable-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sort-indicator {
  display: inline-block;
  width: 0.9em;
  text-align: center;
  font-size: 0.85em;
  color: inherit;
  opacity: 0.9;
}

.classes-enrolled-cell {
  min-width: 200px;
  max-width: 280px;
}

.class-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.class-tag {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

@media (max-width: 640px) {
  .students-table :deep(.col-name) {
    min-width: 140px;
  }
  .students-table :deep(.col-actions) {
    min-width: 180px;
  }
  .row-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .row-actions .btn {
    width: 100%;
  }
}

.students-table :deep(.col-fees) {
  min-width: 150px;
  white-space: nowrap;
}

.fee-link {
  appearance: none;
  background: transparent;
  border: none;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 6px;
  font: inherit;
  font-weight: 600;
  color: var(--color-primary, #4f46e5);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.fee-link:hover {
  background-color: var(--color-primary-light, #eef2ff);
  text-decoration: underline;
}

.fee-link:focus-visible {
  outline: 2px solid var(--color-primary, #4f46e5);
  outline-offset: 2px;
}

.fee-modal {
  max-width: 880px;
  width: min(96vw, 880px);
  padding: 24px;
}

.fee-modal-header {
  margin-bottom: 16px;
}

.fee-modal-header h2 {
  margin-bottom: 4px;
}

.fee-modal-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted, #64748b);
}

.fee-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted, #64748b);
  background: var(--color-background, #f8fafc);
  border-radius: 8px;
}

.fee-breakdown-scroll {
  overflow-x: auto;
  margin: 0 -4px;
}

.fee-breakdown-table {
  width: 100%;
  min-width: 820px;
}

.fee-class-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.makeup-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #9a3412;
  background: #ffedd5;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.fee-breakdown-table th,
.fee-breakdown-table td {
  vertical-align: middle;
}

.fee-col-rate {
  text-align: right;
  white-space: nowrap;
}

.fee-total-row td {
  font-weight: 700;
  background: var(--color-background, #f8fafc);
  border-top: 2px solid var(--color-border, #e2e8f0);
}

.fee-total-row td:first-child {
  text-align: right;
}

.fee-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fee-edit-error {
  margin: 0 0 10px;
  padding: 8px 10px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 6px;
  font-size: 13px;
}

.fee-breakdown-table select {
  min-width: 140px;
}

.sibling-wa-note {
  margin: 14px 0 0;
  padding: 10px 12px;
  font-size: 0.8125rem;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.fee-modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.btn-whatsapp {
  background-color: #25D366;
  color: #ffffff;
  border: 1px solid #1fae52;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.btn-whatsapp:hover:not(:disabled) {
  background-color: #1fae52;
  border-color: #168a40;
}

.btn-whatsapp:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.badge-muted {
  background: #e2e8f0;
  color: #334155;
}
</style>
