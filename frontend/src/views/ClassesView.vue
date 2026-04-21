<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header page-header-actions">
        <div>
          <h1>Classes</h1>
          <p>Manage class schedules and fees</p>
        </div>
        <button @click="showCreateModal = true" class="btn btn-primary">
          + Create New Class
        </button>
      </header>

      <div v-if="loading" class="loading">Loading classes...</div>
      <div v-else-if="classes.length === 0" class="card">
        <p>No classes found. Create your first class to get started.</p>
      </div>
      <div v-else class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Level</th>
              <th>Schedule</th>
              <th>Teacher</th>
              <th>Rate / Hour</th>
              <th>Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="classItem in sortedClasses" :key="classItem.id">
              <td>{{ classItem.name }}</td>
              <td>{{ classItem.subject }}</td>
              <td>{{ classItem.level }}</td>
              <td>{{ formatSchedule(classItem) }}</td>
              <td>{{ classItem.teacherName || 'Not assigned' }}</td>
              <td>${{ getRatePerHour(classItem) }} / hour &middot; {{ getDefaultDuration(classItem) }}h</td>
              <td>{{ classItem.studentCount || 0 }}</td>
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

      <!-- Create/Edit Modal -->
      <div v-if="showCreateModal || showEditModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
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
                <option :value="2.5">2.5h</option>
                <option :value="3">3h</option>
              </select>
              <p style="font-size: 12px; color: #666; margin-top: 4px;">
                Default duration applied to each student when submitting a lesson; can be overridden per student.
              </p>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" v-model="formData.active" />
                Active
              </label>
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

export default {
  name: 'ClassesView',
  components: {
    Navbar
  },
  setup() {
    const loading = ref(true)
    const classes = ref([])
    const teachers = ref([])
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
    const openTimeDropdown = ref(null)
    const startTimeWrapRef = ref(null)
    const endTimeWrapRef = ref(null)

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

    const timeToMinutes = (time) => {
      if (!time || typeof time !== 'string') return 9999
      const trimmed = time.trim()
      const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
      if (!match) return 9999
      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const period = match[3] ? match[3].toUpperCase() : null
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return 9999
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      return hours * 60 + minutes
    }

    const sortedClasses = computed(() => {
      return [...classes.value].sort((a, b) => {
        const dayA = DAY_ORDER[a.day_of_week] ?? 999
        const dayB = DAY_ORDER[b.day_of_week] ?? 999
        if (dayA !== dayB) return dayA - dayB

        const timeA = timeToMinutes(a.start_time)
        const timeB = timeToMinutes(b.start_time)
        if (timeA !== timeB) return timeA - timeB

        return (a.name || '').localeCompare(b.name || '')
      })
    })

    const timeRangeError = computed(() => {
      const start = formData.value.startTime
      const end = formData.value.endTime
      if (!start || !end) return ''
      if (start >= end) return 'End time must be after start time.'
      return ''
    })

    const loadTeachers = async () => {
      try {
        const list = await api.get('/api/teachers')
        teachers.value = (list || []).filter(t => t.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      } catch (err) {
        console.error('Error loading teachers:', err)
        teachers.value = []
      }
    }

    const loadClasses = async () => {
      try {
        const list = await api.get('/api/classes')
        classes.value = list || []
      } catch (error) {
        console.error('Error loading classes:', error)
      } finally {
        loading.value = false
      }
    }

    const editClass = (classItem) => {
      editingId.value = classItem.id
      const existingRate =
        classItem.rate_per_hour ??
        classItem.ratePerHour ??
        classItem.rate_per_lesson ??
        classItem.monthly_fee
      const existingDuration =
        classItem.default_duration_hours ??
        classItem.defaultDurationHours
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
        defaultDurationHours: Number(existingDuration) > 0 ? Number(existingDuration) : 2,
        active: classItem.active !== false
      }
      onDayChange() // clear start/end if outside selected day's time range
      showEditModal.value = true
    }

    const deleteClass = async (classItem) => {
      if (!confirm(`Permanently delete class "${classItem.name}"? This will also delete all lessons, attendance records, and enrolments for this class. This cannot be undone.`)) return
      try {
        await api.delete(`/api/classes/${classItem.id}`)
        await loadClasses()
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
        } else {
          await api.post('/api/classes', classData)
        }
        closeModal()
        await loadClasses()
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
      error.value = ''
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

    const getDefaultDuration = (classItem) => {
      const raw =
        classItem?.default_duration_hours ??
        classItem?.defaultDurationHours
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : 2
    }

    onMounted(async () => {
      await loadTeachers()
      await loadClasses()
      document.addEventListener('click', closeTimeDropdownOnClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', closeTimeDropdownOnClickOutside)
    })

    return {
      loading,
      classes,
      sortedClasses,
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
      getDefaultDuration
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
</style>
