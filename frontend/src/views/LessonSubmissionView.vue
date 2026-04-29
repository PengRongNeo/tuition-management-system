<template>
  <div>
    <div class="container" style="max-width: 800px;">
      <h1>Submit Lesson</h1>
      
      <div v-if="loading" class="loading">Loading class information...</div>
      <div v-else-if="!classData" class="error">Class not found</div>
      <div v-else>
        <div class="card" style="margin-bottom: 20px;">
          <h2>{{ classData.name }}</h2>
          <p><strong>Subject:</strong> {{ classData.subject }} - {{ classData.level }}</p>
          <p><strong>Schedule:</strong> {{ formatSchedule(classData) }}</p>
          <p><strong>Teacher:</strong> {{ classData.teacherName }}</p>
        </div>

        <form @submit.prevent="submitLesson" class="card">
          <div class="form-group">
            <label>Lesson Date *</label>
            <div class="lesson-date-row">
              <input
                type="date"
                v-model="formData.lessonDate"
                required
              />
            </div>
            <p v-if="classData.day_of_week" class="lesson-date-hint">
              Regular class day: {{ classData.day_of_week }} (you may pick any date for catch-up, holiday week, etc.)
            </p>
          </div>

          <div class="form-group">
            <label>Teacher *</label>
            <select v-model="formData.teacherId" required>
              <option value="">Select teacher</option>
              <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
                {{ teacher.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Lesson Description *</label>
            <textarea v-model="formData.description" required placeholder="What was covered in this lesson?"></textarea>
          </div>

          <div class="form-group">
            <label>Homework</label>
            <textarea v-model="formData.homework" placeholder="Homework assigned to students"></textarea>
          </div>

          <div class="form-group">
            <label>Learning Materials Link</label>
            <input v-model="formData.materialsLink" type="url" placeholder="https://..." />
          </div>

          <div class="form-group">
            <label>Attendance *</label>
            <p style="font-size: 12px; color: #666; margin-bottom: 10px;">
              Mark attendance and lesson duration for each student. Use “Add Makeup Student”
              to include a student from another class for this lesson only.
            </p>
            <div v-if="attendanceRows.length === 0" class="error">
              No students enrolled in this class. Add a makeup student to submit this lesson.
            </div>
            <div v-else class="attendance-table-scroll">
              <table class="table attendance-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Remark</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in attendanceRows" :key="row.id">
                    <td>
                      <div class="attendance-student-cell">
                        <span>{{ row.name }}</span>
                        <span v-if="row.isMakeup" class="makeup-badge">Makeup</span>
                      </div>
                      <div v-if="row.isMakeup && row.meta" class="attendance-student-meta">
                        {{ row.meta }}
                      </div>
                    </td>
                    <td>
                      <select
                        v-model="formData.attendance[row.id].status"
                        required
                      >
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
                      <select
                        v-model.number="formData.attendance[row.id].durationHours"
                        required
                      >
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
                      <input
                        v-model="formData.attendance[row.id].remark"
                        placeholder="Optional remark"
                        style="width: 100%;"
                      />
                    </td>
                    <td>
                      <button
                        v-if="row.isMakeup"
                        type="button"
                        class="btn btn-danger btn-sm"
                        @click="removeMakeupStudent(row.id)"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="makeup-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="openMakeupModal"
              >
                + Add Makeup Student
              </button>
            </div>
          </div>

          <div
            v-if="showMakeupModal"
            class="makeup-modal-overlay"
            @click.self="closeMakeupModal"
          >
            <div class="makeup-modal" role="dialog" aria-modal="true">
              <div class="makeup-modal-header">
                <h3>Add Makeup Student</h3>
                <button type="button" class="makeup-close" @click="closeMakeupModal">&times;</button>
              </div>
              <p class="makeup-modal-hint">
                Search any student by name, school, level, or parent contact.
                They will only be added to this lesson, not permanently enrolled.
              </p>
              <input
                v-model="makeupSearch"
                type="text"
                placeholder="Search student..."
                class="makeup-search-input"
                autofocus
              />
              <div v-if="makeupLoading" class="makeup-loading">Loading students...</div>
              <div v-else-if="filteredMakeupStudents.length === 0" class="makeup-empty">
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
                    @click="addMakeupStudent(option)"
                  >
                    {{ isStudentAlreadyAdded(option.id) ? 'Added' : 'Add' }}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="error" class="error">{{ error }}</div>
          <div v-if="success" class="success">
            <template v-if="successIsMissed">Missed lesson saved. Students were not charged.</template>
            <template v-else>Lesson submitted successfully! Parents have been notified.</template>
          </div>

          <div class="lesson-form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="submitting || !isAttendanceValid"
            >
              {{ submitting && !savingAsMissed ? 'Submitting...' : 'Submit Lesson' }}
            </button>
            <button
              type="button"
              class="btn btn-missed"
              :disabled="submitting"
              @click="openMissedReasonModal"
            >
              Save as Missed Lesson
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showMissedReasonModal"
      class="lesson-date-modal-overlay"
      @click.self="closeMissedReasonModal"
    >
      <div class="lesson-date-modal" role="dialog" aria-modal="true" aria-labelledby="missed-reason-title" @click.stop>
        <h3 id="missed-reason-title">Missed lesson — reason required</h3>
        <p class="missed-reason-hint">Describe why this class did not run (e.g. teacher sick, public holiday, cancelled).</p>
        <label class="missed-reason-label" for="missed-reason-text">Remark / Reason *</label>
        <textarea
          id="missed-reason-text"
          v-model="missedModalRemark"
          rows="4"
          class="missed-reason-textarea"
          placeholder="e.g. Teacher sick, public holiday, class cancelled, student unable to attend"
          @keydown.esc="closeMissedReasonModal"
        ></textarea>
        <p v-if="missedModalError" class="error" style="margin-top:8px;">{{ missedModalError }}</p>
        <div class="lesson-date-modal-actions">
          <button type="button" class="btn btn-secondary" :disabled="savingAsMissed" @click="closeMissedReasonModal">
            Cancel
          </button>
          <button type="button" class="btn btn-missed" :disabled="savingAsMissed" @click="confirmSaveMissedLesson">
            {{ savingAsMissed ? 'Saving...' : 'Save Missed Lesson' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'
import { useRoute } from 'vue-router'
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_OPTIONS
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

export default {
  name: 'LessonSubmissionView',
  setup() {
    const route = useRoute()
    const loading = ref(true)
    const submitting = ref(false)
    const classData = ref(null)
    const teachers = ref([])
    const students = ref([])
    const error = ref('')
    const success = ref(false)
    const successIsMissed = ref(false)
    const savingAsMissed = ref(false)
    const formData = ref({
      lessonDate: new Date().toISOString().split('T')[0],
      teacherId: '',
      description: '',
      homework: '',
      materialsLink: '',
      attendance: {}
    })

    const showMissedReasonModal = ref(false)
    const missedModalRemark = ref('')
    const missedModalError = ref('')

    const openMissedReasonModal = () => {
      if (!formData.value.teacherId) {
        error.value = 'Please select a teacher'
        return
      }
      error.value = ''
      missedModalRemark.value = ''
      missedModalError.value = ''
      showMissedReasonModal.value = true
    }

    const closeMissedReasonModal = () => {
      if (savingAsMissed.value) return
      showMissedReasonModal.value = false
      missedModalRemark.value = ''
      missedModalError.value = ''
    }

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    const formatSchedule = (classData) => {
      if (classData.day_of_week && classData.start_time && classData.end_time) {
        return `${classData.day_of_week} ${classData.start_time}-${classData.end_time}`
      }
      return 'Not set'
    }

    // The only allowed lesson date: the schedule day that is today or the most recent past occurrence
    const getScheduleDayDate = (dayOfWeek) => {
      if (!dayOfWeek) return null
      const today = new Date()
      const todayDayName = DAY_NAMES[today.getDay()]
      if (todayDayName === dayOfWeek) {
        return today.toISOString().split('T')[0]
      }
      const d = new Date(today)
      for (let i = 1; i <= 7; i++) {
        d.setDate(d.getDate() - 1)
        if (DAY_NAMES[d.getDay()] === dayOfWeek) {
          return d.toISOString().split('T')[0]
        }
      }
      return null
    }

    // Makeup students added to this lesson only (not persisted as enrolment).
    const makeupStudents = ref([]) // array of { id, name, school, level, parent_contact }
    const showMakeupModal = ref(false)
    const makeupSearch = ref('')
    const makeupLoading = ref(false)
    const makeupCatalog = ref([]) // all students fetched from public endpoint

    const classDefaultDuration = computed(() =>
      getClassDefaultDuration(classData.value)
    )

    const attendanceRows = computed(() => {
      const rows = []
      for (const s of students.value) {
        rows.push({ id: s.id, name: s.name, isMakeup: false })
      }
      for (const m of makeupStudents.value) {
        const metaParts = [m.level, m.school].filter(Boolean)
        rows.push({
          id: m.id,
          name: m.name,
          isMakeup: true,
          meta: metaParts.join(' · ')
        })
      }
      return rows
    })

    const isAttendanceValid = computed(() => {
      return (
        attendanceRows.value.length > 0 &&
        attendanceRows.value.every(r => {
          const entry = formData.value.attendance[r.id]
          return entry?.status && Number(entry?.durationHours) > 0
        })
      )
    })

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

    const openMakeupModal = async () => {
      makeupSearch.value = ''
      showMakeupModal.value = true
      await loadMakeupCatalog()
    }

    const closeMakeupModal = () => {
      showMakeupModal.value = false
      makeupSearch.value = ''
    }

    const isStudentAlreadyAdded = (studentId) => {
      return attendanceRows.value.some(r => r.id === studentId)
    }

    // Sorts makeup candidates so active students appear first and inactive
    // ones (dropped / graduated / stopped / legacy inactive) fall to the
    // bottom. Within each group, sort alphabetically by name.
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
      const filtered = term
        ? list.filter(s => {
            const hay = [s.name, s.school, s.level, s.parent_contact, s.parent_name]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
            return hay.includes(term)
          })
        : list
      return sortMakeupCandidates(filtered).slice(0, 50)
    })

    const addMakeupStudent = (student) => {
      if (isStudentAlreadyAdded(student.id)) return
      makeupStudents.value.push({
        id: student.id,
        name: student.name,
        school: student.school,
        level: student.level,
        parent_contact: student.parent_contact
      })
      formData.value.attendance[student.id] = {
        status: ATTENDANCE_STATUSES.PRESENT,
        remark: '',
        durationHours: classDefaultDuration.value,
        isMakeup: true
      }
    }

    const removeMakeupStudent = (studentId) => {
      makeupStudents.value = makeupStudents.value.filter(m => m.id !== studentId)
      delete formData.value.attendance[studentId]
    }

    const loadClassData = async () => {
      try {
        const data = await api.getPublic(`/api/public/class/${route.params.classId}`)
        if (data) {
          classData.value = data
          formData.value.teacherId = data.main_teacher_id || ''
          const qd = route.query?.date
          if (qd && typeof qd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(qd)) {
            formData.value.lessonDate = qd.slice(0, 10)
          } else {
            const scheduleDate = getScheduleDayDate(data.day_of_week)
            if (scheduleDate) formData.value.lessonDate = scheduleDate
          }
          const teacherList = await api.getPublic('/api/public/teachers')
          teachers.value = teacherList || []
          const stu = data.students || []
          students.value = stu
          makeupStudents.value = []
          formData.value.attendance = {}
          const defaultDuration = getClassDefaultDuration(data)
          stu.forEach(s => {
            formData.value.attendance[s.id] = {
              status: ATTENDANCE_STATUSES.PRESENT,
              remark: '',
              durationHours: defaultDuration,
              isMakeup: false
            }
          })
        }
      } catch (err) {
        console.error('Error loading class data:', err)
        error.value = 'Error loading class information'
      } finally {
        loading.value = false
      }
    }

    const confirmSaveMissedLesson = async () => {
      const t = (missedModalRemark.value || '').trim()
      if (!t) {
        missedModalError.value = 'Please enter a reason for the missed lesson.'
        return
      }
      if (!formData.value.teacherId) {
        missedModalError.value = 'Please select a teacher on the form first.'
        return
      }
      if (!classData.value) return
      missedModalError.value = ''
      error.value = ''
      success.value = false
      successIsMissed.value = false
      submitting.value = true
      savingAsMissed.value = true
      try {
        await api.postPublic('/api/public/lesson-missed', {
          classId: route.params.classId,
          lessonDate: formData.value.lessonDate,
          teacherId: formData.value.teacherId,
          startTime: classData.value.start_time || classData.value.startTime || '',
          endTime: classData.value.end_time || classData.value.endTime || '',
          remark: t
        })
        // Allow close/re-open; hide modal immediately after success
        savingAsMissed.value = false
        showMissedReasonModal.value = false
        missedModalRemark.value = ''
        missedModalError.value = ''
        success.value = true
        successIsMissed.value = true
        setTimeout(() => { success.value = false }, 5000)
      } catch (err) {
        console.error('Error saving missed lesson:', err)
        missedModalError.value = err.message || 'Error saving missed lesson. Please try again.'
      } finally {
        submitting.value = false
        savingAsMissed.value = false
      }
    }

    const submitLesson = async () => {
      if (!isAttendanceValid.value) {
        error.value = 'Please mark attendance for all students'
        return
      }
      if (!formData.value.teacherId) {
        error.value = 'Please select a teacher'
        return
      }
      error.value = ''
      success.value = false
      successIsMissed.value = false
      submitting.value = true
      savingAsMissed.value = false
      try {
        const attendancePayload = {}
        for (const row of attendanceRows.value) {
          const entry = formData.value.attendance[row.id]
          if (!entry) continue
          attendancePayload[row.id] = {
            status: entry.status,
            remark: entry.remark || '',
            durationHours:
              Number(entry.durationHours) > 0
                ? Number(entry.durationHours)
                : classDefaultDuration.value,
            isMakeup: Boolean(row.isMakeup)
          }
        }
        await api.postPublic('/api/public/lesson-submit', {
          classId: route.params.classId,
          lessonDate: formData.value.lessonDate,
          teacherId: formData.value.teacherId,
          description: formData.value.description,
          homework: formData.value.homework || '',
          materialsLink: formData.value.materialsLink || '',
          attendance: attendancePayload
        })
        success.value = true
        const scheduleDate = getScheduleDayDate(classData.value?.day_of_week)
        const defaultDuration = classDefaultDuration.value
        formData.value = {
          lessonDate: scheduleDate || new Date().toISOString().split('T')[0],
          teacherId: classData.value?.main_teacher_id || '',
          description: '',
          homework: '',
          materialsLink: '',
          attendance: {}
        }
        makeupStudents.value = []
        students.value.forEach(student => {
          formData.value.attendance[student.id] = {
            status: ATTENDANCE_STATUSES.PRESENT,
            remark: '',
            durationHours: defaultDuration,
            isMakeup: false
          }
        })
        setTimeout(() => { success.value = false }, 5000)
      } catch (err) {
        console.error('Error submitting lesson:', err)
        error.value = err.message || 'Error submitting lesson. Please try again.'
      } finally {
        submitting.value = false
      }
    }

    onMounted(() => {
      loadClassData()
    })

    return {
      loading,
      submitting,
      classData,
      teachers,
      students,
      formData,
      error,
      success,
      formatSchedule,
      isAttendanceValid,
      submitLesson,
      showMissedReasonModal,
      missedModalRemark,
      missedModalError,
      openMissedReasonModal,
      closeMissedReasonModal,
      confirmSaveMissedLesson,
      successIsMissed,
      savingAsMissed,
      attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
      durationOptions: DURATION_OPTIONS,
      formatDurationLabel,
      attendanceRows,
      showMakeupModal,
      makeupSearch,
      makeupLoading,
      filteredMakeupStudents,
      openMakeupModal,
      closeMakeupModal,
      addMakeupStudent,
      removeMakeupStudent,
      isStudentAlreadyAdded,
      isStudentActive,
      getStudentStatusLabel,
      getStudentStatusClass
    }
  }
}
</script>

<style scoped>
h1 {
  margin-bottom: 20px;
}

.lesson-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.lesson-date-row input[type="date"] {
  flex: 1 1 220px;
  min-width: 0;
}

.lesson-date-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8125rem;
}

.lesson-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.missed-reason-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 12px;
  line-height: 1.4;
}
.missed-reason-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}
.missed-reason-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
  box-sizing: border-box;
}

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

