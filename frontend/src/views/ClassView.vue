<template>
  <div>
    <Navbar />
    <div class="container">
      <div v-if="loading" class="loading">Loading class details...</div>
      <div v-else-if="!classData" class="error">Class not found</div>
      <div v-else>
        <div style="margin-bottom: 20px;">
          <router-link to="/classes" class="btn btn-secondary">← Back to Classes</router-link>
        </div>

        <div class="card">
          <h1>{{ classData.name }}</h1>
          <p><strong>Subject:</strong> {{ classData.subject }} - {{ classData.level }}</p>
          <p><strong>Schedule:</strong> {{ formatSchedule(classData) }}</p>
          <p><strong>Teacher:</strong> {{ classData.teacherName }}</p>
          <p><strong>Rate Per Hour:</strong> ${{ classData.rate_per_hour ?? classData.ratePerHour ?? classData.rate_per_lesson ?? classData.monthly_fee ?? 0 }} / hour</p>
          <p><strong>Default Lesson Duration:</strong> {{ classData.default_duration_hours ?? classData.defaultDurationHours ?? 2 }}h</p>
          <p>
            <strong>Status:</strong>
            <span :class="classData.active ? 'badge badge-success' : 'badge badge-danger'">
              {{ classData.active ? 'Active' : 'Inactive' }}
            </span>
          </p>
        </div>

        <div class="grid grid-2">
          <div class="card class-students-card">
            <div class="class-students-header">
              <h2>Students in this Class</h2>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="openAddStudentsModal"
              >
                Add Student to Class
              </button>
            </div>
            <div v-if="activeEnrolledRows.length === 0" class="class-students-empty">
              <p>No students enrolled yet. Use the button above to add students.</p>
            </div>
            <div v-else class="table-wrapper">
              <table class="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Level</th>
                    <th>School</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in activeEnrolledRows"
                    :key="row.enrolmentId + '-' + row.studentId"
                  >
                    <td>{{ row.name }}</td>
                    <td>{{ row.level || '—' }}</td>
                    <td>{{ row.school || '—' }}</td>
                    <td>
                      <span
                        :class="getStudentStatusClass({ status: row.student_status, active: row.student_active })"
                      >
                        {{ getStudentStatusLabel({ status: row.student_status, active: row.student_active }) }}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        :disabled="enrolmentActionId === row.enrolmentId"
                        @click="removeStudentFromClass(row)"
                      >
                        {{ enrolmentActionId === row.enrolmentId ? '…' : 'Remove from Class' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h2>Quick Actions</h2>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <a :href="lessonSubmissionUrl" target="_blank" class="btn btn-primary">
                Lesson Submission Link
              </a>
              <button @click="copyLink" class="btn btn-secondary">
                Copy Submission Link
              </button>
            </div>
            <p style="margin-top: 15px; font-size: 12px; color: #666;">
              Share this link with teachers to submit lessons for this class.
            </p>
          </div>
        </div>

        <div class="card">
          <h2>Lesson Records</h2>
          <div v-if="lessonsLoading" class="loading">Loading lessons...</div>
          <div v-else-if="lessons.length === 0" class="loading">
            No lessons recorded yet.
          </div>
          <div v-else>
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Teacher</th>
                  <th>Description / remark</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lesson in lessons" :key="lesson.id">
                  <td>{{ formatDate(lesson.lesson_date) }}</td>
                  <td>{{ lesson.teacherName }}</td>
                  <td>
                    <span v-if="isMissedLesson(lesson)">{{ lesson.remark || lesson.remarks || '—' }}</span>
                    <span v-else>{{ lesson.description || 'No description' }}</span>
                  </td>
                  <td>
                    <span
                      v-if="isMissedLesson(lesson)"
                      class="badge"
                      style="background:#ffedd5;color:#9a3412;font-weight:600;"
                    >Missed</span>
                    <span v-else class="badge badge-success">Conducted</span>
                  </td>
                  <td>
                    <span v-if="isMissedLesson(lesson)">Missed (no charge)</span>
                    <template v-else>
                      {{ getPresentCount(lesson.attendance) }} / {{ getTotalCount(lesson.attendance) }}
                    </template>
                  </td>
                  <td>
                    <div class="lesson-row-actions">
                      <button @click="viewLesson(lesson)" class="btn btn-primary btn-sm">
                        View Details
                      </button>
                      <button @click="openEditLessonRecord(lesson)" class="btn btn-secondary btn-sm">
                        Edit
                      </button>
                      <button
                        @click="deleteLessonRecord(lesson)"
                        class="btn btn-danger btn-sm"
                        :disabled="deletingLessonId === lesson.id"
                      >
                        {{ deletingLessonId === lesson.id ? 'Deleting...' : 'Delete' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Lesson Detail Modal -->
      <div v-if="selectedLesson" class="modal-overlay" @click="selectedLesson = null">
        <div class="modal-content" @click.stop>
          <h2>Lesson Details - {{ formatDate(selectedLesson.lesson_date) }}</h2>
          <div style="margin-bottom: 15px;">
            <strong>Teacher:</strong> {{ selectedLesson.teacherName }}
          </div>
          <div style="margin-bottom: 15px;">
            <strong>Lesson timing:</strong>
            {{ formatLessonRecordTiming(selectedLesson) }}
          </div>
          <div v-if="isMissedLesson(selectedLesson)" style="margin-bottom: 15px;">
            <strong>Remark:</strong>
            <p>{{ selectedLesson.remark || selectedLesson.remarks || '—' }}</p>
          </div>
          <div v-else style="margin-bottom: 15px;">
            <strong>Description:</strong>
            <p>{{ selectedLesson.description || 'No description' }}</p>
          </div>
          <div v-if="!isMissedLesson(selectedLesson)" style="margin-bottom: 15px;">
            <strong>Homework:</strong>
            <p>{{ selectedLesson.homework || 'No homework assigned' }}</p>
          </div>
          <div
            v-if="!isMissedLesson(selectedLesson) && selectedLesson.materials_link"
            style="margin-bottom: 15px;"
          >
            <strong>Materials:</strong>
            <a :href="selectedLesson.materials_link" target="_blank">{{ selectedLesson.materials_link }}</a>
          </div>
          <div v-if="!isMissedLesson(selectedLesson)" style="margin-bottom: 15px;">
            <strong>Attendance:</strong>
            <table class="table" style="margin-top: 10px;">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="att in selectedLesson.attendance" :key="att.student_id">
                  <td>{{ getStudentName(att.student_id) }}</td>
                  <td>
                    <span :class="getStatusBadgeClass(att.status)">
                      {{ normalizeStatus(att.status) }}
                    </span>
                  </td>
                  <td>{{ att.remark || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="class-lesson-missed-hint" style="margin-bottom: 15px;">
            Students are marked <strong>Missed</strong> with no charge for this session.
          </p>
          <button @click="selectedLesson = null" class="btn btn-secondary">Close</button>
        </div>
      </div>

      <!-- Edit Lesson Record Modal -->
      <div
        v-if="showEditLessonModal"
        class="modal-overlay"
        @click.self="closeEditLessonRecord"
      >
        <div class="modal-content edit-lesson-modal" @click.stop>
          <div class="edit-lesson-header">
            <h2>Edit Lesson Record</h2>
            <button
              type="button"
              class="edit-lesson-close"
              @click="closeEditLessonRecord"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <section class="edit-lesson-section">
            <h3>Lesson Details</h3>
            <div class="edit-lesson-grid">
              <div class="form-group">
                <label>Lesson Date *</label>
                <input type="date" v-model="editLessonForm.lessonDate" required />
              </div>
              <div class="form-group">
                <label>Start Time *</label>
                <input type="time" v-model="editLessonForm.startTime" required />
              </div>
              <div class="form-group">
                <label>End Time *</label>
                <input type="time" v-model="editLessonForm.endTime" required />
              </div>
            </div>

            <div v-if="editingIsMissed" class="form-group">
              <label>Remark / Reason *</label>
              <textarea
                v-model="editLessonForm.remark"
                rows="3"
                placeholder="e.g. Teacher sick, public holiday, class cancelled, student unable to attend"
                required
              ></textarea>
            </div>
            <template v-else>
            <div class="form-group">
              <label>Description</label>
              <textarea
                v-model="editLessonForm.description"
                rows="2"
                placeholder="What was covered in this lesson?"
              ></textarea>
            </div>
            <div class="form-group">
              <label>Homework</label>
              <textarea
                v-model="editLessonForm.homework"
                rows="2"
                placeholder="Homework assigned to students"
              ></textarea>
            </div>
            <div class="form-group">
              <label>Materials Link</label>
              <input
                v-model="editLessonForm.materialsLink"
                type="url"
                placeholder="https://..."
              />
            </div>
            </template>
          </section>

          <section v-if="!editingIsMissed" class="edit-lesson-section">
            <div class="edit-lesson-section-header">
              <h3>Student Attendance</h3>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="openMakeupSearch"
              >
                + Add Makeup Student
              </button>
            </div>
            <div v-if="visibleAttendanceRows.length === 0" class="edit-lesson-empty">
              No students in this lesson. Add a makeup student above.
            </div>
            <div v-else class="edit-lesson-table-scroll">
              <table class="table edit-lesson-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Type</th>
                    <th>Attendance</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in visibleAttendanceRows"
                    :key="row.key"
                  >
                    <td>
                      <div class="edit-lesson-student-cell">
                        <span>{{ row.studentName || 'Unknown' }}</span>
                        <span v-if="row.isNew" class="edit-lesson-new-tag">NEW</span>
                      </div>
                      <div v-if="row.isMakeup && row.meta" class="edit-lesson-student-meta">
                        {{ row.meta }}
                      </div>
                    </td>
                    <td>
                      <span v-if="row.isMakeup" class="makeup-badge">Makeup</span>
                      <span v-else class="regular-badge">Regular</span>
                    </td>
                    <td>
                      <select v-model="row.status" required>
                        <option
                          v-for="option in attendanceStatusOptions"
                          :key="option"
                          :value="option"
                        >
                          {{ option }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <select v-model.number="row.durationHours" required>
                        <option
                          v-for="option in durationOptions"
                          :key="option"
                          :value="option"
                        >
                          {{ formatDurationLabel(option) }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <button
                        v-if="row.isMakeup"
                        type="button"
                        class="btn btn-danger btn-sm"
                        @click="removeMakeupStudentFromEditedLesson(row)"
                      >
                        Remove
                      </button>
                      <span v-else class="edit-lesson-muted">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div v-if="editLessonError" class="error edit-lesson-error">{{ editLessonError }}</div>
          <div v-if="editLessonSuccess" class="success edit-lesson-success">Lesson record updated successfully.</div>

          <div class="edit-lesson-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="closeEditLessonRecord"
              :disabled="editLessonSaving"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="saveEditedLessonRecord"
              :disabled="editLessonSaving"
            >
              {{ editLessonSaving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Add students to class (enrolment) -->
      <div
        v-if="showAddStudentsModal"
        class="modal-overlay"
        @click.self="closeAddStudentsModal"
      >
        <div class="modal-content class-add-students-modal" @click.stop>
          <h2>Add students to this class</h2>
          <p class="add-students-hint">
            Search by name, level, school, or parent contact. Only students not
            already enrolled in this class are shown. Select one or more, then
            confirm.
          </p>
          <ClassStudentSearch
            :students="studentsAvailableForEnrolmentPicker"
            :disabled-ids="[]"
            @select="onStageStudentForClass"
          />
          <div
            v-if="stagedAddStudents.length"
            class="staged-enrol-row"
          >
            <span class="staged-label">To add</span>
            <div class="staged-chips">
              <span
                v-for="s in stagedAddStudents"
                :key="s.id"
                class="staged-chip"
              >
                {{ s.name }}
                <button
                  type="button"
                  class="staged-chip-remove"
                  :title="'Remove ' + s.name"
                  @click="unstageStudentForClass(s.id)"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
          <div v-else class="add-students-empty">
            No students selected yet. Use the search above.
          </div>
          <div class="add-students-actions">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="enrolmentBulkSaving"
              @click="closeAddStudentsModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!stagedAddStudents.length || enrolmentBulkSaving"
              @click="commitAddStudentsToClass"
            >
              {{ enrolmentBulkSaving ? 'Adding…' : 'Confirm add' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Makeup Student Search Modal -->
      <div
        v-if="showMakeupSearchModal"
        class="modal-overlay"
        style="z-index: 1100;"
        @click.self="closeMakeupSearch"
      >
        <div class="modal-content makeup-search-modal" @click.stop>
          <div class="edit-lesson-header">
            <h3>Add Makeup Student</h3>
            <button
              type="button"
              class="edit-lesson-close"
              @click="closeMakeupSearch"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <p class="makeup-search-hint">
            Search any student by name, level, school, or parent contact. They will
            only be added to this lesson — no permanent enrolment change.
          </p>
          <input
            v-model="makeupSearch"
            type="text"
            placeholder="Search student..."
            class="makeup-search-input"
          />
          <div v-if="makeupLoading" class="edit-lesson-empty">Loading students...</div>
          <div v-else-if="filteredMakeupStudents.length === 0" class="edit-lesson-empty">
            No matching students.
          </div>
          <ul v-else class="makeup-results">
            <li
              v-for="option in filteredMakeupStudents"
              :key="option.id"
              :class="['makeup-result-item', { 'makeup-result-item-inactive': !isStudentActive(option) }]"
            >
              <div class="makeup-result-info">
                <div class="makeup-result-name">
                  <span>{{ option.name }}</span>
                  <span :class="getStudentStatusClass(option)">
                    {{ getStudentStatusLabel(option) }}
                  </span>
                </div>
                <div class="makeup-result-meta">
                  <span v-if="option.level">{{ option.level }}</span>
                  <span v-if="option.school"> · {{ option.school }}</span>
                  <span v-if="option.parent_contact"> · {{ option.parent_contact }}</span>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="isStudentAlreadyAdded(option.id)"
                @click="addMakeupStudentToEditedLesson(option)"
              >
                {{ isStudentAlreadyAdded(option.id) ? 'Added' : 'Add' }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'
import { api } from '../api'
import { useRoute } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import ClassStudentSearch from '../components/ClassStudentSearch.vue'
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_OPTIONS,
  isPresentLike,
  normalizeAttendanceStatus
} from '../constants/attendance'
import {
  DURATION_OPTIONS,
  getClassDefaultDuration,
  formatDurationLabel
} from '../constants/billing'
import {
  isStudentActive,
  getStudentStatusRank,
  getStudentStatusLabel,
  getStudentStatusClass
} from '../constants/studentStatus'
import {
  isMissedLesson,
  resolveLessonTimeRangeLabel,
  resolveLessonClockTimes
} from '../constants/lessons'

export default {
  name: 'ClassView',
  components: {
    Navbar,
    ClassStudentSearch
  },
  setup() {
    const route = useRoute()
    const loading = ref(true)
    const lessonsLoading = ref(true)
    const classData = ref(null)
    const students = ref([])
    const lessons = ref([])
    const selectedLesson = ref(null)
    const allStudents = ref({})
    const fullStudentDirectory = ref([])
    const showAddStudentsModal = ref(false)
    const stagedAddStudents = ref([])
    const enrolmentBulkSaving = ref(false)
    const enrolmentActionId = ref(null)

    const lessonSubmissionUrl = computed(() => {
      return `${window.location.origin}/lesson/${route.params.id}`
    })

    const formatSchedule = (classData) => {
      if (classData.day_of_week && classData.start_time && classData.end_time) {
        return `${classData.day_of_week} ${classData.start_time}-${classData.end_time}`
      }
      return 'Not set'
    }

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      if (typeof timestamp === 'string') {
        // Handle date string format (YYYY-MM-DD)
        const date = new Date(timestamp)
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      }
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    }

    const getPresentCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.filter(a => isPresentLike(a?.status)).length
    }

    const getTotalCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.length
    }

    const getStudentName = (studentId) => {
      return allStudents.value[studentId]?.name || 'Unknown'
    }

    const getStatusBadgeClass = (status) => {
      const normalized = normalizeAttendanceStatus(status)
      switch (normalized) {
        case ATTENDANCE_STATUSES.PRESENT:
          return 'badge badge-success'
        case ATTENDANCE_STATUSES.LATE:
          return 'badge badge-warning'
        case ATTENDANCE_STATUSES.ABSENT_VALID:
          return 'badge badge-danger'
        case ATTENDANCE_STATUSES.ABSENT_CHARGED:
          return 'badge badge-danger'
        case ATTENDANCE_STATUSES.MISSED:
          return 'badge'
        default:
          return 'badge'
      }
    }

    const normalizeStatus = (status) => normalizeAttendanceStatus(status)

    const formatLessonRecordTiming = (lesson) =>
      resolveLessonTimeRangeLabel(lesson, classData.value)

    const copyLink = () => {
      navigator.clipboard.writeText(lessonSubmissionUrl.value)
      alert('Link copied to clipboard!')
    }

    const loadFullStudentDirectory = async () => {
      try {
        const list = await api.get('/api/students')
        fullStudentDirectory.value = list || []
      } catch (e) {
        console.error('Error loading students directory:', e)
        fullStudentDirectory.value = []
      }
    }

    const openAddStudentsModal = () => {
      stagedAddStudents.value = []
      showAddStudentsModal.value = true
    }
    const closeAddStudentsModal = () => {
      showAddStudentsModal.value = false
      stagedAddStudents.value = []
    }
    const onStageStudentForClass = (s) => {
      if (stagedAddStudents.value.some((x) => x.id === s.id)) return
      stagedAddStudents.value = [...stagedAddStudents.value, s]
    }
    const unstageStudentForClass = (id) => {
      stagedAddStudents.value = stagedAddStudents.value.filter((x) => x.id !== id)
    }
    const commitAddStudentsToClass = async () => {
      if (!stagedAddStudents.value.length) return
      enrolmentBulkSaving.value = true
      try {
        const classId = route.params.id
        for (const s of stagedAddStudents.value) {
          await api.post('/api/enrolments', { student_id: s.id, class_id: classId })
        }
        closeAddStudentsModal()
        await loadClassData()
      } catch (e) {
        window.alert(e.message || 'Failed to add students')
      } finally {
        enrolmentBulkSaving.value = false
      }
    }

    const removeStudentFromClass = async (row) => {
      if (!row.enrolmentId || row.status !== 'active') return
      const ok = window.confirm(
        `Remove ${row.name} from this class?\n\n` +
          'Past lessons and attendance are not deleted. This only ends their enrolment in this class.'
      )
      if (!ok) return
      enrolmentActionId.value = row.enrolmentId
      try {
        await api.put(`/api/enrolments/${row.enrolmentId}`, { status: 'inactive' })
        await loadClassData()
      } catch (e) {
        window.alert(e.message || 'Failed to remove')
      } finally {
        enrolmentActionId.value = null
      }
    }

    const viewLesson = (lesson) => {
      selectedLesson.value = lesson
    }

    // --- Delete an entire lesson record (+ its attendance docs) ---
    const deletingLessonId = ref(null)
    const deleteLessonRecord = async (lesson) => {
      if (!lesson?.id) return
      const total = getTotalCount(lesson.attendance)
      const dateLabel = formatDate(lesson.lesson_date) || 'this lesson'
      const ok = window.confirm(
        `Delete lesson record for ${dateLabel}?\n\n` +
          `This will permanently remove the lesson and ${total} attendance record${total === 1 ? '' : 's'}. ` +
          'Fees, revenue, and WhatsApp summaries will no longer include this lesson. This cannot be undone.'
      )
      if (!ok) return
      deletingLessonId.value = lesson.id
      try {
        await api.delete(`/api/lessons/${lesson.id}`)
        await reloadLessons()
      } catch (err) {
        console.error('Error deleting lesson:', err)
        window.alert(err.message || 'Error deleting lesson record.')
      } finally {
        deletingLessonId.value = null
      }
    }

    // --- Edit Lesson Record state ---
    const showEditLessonModal = ref(false)
    const editingLessonId = ref(null)
    const editLessonSaving = ref(false)
    const editLessonError = ref('')
    const editLessonSuccess = ref(false)
    const editRowCounter = ref(0)

    const editLessonForm = reactive({
      lessonDate: '',
      startTime: '',
      endTime: '',
      description: '',
      homework: '',
      materialsLink: '',
      remark: '',
      attendanceRows: []
    })

    const editingIsMissed = computed(() => {
      if (!editingLessonId.value) return false
      const le = lessons.value.find((l) => l.id === editingLessonId.value)
      return isMissedLesson(le)
    })

    const visibleAttendanceRows = computed(() =>
      editLessonForm.attendanceRows.filter((r) => !r.shouldDelete)
    )

    const enrolledStudentIdSet = computed(() =>
      new Set(
        students.value
          .filter((r) => r.status === 'active')
          .map((r) => r.studentId)
      )
    )

    const studentsAvailableForEnrolmentPicker = computed(() => {
      const block = new Set([
        ...enrolledStudentIdSet.value,
        ...stagedAddStudents.value.map((s) => s.id)
      ])
      return (fullStudentDirectory.value || []).filter(
        (s) => s.id && !block.has(s.id)
      )
    })

    const activeEnrolledRows = computed(() =>
      students.value.filter((r) => r.status === 'active')
    )

    const resolveRowDuration = (row, classDefault) => {
      const raw = Number(row.duration_hours ?? row.durationHours)
      if (Number.isFinite(raw) && raw > 0) return raw
      return classDefault
    }

    const buildEditableAttendanceRows = (lessonRecord) => {
      const classDefault = getClassDefaultDuration(classData.value)
      const enrolledIds = enrolledStudentIdSet.value
      const rows = Array.isArray(lessonRecord?.attendance)
        ? lessonRecord.attendance
        : []
      return rows.map((att) => {
        const studentId = att.student_id ?? att.studentId
        const isMakeupFlag = Boolean(att.is_makeup ?? att.isMakeup)
        // Fall back to "not enrolled in this class" to detect makeup students
        // on legacy attendance rows that never stored the flag.
        const inferredMakeup = studentId && !enrolledIds.has(studentId)
        const isMakeup = isMakeupFlag || inferredMakeup
        return {
          key: `existing-${att.id || studentId || ++editRowCounter.value}`,
          attendanceId: att.id || null,
          studentId,
          studentName:
            att.studentName ||
            att.student_name ||
            allStudents.value[studentId]?.name ||
            'Unknown',
          status: normalizeAttendanceStatus(att.status) || ATTENDANCE_STATUSES.PRESENT,
          durationHours: resolveRowDuration(att, classDefault),
          isMakeup,
          isNew: false,
          shouldDelete: false,
          remark: att.remark || '',
          meta: att.meta || ''
        }
      })
    }

    const openEditLessonRecord = (lesson) => {
      editLessonError.value = ''
      editLessonSuccess.value = false
      editingLessonId.value = lesson.id
      editLessonForm.lessonDate = lesson.lesson_date || lesson.lessonDate || ''
      const resolvedClock = resolveLessonClockTimes(lesson, classData.value)
      editLessonForm.startTime =
        lesson.start_time ||
        lesson.startTime ||
        resolvedClock.startTime ||
        ''
      editLessonForm.endTime =
        lesson.end_time ||
        lesson.endTime ||
        resolvedClock.endTime ||
        ''
      editLessonForm.description = lesson.description || ''
      editLessonForm.homework = lesson.homework || ''
      editLessonForm.materialsLink =
        lesson.materials_link || lesson.materialsLink || ''
      editLessonForm.remark = lesson.remark || lesson.remarks || ''
      editLessonForm.attendanceRows = buildEditableAttendanceRows(lesson)
      showEditLessonModal.value = true
    }

    const closeEditLessonRecord = () => {
      if (editLessonSaving.value) return
      showEditLessonModal.value = false
      editingLessonId.value = null
      editLessonError.value = ''
      editLessonForm.attendanceRows = []
      closeMakeupSearch()
    }

    // --- Makeup student search within the edit modal ---
    const showMakeupSearchModal = ref(false)
    const makeupSearch = ref('')
    const makeupLoading = ref(false)
    const makeupCatalog = ref([])

    // Always refetch the catalog when the picker opens so newly-added or
    // newly-edited students (including inactive ones) show up immediately
    // without requiring a page reload.
    const loadMakeupCatalog = async () => {
      makeupLoading.value = true
      try {
        const list = await api.getPublic('/api/public/students-minimal')
        makeupCatalog.value = Array.isArray(list) ? list : []
      } catch (err) {
        console.error('Error loading students for makeup search:', err)
        makeupCatalog.value = []
      } finally {
        makeupLoading.value = false
      }
    }

    const openMakeupSearch = async () => {
      makeupSearch.value = ''
      showMakeupSearchModal.value = true
      await loadMakeupCatalog()
    }

    const closeMakeupSearch = () => {
      showMakeupSearchModal.value = false
      makeupSearch.value = ''
    }

    const isStudentAlreadyAdded = (studentId) => {
      return editLessonForm.attendanceRows.some(
        (r) => !r.shouldDelete && r.studentId === studentId
      )
    }

    // Sorts makeup candidates so active students always appear first and
    // inactive ones (dropped / graduated / stopped / legacy inactive) fall to
    // the bottom. Within each group, sort alphabetically by name. Inactive
    // students are NEVER filtered out — they remain selectable as makeup.
    const sortMakeupCandidates = (list) =>
      [...list].sort((a, b) => {
        const rankDiff = getStudentStatusRank(a) - getStudentStatusRank(b)
        if (rankDiff !== 0) return rankDiff
        return (a.name || '').localeCompare(b.name || '', undefined, {
          sensitivity: 'base'
        })
      })

    const filteredMakeupStudents = computed(() => {
      const term = makeupSearch.value.trim().toLowerCase()
      const list = makeupCatalog.value || []
      // Inactive students are NEVER excluded by status. Already-added students
      // remain visible in the list but the Add button is disabled for them.
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

    const addMakeupStudentToEditedLesson = (student) => {
      if (isStudentAlreadyAdded(student.id)) return
      const classDefault = getClassDefaultDuration(classData.value)
      const metaParts = [student.level, student.school].filter(Boolean)
      editLessonForm.attendanceRows.push({
        key: `new-${++editRowCounter.value}`,
        attendanceId: null,
        studentId: student.id,
        studentName: student.name,
        status: ATTENDANCE_STATUSES.PRESENT,
        durationHours: classDefault,
        isMakeup: true,
        isNew: true,
        shouldDelete: false,
        remark: '',
        meta: metaParts.join(' · ')
      })
    }

    const removeMakeupStudentFromEditedLesson = (row) => {
      if (!row.isMakeup) return
      if (row.isNew) {
        editLessonForm.attendanceRows = editLessonForm.attendanceRows.filter(
          (r) => r.key !== row.key
        )
      } else {
        row.shouldDelete = true
      }
    }

    const saveEditedLessonRecord = async () => {
      editLessonError.value = ''
      editLessonSuccess.value = false

      if (!editLessonForm.lessonDate) {
        editLessonError.value = 'Lesson date is required.'
        return
      }
      if (!editLessonForm.startTime) {
        editLessonError.value = 'Start time is required.'
        return
      }
      if (!editLessonForm.endTime) {
        editLessonError.value = 'End time is required.'
        return
      }

      const editedLessonTiming = `${String(editLessonForm.startTime).trim()}-${String(
        editLessonForm.endTime
      ).trim()}`

      if (editingIsMissed.value) {
        const r = (editLessonForm.remark || '').trim()
        if (!r) {
          editLessonError.value = 'Please enter a reason for the missed lesson.'
          return
        }
        const payload = {
          lesson_date: editLessonForm.lessonDate,
          lesson_timing: editedLessonTiming,
          start_time: editLessonForm.startTime,
          end_time: editLessonForm.endTime,
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
          await reloadLessons()
          setTimeout(() => {
            editLessonSuccess.value = false
            showEditLessonModal.value = false
            editingLessonId.value = null
            editLessonForm.attendanceRows = []
          }, 800)
        } catch (err) {
          console.error('Error saving lesson record:', err)
          editLessonError.value = err.message || 'Error saving lesson record.'
        } finally {
          editLessonSaving.value = false
        }
        return
      }

      const validDurations = new Set(DURATION_OPTIONS)
      for (const row of editLessonForm.attendanceRows) {
        if (row.shouldDelete) continue
        if (!row.status) {
          editLessonError.value = `Attendance status is required for ${row.studentName || 'a student'}.`
          return
        }
        if (!validDurations.has(Number(row.durationHours))) {
          editLessonError.value = `Please pick a valid duration for ${row.studentName || 'a student'}.`
          return
        }
      }

      const payload = {
        lesson_date: editLessonForm.lessonDate,
        lesson_timing: editedLessonTiming,
        start_time: editLessonForm.startTime,
        end_time: editLessonForm.endTime,
        description: editLessonForm.description || '',
        homework: editLessonForm.homework || '',
        materials_link: editLessonForm.materialsLink || '',
        attendance: editLessonForm.attendanceRows.map((row) => ({
          id: row.attendanceId || undefined,
          student_id: row.studentId,
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
        // Reload the lessons list so the table and billing-adjacent views
        // reflect the updated attendance/duration.
        await reloadLessons()
        setTimeout(() => {
          editLessonSuccess.value = false
          showEditLessonModal.value = false
          editingLessonId.value = null
          editLessonForm.attendanceRows = []
        }, 800)
      } catch (err) {
        console.error('Error saving lesson record:', err)
        editLessonError.value = err.message || 'Error saving lesson record.'
      } finally {
        editLessonSaving.value = false
      }
    }

    const reloadLessons = async () => {
      try {
        const lessonsList = await api.get(`/api/classes/${route.params.id}/lessons`)
        lessons.value = lessonsList || []
      } catch (err) {
        console.error('Error reloading lessons:', err)
      }
    }

    const loadClassData = async () => {
      try {
        const data = await api.get(`/api/classes/${route.params.id}`)
        if (data) {
          classData.value = data
          const stu = data.students || []
          students.value = stu.map((s) => ({
            enrolmentId: s.id,
            studentId: s.student_id,
            name: s.studentName || s.name,
            level: s.level,
            school: s.school,
            student_status: s.student_status,
            student_active: s.student_active,
            join_date: s.join_date,
            status: s.status
          }))
          const nameMap = {}
          for (const row of stu) {
            if (row.student_id) {
              nameMap[row.student_id] = { name: row.studentName || '—' }
            }
          }
          allStudents.value = nameMap
        }
        const lessonsList = await api.get(`/api/classes/${route.params.id}/lessons`)
        lessons.value = lessonsList || []
      } catch (error) {
        console.error('Error loading class data:', error)
      } finally {
        loading.value = false
        lessonsLoading.value = false
      }
    }

    onMounted(() => {
      loadClassData()
      loadFullStudentDirectory()
    })

    return {
      loading,
      lessonsLoading,
      classData,
      students,
      lessons,
      selectedLesson,
      lessonSubmissionUrl,
      formatSchedule,
      formatDate,
      getPresentCount,
      getTotalCount,
      getStudentName,
      getStatusBadgeClass,
      normalizeStatus,
      formatLessonRecordTiming,
      copyLink,
      viewLesson,
      deleteLessonRecord,
      deletingLessonId,
      showEditLessonModal,
      isMissedLesson,
      editingIsMissed,
      editLessonForm,
      editLessonSaving,
      editLessonError,
      editLessonSuccess,
      visibleAttendanceRows,
      openEditLessonRecord,
      closeEditLessonRecord,
      saveEditedLessonRecord,
      showMakeupSearchModal,
      makeupSearch,
      makeupLoading,
      filteredMakeupStudents,
      openMakeupSearch,
      closeMakeupSearch,
      addMakeupStudentToEditedLesson,
      removeMakeupStudentFromEditedLesson,
      isStudentAlreadyAdded,
      attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
      durationOptions: DURATION_OPTIONS,
      formatDurationLabel,
      isStudentActive,
      getStudentStatusLabel,
      getStudentStatusClass,
      activeEnrolledRows,
      showAddStudentsModal,
      stagedAddStudents,
      studentsAvailableForEnrolmentPicker,
      enrolmentBulkSaving,
      enrolmentActionId,
      openAddStudentsModal,
      closeAddStudentsModal,
      onStageStudentForClass,
      unstageStudentForClass,
      commitAddStudentsToClass,
      removeStudentFromClass
    }
  }
}
</script>

<style scoped>
.class-students-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.class-students-header h2 {
  margin: 0;
}
.class-students-empty {
  color: #64748b;
  font-size: 0.95rem;
}
.class-students-card .table-wrapper {
  overflow-x: auto;
}
.add-students-hint {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0 0 12px;
}
.add-students-empty {
  font-size: 0.85rem;
  color: #64748b;
  margin: 10px 0;
}
.staged-enrol-row {
  margin-top: 12px;
}
.staged-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 6px;
}
.staged-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.staged-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  border-radius: 999px;
  font-size: 0.85rem;
}
.staged-chip-remove {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  color: #047857;
}
.add-students-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.class-add-students-modal {
  max-width: 480px;
}
.muted {
  color: #94a3b8;
}

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
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 20px;
}

.lesson-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.edit-lesson-modal {
  max-width: 900px;
}

.edit-lesson-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.edit-lesson-header h2,
.edit-lesson-header h3 {
  margin: 0;
}

.edit-lesson-close {
  background: transparent;
  border: none;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 0 6px;
}

.edit-lesson-close:hover {
  color: #222;
}

.edit-lesson-section {
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eee;
}

.edit-lesson-section:last-of-type {
  border-bottom: none;
}

.edit-lesson-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.edit-lesson-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.edit-lesson-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.edit-lesson-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.edit-lesson-table {
  min-width: 620px;
}

.edit-lesson-table select {
  width: 100%;
}

.edit-lesson-student-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.edit-lesson-student-meta {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.edit-lesson-new-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  background: #d1ecf1;
  color: #0c5460;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.makeup-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fff3cd;
  color: #856404;
  font-size: 12px;
  font-weight: 600;
}

.regular-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: #e2e3e5;
  color: #383d41;
  font-size: 12px;
  font-weight: 600;
}

.edit-lesson-muted {
  color: #888;
}

.edit-lesson-empty {
  padding: 14px;
  color: #666;
  background: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.edit-lesson-error,
.edit-lesson-success {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 6px;
}

.edit-lesson-error {
  background: #f8d7da;
  color: #721c24;
}

.edit-lesson-success {
  background: #d4edda;
  color: #155724;
}

.edit-lesson-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.makeup-search-modal {
  max-width: 560px;
}

.makeup-search-hint {
  font-size: 13px;
  color: #555;
  margin: 0 0 10px;
}

.makeup-search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  margin-bottom: 12px;
}

.makeup-results {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 6px;
}

.makeup-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f1f1;
}

.makeup-result-item:last-child {
  border-bottom: none;
}

.makeup-result-item-inactive {
  background: #fafafa;
}

.makeup-result-name {
  font-weight: 600;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.makeup-result-meta {
  font-size: 12px;
  color: #666;
}

.student-status {
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
.student-status-active {
  color: #065f46;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.student-status-dropped {
  color: #9a3412;
  background: #ffedd5;
  border-color: #fed7aa;
}
.student-status-graduated {
  color: #4c1d95;
  background: #ede9fe;
  border-color: #ddd6fe;
}
.student-status-stopped {
  color: #334155;
  background: #e2e8f0;
  border-color: #cbd5e1;
}
.student-status-inactive {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}
</style>
