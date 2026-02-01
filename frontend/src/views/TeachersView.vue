<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header page-header-actions">
        <div>
          <h1>Teachers</h1>
          <p>Manage teachers and assignments</p>
        </div>
        <button @click="showCreateModal = true" class="btn btn-primary">
          + Add New Teacher
        </button>
      </header>

      <div v-if="loading" class="loading">Loading teachers...</div>
      <div v-else-if="teachers.length === 0" class="card">
        <p>No teachers found. Add your first teacher to get started.</p>
      </div>
      <div v-else class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Subjects</th>
              <th>Qualifications</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="teacher in teachers" :key="teacher.id">
              <td>{{ teacher.name }}</td>
              <td>{{ teacher.contact || '-' }}</td>
              <td>
                <span v-if="teacher.subjects && teacher.subjects.length > 0">
                  {{ teacher.subjects.join(', ') }}
                </span>
                <span v-else>-</span>
              </td>
              <td>{{ teacher.qualifications || '-' }}</td>
              <td>{{ formatDate(teacher.join_date) }}</td>
              <td>
                <span :class="teacher.active ? 'badge badge-success' : 'badge badge-danger'">
                  {{ teacher.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <button @click="viewTeacher(teacher)" class="btn btn-primary btn-sm">
                  View
                </button>
                <button @click="editTeacher(teacher)" class="btn btn-secondary btn-sm">
                  Edit
                </button>
                <button @click="deleteTeacher(teacher)" class="btn btn-danger btn-sm">
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
          <h2>{{ showEditModal ? 'Edit Teacher' : 'Add New Teacher' }}</h2>
          <form @submit.prevent="saveTeacher" :key="showEditModal ? (editingId || 'edit') : 'create'">
            <div class="form-group">
              <label>Name *</label>
              <input v-model="formData.name" required />
            </div>
            <div class="form-group">
              <label>Contact *</label>
              <input v-model="formData.contact" type="tel" required />
            </div>
            <div class="form-group">
              <label>Bank Account</label>
              <input v-model="formData.bank_acct" placeholder="Bank account number" />
            </div>
            <div class="form-group">
              <label>Qualifications</label>
              <textarea v-model="formData.qualifications_desc" placeholder="e.g., NUS BSc Math"></textarea>
            </div>
            <div class="form-group">
              <label>Subjects</label>
              <div style="margin-bottom: 10px;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                  <select v-model="newSubject" style="flex: 1;">
                    <option value="">Select subject to add</option>
                    <option value="English">English</option>
                    <option value="Math">Math</option>
                    <option value="Amath">Amath</option>
                    <option value="Science">Science</option>
                    <option value="Science(Chem)">Science(Chem)</option>
                    <option value="Science(Phy)">Science(Phy)</option>
                    <option value="Science(Bio)">Science(Bio)</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Physics">Physics</option>
                    <option value="Biology">Biology</option>
                  </select>
                  <button type="button" @click="addSubject" class="btn btn-secondary" :disabled="!newSubject">
                    Add
                  </button>
                </div>
                <div v-if="formData.subjects.length > 0" style="display: flex; flex-wrap: wrap; gap: 5px;">
                  <span 
                    v-for="(subject, index) in formData.subjects" 
                    :key="index"
                    class="badge badge-info"
                    style="display: inline-flex; align-items: center; gap: 5px;"
                  >
                    {{ subject }}
                    <button 
                      type="button" 
                      @click="removeSubject(index)" 
                      style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; margin-left: 5px;"
                    >
                      ×
                    </button>
                  </span>
                </div>
                <p v-else style="font-size: 12px; color: #666;">No subjects added</p>
              </div>
            </div>
            <div class="form-group">
              <label>Join Date *</label>
              <input type="date" v-model="formData.joinDate" required />
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

      <!-- Teacher Detail Modal -->
      <div v-if="selectedTeacher" class="modal-overlay" @click="selectedTeacher = null">
        <div class="modal-content" @click.stop style="max-width: 600px;">
          <h2>{{ selectedTeacher.name }} - Details</h2>
          
          <div style="margin-bottom: 20px;">
            <h3>Teacher Information</h3>
            <p><strong>Name:</strong> {{ selectedTeacher.name }}</p>
            <p><strong>Contact:</strong> {{ selectedTeacher.contact || '-' }}</p>
            <p><strong>Bank Account:</strong> {{ selectedTeacher.bank_acct || '-' }}</p>
            <p><strong>Qualifications:</strong> {{ selectedTeacher.qualifications_desc || '-' }}</p>
            <p><strong>Join Date:</strong> {{ formatDate(selectedTeacher.join_date) }}</p>
            <p>
              <strong>Status:</strong>
              <span :class="selectedTeacher.active ? 'badge badge-success' : 'badge badge-danger'">
                {{ selectedTeacher.active ? 'Active' : 'Inactive' }}
              </span>
            </p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3>Subjects</h3>
            <div v-if="selectedTeacher.subjects && selectedTeacher.subjects.length > 0">
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                <span 
                  v-for="(subject, index) in selectedTeacher.subjects" 
                  :key="index"
                  class="badge badge-info"
                >
                  {{ subject }}
                </span>
              </div>
            </div>
            <p v-else>No subjects assigned</p>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button @click="selectedTeacher = null" class="btn btn-secondary">Close</button>
            <button @click="deleteTeacher(selectedTeacher)" class="btn btn-danger">Delete teacher</button>
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
  name: 'TeachersView',
  components: {
    Navbar
  },
  setup() {
    const loading = ref(true)
    const teachers = ref([])
    const showCreateModal = ref(false)
    const showEditModal = ref(false)
    const selectedTeacher = ref(null)
    const error = ref('')
    const newSubject = ref('')
    const formData = ref({
      name: '',
      contact: '',
      bank_acct: '',
      qualifications_desc: '',
      subjects: [],
      joinDate: new Date().toISOString().split('T')[0],
      active: true
    })
    const editingId = ref(null)

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      let date
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate()
      } else if (typeof timestamp === 'object' && (timestamp.seconds != null || timestamp._seconds != null)) {
        const sec = timestamp.seconds ?? timestamp._seconds
        date = new Date(sec * 1000)
      } else {
        date = new Date(timestamp)
      }
      if (isNaN(date.getTime())) return ''
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }

    const loadTeachers = async () => {
      try {
        const list = await api.get('/api/teachers')
        teachers.value = (list || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      } catch (err) {
        console.error('Error loading teachers:', err)
        teachers.value = []
      } finally {
        loading.value = false
      }
    }

    const addSubject = () => {
      if (newSubject.value && !formData.value.subjects.includes(newSubject.value)) {
        formData.value.subjects.push(newSubject.value)
        newSubject.value = ''
      }
    }

    const removeSubject = (index) => {
      formData.value.subjects.splice(index, 1)
    }

    const parseJoinDate = (joinDate) => {
      if (!joinDate) return new Date().toISOString().split('T')[0]
      if (joinDate.toDate && typeof joinDate.toDate === 'function') return joinDate.toDate().toISOString().split('T')[0]
      if (joinDate.seconds != null) return new Date(joinDate.seconds * 1000).toISOString().split('T')[0]
      if (joinDate._seconds != null) return new Date(joinDate._seconds * 1000).toISOString().split('T')[0]
      const d = new Date(joinDate)
      return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
    }

    const editTeacher = (teacher) => {
      editingId.value = teacher.id
      formData.value = {
        name: teacher.name || '',
        contact: teacher.contact || '',
        bank_acct: teacher.bank_acct || '',
        qualifications_desc: teacher.qualifications_desc ?? teacher.qualifications ?? '',
        subjects: Array.isArray(teacher.subjects) ? [...teacher.subjects] : [],
        joinDate: parseJoinDate(teacher.join_date),
        active: teacher.active !== false
      }
      newSubject.value = ''
      showEditModal.value = true
    }

    const viewTeacher = (teacher) => {
      selectedTeacher.value = teacher
    }

    const deleteTeacher = async (teacher) => {
      if (!confirm(`Permanently delete teacher "${teacher.name}"? This will remove them from any assigned classes and lessons. This cannot be undone.`)) return
      try {
        await api.delete(`/api/teachers/${teacher.id}`)
        if (selectedTeacher.value?.id === teacher.id) selectedTeacher.value = null
        await loadTeachers()
      } catch (err) {
        console.error('Error deleting teacher:', err)
        error.value = err.message || 'Error deleting teacher'
        alert(err.message || 'Error deleting teacher')
      }
    }

    const saveTeacher = async () => {
      error.value = ''
      try {
        const teacherData = {
          name: formData.value.name,
          contact: formData.value.contact,
          bank_acct: formData.value.bank_acct || '',
          qualifications_desc: formData.value.qualifications_desc || '',
          subjects: formData.value.subjects,
          join_date: formData.value.joinDate,
          active: formData.value.active
        }
        if (showEditModal.value && editingId.value) {
          await api.put(`/api/teachers/${editingId.value}`, teacherData)
        } else {
          await api.post('/api/teachers', teacherData)
        }
        closeModal()
        await loadTeachers()
      } catch (err) {
        const msg = err.message || 'Error saving teacher'
        error.value = msg
        alert(msg)
      }
    }

    const closeModal = () => {
      showCreateModal.value = false
      showEditModal.value = false
      editingId.value = null
      formData.value = {
        name: '',
        contact: '',
        bank_acct: '',
        qualifications_desc: '',
        subjects: [],
        joinDate: new Date().toISOString().split('T')[0],
        active: true
      }
      newSubject.value = ''
      error.value = ''
    }

    onMounted(() => {
      loadTeachers()
    })

    return {
      loading,
      teachers,
      showCreateModal,
      showEditModal,
      selectedTeacher,
      formData,
      error,
      newSubject,
      editingId,
      formatDate,
      addSubject,
      removeSubject,
      editTeacher,
      viewTeacher,
      deleteTeacher,
      saveTeacher,
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
