<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header page-header-actions">
        <div>
          <h1>Classes</h1>
          <p>Manage class schedules and fees</p>
        </div>
        <button type="button" @click="openCreateModal" class="btn btn-primary">
          + Create New Class
        </button>
      </header>

      <div v-if="loading" class="loading">Loading classes...</div>
      <div v-else-if="classes.length === 0" class="card">
        <p>No classes found. Create your first class to get started.</p>
      </div>
      <div v-else class="teacher-groups">
        <div
          v-for="group in groupedClassesByTeacher"
          :key="group.teacherName"
          class="card teacher-class-card"
        >
          <h2 class="teacher-class-title">
            {{ group.teacherName === 'Without Assigned Teacher'
              ? 'Classes Without Assigned Teacher'
              : `Classes of Teacher ${group.teacherName}` }}
            <span class="teacher-class-count">{{ group.classes.length }}</span>
          </h2>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Level</th>
                  <th>Schedule</th>
                  <th>Rate / Hour</th>
                  <th>Students</th>
                  <th>Revenue / Lesson</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="classItem in group.classes" :key="classItem.id">
                  <td>
                    <router-link :to="`/class/${classItem.id}`" class="class-name-link">
                      {{ classItem.name }}
                    </router-link>
                  </td>
                  <td>{{ classItem.subject }}</td>
                  <td>{{ classItem.level }}</td>
                  <td>{{ formatSchedule(classItem) }}</td>
                  <td class="num">{{ formatCurrency(getRatePerHour(classItem)) }}<span class="table-unit">/h</span></td>
                  <td>{{ classItem.studentCount || 0 }}</td>
                  <td class="num">{{ formatCurrency(getClassRevenuePerLesson(classItem)) }}</td>
                  <td>
                    <span :class="classItem.active ? 'badge badge-success' : 'badge badge-danger'">
                      {{ classItem.active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>
                    <router-link :to="`/class/${classItem.id}`" class="btn btn-primary btn-sm">
                      View
                    </router-link>
                    <button @click="editClass(classItem)" class="btn btn-secondary btn-sm">
                      Edit
                    </button>
                    <button @click="deleteClass(classItem)" class="btn btn-danger btn-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content class-form-modal" @click.stop>
          <h2>{{ showEditModal ? 'Edit Class' : 'Create New Class' }}</h2>
          <form @submit.prevent="saveClass">
            <div class="form-group">
              <label>Level *</label>
              <select v-model="formData.level" required @change="onLevelChange">
                <option value="">Select level</option>
                <option v-for="level in availableLevels" :key="level" :value="level">
                  {{ level }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Stream *</label>
              <select 
                v-model="formData.stream" 
                required 
                :disabled="!formData.level || isStreamAutoSet"
                @change="onStreamChange"
              >
                <option value="">Select stream</option>
                <option v-for="stream in availableStreams" :key="stream" :value="stream">
                  {{ stream }}
                </option>
              </select>
              <p v-if="isStreamAutoSet" style="font-size: 12px; color: #666; margin-top: 5px;">
                Stream automatically set to G3 for Sec 5
              </p>
            </div>
            <div class="form-group">
              <label>Subject *</label>
              <select v-model="formData.subject" required :disabled="!formData.level" @change="updateAutoClassName">
                <option value="">Select subject</option>
                <option v-for="subject in availableSubjects" :key="subject" :value="subject">
                  {{ subject }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Class Name *</label>
              <input v-model="formData.name" required placeholder="e.g., Sec 3 G2 Math" />
              <p style="font-size: 12px; color: #666; margin-top: 4px;">Auto-filled from Level, Stream and Subject; you can edit.</p>
            </div>
            <div class="schedule-section">
              <h3 class="schedule-section-title">Schedule</h3>
              <div class="form-group">
                <label>Day of Week *</label>
                <select v-model="formData.dayOfWeek" required @change="onDayChange">
                  <option value="">Select day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
                <p class="schedule-hint" v-if="formData.dayOfWeek">
                  {{ dayTimeHint }}
                </p>
              </div>
              <div class="form-group time-range-group">
                <label>Class time *</label>
                <div class="time-range-inputs">
                  <div class="time-input-wrap" ref="startTimeWrapRef">
                    <button
                      type="button"
                      :class="['time-trigger', { 'time-trigger-open': openTimeDropdown === 'start' }]"
                      @click="toggleTimeDropdown('start')"
                      :aria-expanded="openTimeDropdown === 'start'"
                      aria-label="Start time"
                    >
                      <span class="time-trigger-text">{{ formatTimeDisplay(formData.startTime) || 'Select start' }}</span>
                      <span class="time-trigger-icon" aria-hidden="true">▼</span>
                    </button>
                    <div v-if="openTimeDropdown === 'start'" class="time-dropdown" role="listbox">
                      <button
                        v-for="opt in timeOptions"
                        :key="opt.value"
                        type="button"
                        role="option"
                        :aria-selected="formData.startTime === opt.value"
                        :class="['time-option', { 'time-option-selected': formData.startTime === opt.value }]"
                        @click="selectTime('start', opt.value)"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                    <span class="time-input-label">Start</span>
                  </div>
                  <span class="time-range-sep" aria-hidden="true">to</span>
                  <div class="time-input-wrap" ref="endTimeWrapRef">
                    <button
                      type="button"
                      :class="['time-trigger', { 'time-trigger-open': openTimeDropdown === 'end' }]"
                      @click="toggleTimeDropdown('end')"
                      :aria-expanded="openTimeDropdown === 'end'"
                      aria-label="End time"
                    >
                      <span class="time-trigger-text">{{ formatTimeDisplay(formData.endTime) || 'Select end' }}</span>
                      <span class="time-trigger-icon" aria-hidden="true">▼</span>
                    </button>
                    <div v-if="openTimeDropdown === 'end'" class="time-dropdown" role="listbox">
                      <button
                        v-for="opt in timeOptions"
                        :key="opt.value"
                        type="button"
                        role="option"
                        :aria-selected="formData.endTime === opt.value"
                        :class="['time-option', { 'time-option-selected': formData.endTime === opt.value }]"
                        @click="selectTime('end', opt.value)"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                    <span class="time-input-label">End</span>
                  </div>
                </div>
                <p v-if="timeRangeError" class="time-range-error">{{ timeRangeError }}</p>
              </div>
            </div>
            <div class="form-group">
              <label>Main Teacher *</label>
              <select v-model="formData.mainTeacherId" required>
                <option value="">Select teacher</option>
                <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
                  {{ teacher.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="class-rate-per-hour">Rate Per Hour ($) *</label>
              <input
                id="class-rate-per-hour"
                type="number"
                v-model.number="formData.ratePerHour"
                required
                min="0"
                step="0.01"
                placeholder="Enter hourly rate"
              />
              <p class="form-hint">Auto-filled based on level. You can edit if needed.</p>
            </div>
            <div class="form-group">
              <label for="class-default-duration">Default Lesson Duration *</label>
              <select
                id="class-default-duration"
                v-model.number="formData.defaultDurationHours"
                required
              >
                <option :value="1">1h</option>
                <option :value="1.5">1.5h</option>
                <option :value="2">2h</option>
              </select>
              <p v-if="durationTimeWarning" class="form-hint form-hint--warn">
                {{ durationTimeWarning }}
              </p>
              <p class="form-hint">
                Auto-filled from class time when the slot is exactly 1h, 1.5h, or 2h. Default duration
                is applied to each student when submitting a lesson; you can change it or override
                per student in submission.
              </p>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" v-model="formData.active" />
                Active
              </label>
            </div>
            <div class="form-students-section">
              <h3 class="form-students-title">Students in this Class</h3>
              <p class="form-students-help">
                Optional. You can add students now or later from the class page.
              </p>
              <ClassStudentSearch
                :students="allStudents"
                :disabled-ids="selectedStudentIdSet"
                @select="addStudentToForm"
              />
              <div
                v-if="formSelectedStudents.length === 0"
                class="form-students-empty"
              >
                No students added yet. You can add them later.
              </div>
              <div v-else class="student-chip-row" aria-label="Selected students">
                <span class="form-students-label">Selected</span>
                <div class="student-chips">
                  <span
                    v-for="s in formSelectedStudents"
                    :key="s.id"
                    class="student-chip"
                  >
                    {{ s.name }}
                    <button
                      type="button"
                      class="student-chip-remove"
                      :title="'Remove ' + s.name"
                      @click="removeStudentFromForm(s.id)"
                    >
                      ×
                    </button>
                  </span>
                </div>
              </div>
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
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '../api'
import Navbar from '../components/Navbar.vue'
import ClassStudentSearch from '../components/ClassStudentSearch.vue'
import {
  timeToMinutes,
  calculateDurationHours,
  isValidDuration,
  getDefaultRateByLevel,
  getClassRevenuePerLesson
} from '../constants/classForm'
import { useAdminData } from '../composables/useAdminData'

export default {
  name: 'ClassesView',
  components: {
    Navbar,
    ClassStudentSearch
  },
  setup() {
    const {
      classes,
      teachers: teachersStore,
      students: allStudents,
      loadAdminData,
      refreshClasses,
      refreshStudents,
      refreshLessons,
      refreshAttendance,
      isLoaded,
      isLoading
    } = useAdminData()
    const loading = computed(() => isLoading.value && !isLoaded.value)
    const teachers = computed(() =>
      (teachersStore.value || [])
        .filter((t) => t.active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    )
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const error = ref('')
    const formData = ref({
      stream: '',
      name: '',
      subject: '',
      level: '',
      dayOfWeek: '',
      startTime: '',
      endTime: '',
      mainTeacherId: '',
      ratePerHour: null,
      defaultDurationHours: 2,
      active: true
    })
    const editingId = ref(null)
    const formSelectedStudents = ref([]) // { id, name }[]
    const initialActiveStudentIds = ref(new Set())
    const enrolmentIdByStudentId = ref({})
    const openTimeDropdown = ref(null)
    const startTimeWrapRef = ref(null)
    const endTimeWrapRef = ref(null)
    const durationTimeWarning = ref('')

    const currencyFormatter = new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0)

    // Time slots depend on day: weekday = 2pm onwards; weekend = 8am–9pm
    const buildTimeOptions = (startHour, endHour) => {
      const opts = []
      for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += 30) {
          if (h === endHour && m > 0) break
          const HH = String(h).padStart(2, '0')
          const mm = String(m).padStart(2, '0')
          const value = `${HH}:${mm}`
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
          const ampm = h < 12 ? 'AM' : 'PM'
          opts.push({ value, label: `${hour12}:${mm} ${ampm}` })
        }
      }
      return opts
    }

    const timeOptions = computed(() => {
      const day = formData.value.dayOfWeek || ''
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const isWeekday = weekdays.includes(day)
      if (isWeekday) {
        return buildTimeOptions(14, 22) // 2pm to 10:30pm
      }
      if (day === 'Saturday' || day === 'Sunday') {
        return buildTimeOptions(8, 21) // 8am to 9pm
      }
      return buildTimeOptions(8, 21) // default (e.g. no day selected): weekend range
    })

    const dayTimeHint = computed(() => {
      const day = formData.value.dayOfWeek || ''
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      if (weekdays.includes(day)) return 'Weekday: class time from 2:00 PM onwards.'
      if (day === 'Saturday' || day === 'Sunday') return 'Weekend: class time 8:00 AM – 9:00 PM.'
      return ''
    })

    const onDayChange = () => {
      const day = formData.value.dayOfWeek || ''
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const isWeekday = weekdays.includes(day)
      const start = formData.value.startTime
      const end = formData.value.endTime
      let clearTimes = false
      if (isWeekday) {
        if (start && start < '14:00') clearTimes = true
        if (end && end < '14:00') clearTimes = true
      } else       if (day === 'Saturday' || day === 'Sunday') {
        if (start && (start < '08:00' || start > '21:00')) clearTimes = true
        if (end && (end < '08:00' || end > '21:00')) clearTimes = true
      } else {
        clearTimes = true
      }
      if (clearTimes) {
        formData.value.startTime = ''
        formData.value.endTime = ''
        durationTimeWarning.value = ''
      }
    }

    const syncDurationFromClassTimes = () => {
      const start = formData.value.startTime
      const end = formData.value.endTime
      durationTimeWarning.value = ''
      if (!start || !end) return
      if (start >= end) return
      const hours = calculateDurationHours(start, end)
      if (hours == null) return
      if (isValidDuration(hours)) {
        formData.value.defaultDurationHours = hours
      } else {
        durationTimeWarning.value =
          'Selected time does not match 1h, 1.5h, or 2h. Please choose duration manually.'
      }
    }

    const formatTimeDisplay = (hhmm) => {
      if (!hhmm || typeof hhmm !== 'string') return ''
      const [hStr, mStr] = hhmm.split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr, 10)
      if (isNaN(h) || isNaN(m)) return hhmm
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
    }

    const toggleTimeDropdown = (which) => {
      openTimeDropdown.value = openTimeDropdown.value === which ? null : which
    }

    const selectTime = (which, value) => {
      if (which === 'start') formData.value.startTime = value
      else formData.value.endTime = value
      openTimeDropdown.value = null
      syncDurationFromClassTimes()
    }

    const closeTimeDropdownOnClickOutside = (e) => {
      if (!openTimeDropdown.value) return
      const startEl = startTimeWrapRef.value
      const endEl = endTimeWrapRef.value
      if (startEl?.contains(e.target) || endEl?.contains(e.target)) return
      openTimeDropdown.value = null
    }

    // Available levels (all levels available)
    const availableLevels = computed(() => {
      const primaryLevels = ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6']
      const secLevels = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5']
      return [...primaryLevels, ...secLevels]
    })

    // Available streams based on level
    const availableStreams = computed(() => {
      if (!formData.value.level) return []
      
      const level = formData.value.level
      
      // Primary levels (1-6): Standard or Foundation
      if (level.startsWith('Primary')) {
        return ['Standard', 'Foundation']
      }
      
      // Sec 1-4: G2 or G3
      if (['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4'].includes(level)) {
        return ['G2', 'G3']
      }
      
      // Sec 5: G3 only (auto-set)
      if (level === 'Sec 5') {
        return ['G3']
      }
      
      return []
    })

    // Check if stream should be auto-set (Sec 5)
    const isStreamAutoSet = computed(() => {
      return formData.value.level === 'Sec 5'
    })

    // Available subjects based on level
    const availableSubjects = computed(() => {
      if (!formData.value.level) return []
      
      const level = formData.value.level
      
      // Primary levels (1-6)
      if (level.startsWith('Primary')) {
        return ['English', 'Math', 'Science']
      }
      
      // Secondary 1-2
      if (['Sec 1', 'Sec 2'].includes(level)) {
        return ['English', 'Math', 'Science']
      }
      
      // Secondary 3-4
      if (['Sec 3', 'Sec 4'].includes(level)) {
        return [
          'English',
          'Math',
          'Amath',
          'Science',
          'Science(Chem)',
          'Science(Phy)',
          'Science(Bio)',
          'Chemistry',
          'Physics',
          'Biology'
        ]
      }
      
      // Secondary 5
      if (level === 'Sec 5') {
        return [
          'English',
          'Math',
          'Amath',
          'Science',
          'Science(Chem)',
          'Science(Phy)',
          'Science(Bio)',
          'Chemistry',
          'Physics',
          'Biology'
        ]
      }
      
      return []
    })

    const updateAutoClassName = () => {
      let levelPart = (formData.value.level || '').trim()
      if (levelPart.startsWith('Sec ')) {
        levelPart = 'S' + levelPart.slice(4).trim()
      } else if (levelPart.startsWith('Primary ')) {
        levelPart = 'P' + levelPart.slice(8).trim()
      }
      const streamPart = (formData.value.stream || '').trim()
      const subjectPart = (formData.value.subject || '').trim()
      const parts = [levelPart, streamPart, subjectPart].filter(Boolean)
      formData.value.name = parts.length ? parts.join(' ') : ''
    }

    const onLevelChange = () => {
      // Auto-set stream for Sec 5
      if (formData.value.level === 'Sec 5') {
        formData.value.stream = 'G3'
      } else {
        formData.value.stream = ''
      }
      formData.value.subject = ''
      const r = getDefaultRateByLevel(formData.value.level)
      if (r > 0) {
        formData.value.ratePerHour = r
      }
      updateAutoClassName()
    }

    const onStreamChange = () => {
      formData.value.subject = ''
      updateAutoClassName()
    }

    const formatSchedule = (classItem) => {
      if (classItem.day_of_week && classItem.start_time && classItem.end_time) {
        return `${classItem.day_of_week} ${classItem.start_time}-${classItem.end_time}`
      }
      return 'Not set'
    }

    const DAY_ORDER = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7
    }

    const sortedClasses = computed(() => {
      return [...classes.value].sort((a, b) => {
        const dayA = DAY_ORDER[a.day_of_week] ?? 999
        const dayB = DAY_ORDER[b.day_of_week] ?? 999
        if (dayA !== dayB) return dayA - dayB

        const timeA = timeToMinutes(a.start_time) ?? 9999
        const timeB = timeToMinutes(b.start_time) ?? 9999
        if (timeA !== timeB) return timeA - timeB

        return (a.name || '').localeCompare(b.name || '')
      })
    })

    // Resolve the best teacher name for a class, supporting all the historical
    // field shapes so no data migration is needed.
    const getClassTeacherName = (cls) => {
      if (!cls) return 'Without Assigned Teacher'
      const teacherId =
        cls.main_teacher_id ||
        cls.mainTeacherId ||
        cls.teacherId
      if (teacherId && Array.isArray(teachersStore.value)) {
        const matched = teachersStore.value.find((t) => t.id === teacherId)
        if (matched?.name) return matched.name
      }
      const stored =
        cls.teacherName ||
        cls.mainTeacherName ||
        cls.mainTeacher ||
        cls.teacher
      if (stored && typeof stored === 'string' && stored.trim()) {
        return stored.trim()
      }
      return 'Without Assigned Teacher'
    }

    const groupedClassesByTeacher = computed(() => {
      const groups = {}
      for (const cls of sortedClasses.value) {
        const name = getClassTeacherName(cls)
        if (!groups[name]) groups[name] = []
        groups[name].push(cls)
      }
      return Object.entries(groups)
        .map(([teacherName, classList]) => ({ teacherName, classes: classList }))
        .sort((a, b) => {
          // Push the unassigned bucket to the bottom; everything else is A→Z.
          if (a.teacherName === 'Without Assigned Teacher') return 1
          if (b.teacherName === 'Without Assigned Teacher') return -1
          return a.teacherName.localeCompare(b.teacherName)
        })
    })

    const timeRangeError = computed(() => {
      const start = formData.value.startTime
      const end = formData.value.endTime
      if (!start || !end) return ''
      if (start >= end) return 'End time must be after start time.'
      return ''
    })

    const selectedStudentIdSet = computed(
      () => new Set(formSelectedStudents.value.map((s) => s.id))
    )

    const addStudentToForm = (student) => {
      if (!student?.id) return
      if (formSelectedStudents.value.some((s) => s.id === student.id)) return
      formSelectedStudents.value = [
        ...formSelectedStudents.value,
        { id: student.id, name: student.name || '—' }
      ]
    }
    const removeStudentFromForm = (studentId) => {
      formSelectedStudents.value = formSelectedStudents.value.filter(
        (s) => s.id !== studentId
      )
    }

    const openCreateModal = () => {
      formSelectedStudents.value = []
      initialActiveStudentIds.value = new Set()
      enrolmentIdByStudentId.value = {}
      durationTimeWarning.value = ''
      showCreateModal.value = true
    }

    const editClass = async (classItem) => {
      durationTimeWarning.value = ''
      editingId.value = classItem.id
      const existingRate =
        classItem.rate_per_hour ??
        classItem.ratePerHour ??
        classItem.rate_per_lesson ??
        classItem.monthly_fee
      const existingDuration =
        classItem.default_duration_hours ??
        classItem.defaultDurationHours
      let durationVal = Number(existingDuration) > 0 ? Number(existingDuration) : 2
      if (![1, 1.5, 2].includes(durationVal)) {
        durationVal = 2
      }
      formData.value = {
        stream: classItem.stream || '',
        name: classItem.name || '',
        subject: classItem.subject || '',
        level: classItem.level || '',
        dayOfWeek: classItem.day_of_week || '',
        startTime: classItem.start_time || '',
        endTime: classItem.end_time || '',
        mainTeacherId: classItem.main_teacher_id || '',
        ratePerHour: existingRate === undefined || existingRate === null ? null : Number(existingRate),
        defaultDurationHours: durationVal,
        active: classItem.active !== false
      }
      onDayChange() // clear start/end if outside selected day's time range
      formSelectedStudents.value = []
      initialActiveStudentIds.value = new Set()
      enrolmentIdByStudentId.value = {}
      try {
        const detail = await api.get(`/api/classes/${classItem.id}`)
        const rows = detail.students || []
        const active = rows.filter((r) => r.status === 'active')
        formSelectedStudents.value = active.map((r) => ({
          id: r.student_id,
          name: r.studentName || '—'
        }))
        initialActiveStudentIds.value = new Set(
          active.map((r) => r.student_id).filter(Boolean)
        )
        const m = {}
        for (const r of rows) {
          if (r.student_id) m[r.student_id] = r.id
        }
        enrolmentIdByStudentId.value = m
      } catch (e) {
        console.error('Error loading class enrolments:', e)
        formSelectedStudents.value = []
      }
      showEditModal.value = true
    }

    const deleteClass = async (classItem) => {
      if (!confirm(`Permanently delete class "${classItem.name}"? This will also delete all lessons, attendance records, and enrolments for this class. This cannot be undone.`)) return
      try {
        await api.delete(`/api/classes/${classItem.id}`)
        await Promise.all([
          refreshClasses(),
          refreshStudents(),
          refreshLessons(),
          refreshAttendance()
        ])
      } catch (err) {
        console.error('Error deleting class:', err)
        error.value = err.message || 'Error deleting class'
        alert(err.message || 'Error deleting class')
      }
    }

    const saveClass = async () => {
      error.value = ''
      if (!formData.value.startTime || !formData.value.endTime) {
        error.value = 'Please select both start and end time.'
        return
      }
      if (timeRangeError.value) {
        error.value = timeRangeError.value
        return
      }
      const rate = formData.value.ratePerHour
      if (rate === null || rate === undefined || rate === '' || Number.isNaN(Number(rate)) || Number(rate) < 0) {
        error.value = 'Please enter a valid rate per hour.'
        return
      }
      const durationRaw = Number(formData.value.defaultDurationHours)
      const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 2
      try {
        const classData = {
          stream: formData.value.stream,
          name: formData.value.name,
          subject: formData.value.subject,
          level: formData.value.level,
          day_of_week: formData.value.dayOfWeek,
          start_time: formData.value.startTime,
          end_time: formData.value.endTime,
          main_teacher_id: formData.value.mainTeacherId,
          rate_per_hour: Number(rate),
          default_duration_hours: duration,
          active: formData.value.active
        }
        if (showEditModal.value && editingId.value) {
          await api.put(`/api/classes/${editingId.value}`, classData)
          const classId = editingId.value
          const final = new Set(formSelectedStudents.value.map((s) => s.id))
          const initial = initialActiveStudentIds.value
          for (const sid of final) {
            if (!initial.has(sid)) {
              await api.post('/api/enrolments', {
                student_id: sid,
                class_id: classId
              })
            }
          }
          for (const sid of initial) {
            if (!final.has(sid)) {
              const eid = enrolmentIdByStudentId.value[sid]
              if (eid) {
                await api.put(`/api/enrolments/${eid}`, { status: 'inactive' })
              }
            }
          }
        } else {
          const created = await api.post('/api/classes', classData)
          const newId = created && created.id
          if (newId) {
            for (const s of formSelectedStudents.value) {
              await api.post('/api/enrolments', {
                student_id: s.id,
                class_id: newId
              })
            }
          }
        }
        closeModal()
        await Promise.all([
          refreshClasses(),
          refreshStudents(),
          refreshLessons(),
          refreshAttendance()
        ])
      } catch (err) {
        error.value = err.message || 'Error saving class'
      }
    }

    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      editingId.value = null
      formData.value = {
        stream: '',
        name: '',
        subject: '',
        level: '',
        dayOfWeek: '',
        startTime: '',
        endTime: '',
        mainTeacherId: '',
        ratePerHour: null,
        defaultDurationHours: 2,
        active: true
      }
      formSelectedStudents.value = []
      initialActiveStudentIds.value = new Set()
      enrolmentIdByStudentId.value = {}
      error.value = ''
      durationTimeWarning.value = ''
    }

    const getRatePerHour = (classItem) => {
      const raw =
        classItem?.rate_per_hour ??
        classItem?.ratePerHour ??
        classItem?.rate_per_lesson ??
        classItem?.monthly_fee ??
        0
      const n = Number(raw)
      return Number.isFinite(n) ? n : 0
    }

    onMounted(async () => {
      await loadAdminData()
      document.addEventListener('click', closeTimeDropdownOnClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', closeTimeDropdownOnClickOutside)
    })

    return {
      loading,
      classes,
      sortedClasses,
      groupedClassesByTeacher,
      teachers,
      showCreateModal,
      showEditModal,
      formData,
      error,
      availableLevels,
      availableStreams,
      availableSubjects,
      isStreamAutoSet,
      formatSchedule,
      timeRangeError,
      timeOptions,
      openTimeDropdown,
      formatTimeDisplay,
      toggleTimeDropdown,
      selectTime,
      dayTimeHint,
      onDayChange,
      updateAutoClassName,
      onStreamChange,
      onLevelChange,
      editClass,
      deleteClass,
      saveClass,
      closeModal,
      getRatePerHour,
      getClassRevenuePerLesson,
      formatCurrency,
      durationTimeWarning,
      allStudents,
      formSelectedStudents,
      selectedStudentIdSet,
      addStudentToForm,
      removeStudentFromForm,
      openCreateModal
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

.class-name-link {
  color: var(--color-primary, #4f46e5);
  font-weight: 600;
  text-decoration: none;
}
.class-name-link:hover {
  text-decoration: underline;
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
.class-form-modal {
  max-width: 540px;
}
.form-students-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}
.form-students-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px;
  color: #0f172a;
}
.form-students-help {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0 0 10px;
}
.form-students-empty {
  font-size: 0.85rem;
  color: #64748b;
  margin: 8px 0 0;
}
.form-students-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-bottom: 6px;
}
.student-chip-row {
  margin-top: 12px;
}
.student-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.student-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  font-size: 0.85rem;
  color: #312e81;
}
.student-chip-remove {
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0 0 2px;
  color: #6366f1;
}
.student-chip-remove:hover {
  color: #b91c1c;
}

.modal-content h2 {
  margin-bottom: 20px;
}

.schedule-section {
  background: var(--color-background, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  padding: 16px;
  margin-bottom: 18px;
}

.schedule-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.schedule-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  margin-top: 6px;
}

.time-range-group {
  margin-bottom: 0;
}

.time-range-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.time-input-wrap {
  flex: 1;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}

.time-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-family: inherit;
  background: white;
  color: var(--color-text, #1e293b);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.time-trigger:hover {
  border-color: var(--color-primary, #4f46e5);
}

.time-trigger-open {
  border-color: var(--color-primary, #4f46e5);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
  outline: none;
}

.time-trigger-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-trigger-text:empty::before,
.time-trigger:not([data-value]) .time-trigger-text::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted, #64748b);
}

.time-trigger-icon {
  font-size: 0.625rem;
  color: var(--color-text-muted, #64748b);
  margin-left: 8px;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.time-trigger-open .time-trigger-icon {
  transform: rotate(180deg);
  color: var(--color-primary, #4f46e5);
}

.time-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.08));
  z-index: 100;
  padding: 6px 0;
}

.time-option {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--color-text, #1e293b);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.time-option:hover {
  background: var(--color-primary-light, #eef2ff);
}

.time-option-selected {
  background: var(--color-primary-light, #eef2ff);
  color: var(--color-primary, #4f46e5);
  font-weight: 500;
}

.time-input-label {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
}

.time-range-sep {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted, #64748b);
  padding: 0 4px;
  flex-shrink: 0;
}

.time-range-error {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--color-danger, #dc2626);
}

.teacher-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.teacher-class-card {
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-surface, #ffffff);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.teacher-class-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #1f2937);
  margin: 0 0 16px;
  letter-spacing: -0.01em;
}

.teacher-class-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.table-wrapper {
  overflow-x: auto;
}

@media (max-width: 640px) {
  .teacher-class-card {
    padding: 18px;
  }
  .teacher-class-title {
    font-size: 1rem;
  }
}

.form-hint {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  line-height: 1.4;
}

.form-hint--warn {
  color: #b45309;
}

td.num {
  white-space: nowrap;
}

.table-unit {
  font-size: 0.85em;
  color: var(--color-text-muted, #64748b);
  margin-left: 2px;
}
</style>
