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
            <input
              type="date"
              v-model="formData.lessonDate"
              :min="scheduleDateMin"
              :max="scheduleDateMax"
              required
            />
            <p v-if="classData.day_of_week" style="font-size: 12px; color: #666; margin-top: 4px;">
              Must be a {{ classData.day_of_week }} (same day as class schedule).
            </p>
            <p v-if="lessonDateDayError" class="error" style="font-size: 12px; margin-top: 4px;">{{ lessonDateDayError }}</p>
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
              Mark attendance for each student:
            </p>
            <div v-if="students.length === 0" class="error">
              No students enrolled in this class.
            </div>
            <table v-else class="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="student in students" :key="student.id">
                  <td>{{ student.name }}</td>
                  <td>
                    <select 
                      v-model="formData.attendance[student.id].status" 
                      required
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                    </select>
                  </td>
                  <td>
                    <input 
                      v-model="formData.attendance[student.id].remark" 
                      placeholder="Optional remark"
                      style="width: 100%;"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="error" class="error">{{ error }}</div>
          <div v-if="success" class="success">
            Lesson submitted successfully! Parents have been notified.
          </div>

          <button type="submit" class="btn btn-primary" :disabled="submitting || !isAttendanceValid">
            {{ submitting ? 'Submitting...' : 'Submit Lesson' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'
import { useRoute } from 'vue-router'

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
    const formData = ref({
      lessonDate: new Date().toISOString().split('T')[0],
      teacherId: '',
      description: '',
      homework: '',
      materialsLink: '',
      attendance: {}
    })

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

    const scheduleDateMin = computed(() => {
      const date = classData.value && getScheduleDayDate(classData.value.day_of_week)
      return date || ''
    })

    const scheduleDateMax = computed(() => {
      return scheduleDateMin.value
    })

    const lessonDateDayError = computed(() => {
      if (!classData.value?.day_of_week || !formData.value.lessonDate) return ''
      const selected = new Date(formData.value.lessonDate)
      const dayName = DAY_NAMES[selected.getDay()]
      if (dayName !== classData.value.day_of_week) {
        return `Lesson date must be a ${classData.value.day_of_week}.`
      }
      return ''
    })

    const isAttendanceValid = computed(() => {
      return students.value.length > 0 && 
             students.value.every(s => 
               formData.value.attendance[s.id]?.status
             )
    })

    const loadClassData = async () => {
      try {
        const data = await api.getPublic(`/api/public/class/${route.params.classId}`)
        if (data) {
          classData.value = data
          formData.value.teacherId = data.main_teacher_id || ''
          const scheduleDate = getScheduleDayDate(data.day_of_week)
          if (scheduleDate) formData.value.lessonDate = scheduleDate
          const teacherList = await api.getPublic('/api/public/teachers')
          teachers.value = teacherList || []
          const stu = data.students || []
          students.value = stu
          formData.value.attendance = {}
          stu.forEach(s => {
            formData.value.attendance[s.id] = { status: 'present', remark: '' }
          })
        }
      } catch (err) {
        console.error('Error loading class data:', err)
        error.value = 'Error loading class information'
      } finally {
        loading.value = false
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
      if (lessonDateDayError.value) {
        error.value = lessonDateDayError.value
        return
      }
      error.value = ''
      success.value = false
      submitting.value = true
      try {
        await api.postPublic('/api/public/lesson-submit', {
          classId: route.params.classId,
          lessonDate: formData.value.lessonDate,
          teacherId: formData.value.teacherId,
          description: formData.value.description,
          homework: formData.value.homework || '',
          materialsLink: formData.value.materialsLink || '',
          attendance: formData.value.attendance
        })
        success.value = true
        const scheduleDate = getScheduleDayDate(classData.value?.day_of_week)
        formData.value = {
          lessonDate: scheduleDate || new Date().toISOString().split('T')[0],
          teacherId: classData.value?.main_teacher_id || '',
          description: '',
          homework: '',
          materialsLink: '',
          attendance: {}
        }
        students.value.forEach(student => {
          formData.value.attendance[student.id] = { status: 'present', remark: '' }
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
      scheduleDateMin,
      scheduleDateMax,
      lessonDateDayError,
      isAttendanceValid,
      submitLesson
    }
  }
}
</script>

<style scoped>
h1 {
  margin-bottom: 20px;
}
</style>
