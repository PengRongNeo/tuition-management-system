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
          <p><strong>Monthly Fee:</strong> ${{ classData.monthly_fee }}</p>
          <p>
            <strong>Status:</strong>
            <span :class="classData.active ? 'badge badge-success' : 'badge badge-danger'">
              {{ classData.active ? 'Active' : 'Inactive' }}
            </span>
          </p>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <h2>Enrolled Students</h2>
            <div v-if="students.length === 0">
              <p>No students enrolled yet.</p>
            </div>
            <table v-else class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Join Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="student in students" :key="student.id">
                  <td>{{ student.name }}</td>
                  <td>{{ formatDate(student.join_date) }}</td>
                  <td>
                    <span :class="student.status === 'active' ? 'badge badge-success' : 'badge badge-danger'">
                      {{ student.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
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
                  <th>Description</th>
                  <th>Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lesson in lessons" :key="lesson.id">
                  <td>{{ formatDate(lesson.lesson_date) }}</td>
                  <td>{{ lesson.teacherName }}</td>
                  <td>{{ lesson.description || 'No description' }}</td>
                  <td>
                    {{ getPresentCount(lesson.attendance) }} / {{ getTotalCount(lesson.attendance) }}
                  </td>
                  <td>
                    <button @click="viewLesson(lesson)" class="btn btn-primary btn-sm">
                      View Details
                    </button>
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
            <strong>Description:</strong>
            <p>{{ selectedLesson.description || 'No description' }}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <strong>Homework:</strong>
            <p>{{ selectedLesson.homework || 'No homework assigned' }}</p>
          </div>
          <div style="margin-bottom: 15px;" v-if="selectedLesson.materials_link">
            <strong>Materials:</strong>
            <a :href="selectedLesson.materials_link" target="_blank">{{ selectedLesson.materials_link }}</a>
          </div>
          <div style="margin-bottom: 15px;">
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
                      {{ att.status }}
                    </span>
                  </td>
                  <td>{{ att.remark || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button @click="selectedLesson = null" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'
import { useRoute } from 'vue-router'
import Navbar from '../components/Navbar.vue'

export default {
  name: 'ClassView',
  components: {
    Navbar
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
      return attendance.filter(a => a.status === 'present' || a.status === 'late').length
    }

    const getTotalCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.length
    }

    const getStudentName = (studentId) => {
      return allStudents.value[studentId]?.name || 'Unknown'
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        present: 'badge badge-success',
        absent: 'badge badge-danger',
        late: 'badge badge-warning'
      }
      return classes[status] || 'badge'
    }

    const copyLink = () => {
      navigator.clipboard.writeText(lessonSubmissionUrl.value)
      alert('Link copied to clipboard!')
    }

    const viewLesson = (lesson) => {
      selectedLesson.value = lesson
    }

    const loadClassData = async () => {
      try {
        const data = await api.get(`/api/classes/${route.params.id}`)
        if (data) {
          classData.value = data
          const stu = data.students || []
          students.value = stu.map(s => ({
            id: s.id || s.student_id,
            name: s.studentName || s.name,
            join_date: s.join_date,
            status: s.status
          }))
          allStudents.value = Object.fromEntries(stu.map(s => [(s.student_id || s.id), { name: s.studentName || s.name }]))
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
      copyLink,
      viewLesson
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
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 20px;
}
</style>
