<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header page-header-actions">
        <div>
          <h1>Students & Fee Overview</h1>
          <p>Manage students and fee breakdown</p>
        </div>
        <button @click="showCreateModal = true" class="btn btn-primary">
          + Add New Student
        </button>
      </header>

      <div v-if="loading" class="loading">Loading students...</div>
      <div v-else-if="students.length === 0" class="card">
        <p>No students found. Add your first student to get started.</p>
      </div>
      <div v-else>
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>School</th>
                <th>Level</th>
                <th>Parent Name</th>
                <th>Parent Contact</th>
                <th>Enrolled Classes</th>
                <th>Monthly Fee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="student in students" :key="student.id">
                <td>{{ student.name }}</td>
                <td>{{ student.school || '-' }}</td>
                <td>{{ student.level || '-' }}</td>
                <td>{{ student.parent_name || '-' }}</td>
                <td>{{ student.parent_contact || '-' }}</td>
                <td>{{ student.enrolledClasses.length }}</td>
                <td>${{ student.monthlyFee.toFixed(2) }}</td>
                <td>
                  <span :class="student.status === 'active' ? 'badge badge-success' : 'badge badge-danger'">
                    {{ student.status }}
                  </span>
                </td>
                <td>
                  <button @click="viewStudent(student)" class="btn btn-primary btn-sm">
                    View Details
                  </button>
                  <button @click="editStudent(student)" class="btn btn-secondary btn-sm">
                    Edit
                  </button>
                  <button @click="deleteStudent(student)" class="btn btn-danger btn-sm">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
              <label>School</label>
              <input v-model="formData.school" />
            </div>
            <div class="form-group">
              <label>Level *</label>
              <input v-model="formData.level" required placeholder="e.g., Sec 3" />
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
                  <th>Monthly Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="enrollment in selectedStudent.enrolledClasses" :key="enrollment.id">
                  <td>{{ enrollment.className }}</td>
                  <td>{{ formatDate(enrollment.join_date) }}</td>
                  <td>${{ enrollment.monthlyFee }}</td>
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
                  {{ classItem.name }} (${{ classItem.monthly_fee }})
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
            <h3>Monthly Fee Breakdown</h3>
            <div class="card" style="background: #f8f9fa;">
              <p><strong>Total Monthly Fee:</strong> ${{ selectedStudent.monthlyFee.toFixed(2) }}</p>
              <ul style="margin-top: 10px; padding-left: 20px;">
                <li v-for="enrollment in selectedStudent.enrolledClasses" :key="enrollment.id">
                  {{ enrollment.className }}: ${{ enrollment.monthlyFee }}
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
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import Navbar from '../components/Navbar.vue'

export default {
  name: 'StudentsView',
  components: {
    Navbar
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

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const loadStudents = async () => {
      try {
        const list = await api.get('/api/students')
        students.value = (list || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      } catch (error) {
        console.error('Error loading students:', error)
      } finally {
        loading.value = false
      }
    }

    const loadClasses = async () => {
      try {
        const list = await api.get('/api/classes')
        classes.value = list || []
      } catch (error) {
        console.error('Error loading classes:', error)
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
      formatDate,
      editStudent,
      viewStudent,
      enrollStudent,
      unenrollStudent,
      deleteStudent,
      saveStudent,
      closeModal
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
</style>