.lesson-date-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.lesson-date-modal {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
}

.lesson-date-modal h3 {
  margin: 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.lesson-date-modal-hint {
  margin: 0 0 14px;
  font-size: 0.875rem;
  color: #64748b;
}

.lesson-date-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 480px) {
  .lesson-date-modal-actions {
    flex-direction: column-reverse;
  }
  .lesson-date-modal-actions .btn {
    width: 100%;
  }
}

.attendance-table-scroll {
  overflow-x: auto;
  width: 100%;
}

.attendance-table {
  min-width: 640px;
}

.attendance-table select,
.attendance-table input[type="text"] {
  width: 100%;
}

.attendance-student-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.attendance-student-meta {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 2px;
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

.makeup-actions {
  margin-top: 12px;
}

.makeup-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
}

.makeup-modal {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
}

.makeup-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.makeup-modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.makeup-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
}

.makeup-modal-hint {
  margin: 0 0 10px;
  font-size: 0.8125rem;
  color: #64748b;
}

.makeup-search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9375rem;
  margin-bottom: 12px;
}

.makeup-loading,
.makeup-empty {
  padding: 14px;
  font-size: 0.875rem;
  color: #64748b;
  text-align: center;
}

.makeup-results {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.makeup-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.makeup-result-item:last-child {
  border-bottom: none;
}

.makeup-result-item-inactive {
  background: #fafafa;
}

.makeup-result-name {
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.makeup-result-meta {
  font-size: 0.75rem;
  color: #64748b;
}
</style>
