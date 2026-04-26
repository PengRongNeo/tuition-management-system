<template>
  <section class="pending-section">
    <header class="pending-header">
      <div>
        <h2>
          Pending Students
          <span class="pending-badge">{{ pendingStudents.length }} pending</span>
        </h2>
        <p class="pending-subtitle">
          Review new enrolment submissions before adding them to the student list.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-secondary btn-sm refresh-btn"
        :disabled="loading || refreshBusy"
        @click="loadPendingStudents"
      >
        {{ refreshBusy || loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <div v-if="successMessage" class="toast toast-success" role="status">
      {{ successMessage }}
    </div>

    <div v-if="loading && pendingStudents.length === 0" class="card pending-card">
      <p class="pending-empty">Loading pending submissions…</p>
    </div>
    <div v-else-if="loadError" class="card pending-card">
      <p class="pending-error">{{ loadError }}</p>
    </div>
    <div v-else-if="pendingStudents.length === 0" class="card pending-card">
      <p class="pending-empty">No pending student submissions.</p>
    </div>
    <div v-else class="card pending-card">
      <div class="pending-table-scroll">
        <table class="table pending-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Submitted School</th>
              <th class="col-official-school">Official School</th>
              <th>Level</th>
              <th>Parent Name</th>
              <th>Parent Contact</th>
              <th>Requested Classes</th>
              <th class="col-pending-actions actions-column-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in pendingStudents" :key="student.id">
              <td>
                <div class="name-cell">
                  <span class="student-name">{{ student.studentName || '—' }}</span>
                  <span class="status-pill">Pending</span>
                </div>
              </td>
              <td>
                <span class="submitted-school">
                  {{ student.submittedSchool || '—' }}
                </span>
              </td>
              <td class="col-official-school">
                <SearchableSchoolSelect
                  :model-value="student.officialSchool"
                  :id="`pending-school-${student.id}`"
                  placeholder="Select official school"
                  @update:model-value="onOfficialSchoolChange(student, $event)"
                />
                <p v-if="rowErrors[student.id]" class="row-error">
                  {{ rowErrors[student.id] }}
                </p>
              </td>
              <td>{{ student.level || '—' }}</td>
              <td>{{ student.parentName || '—' }}</td>
              <td>{{ student.parentContact || '—' }}</td>
              <td class="requested-classes">{{ student.requestedClasses || '—' }}</td>
              <td class="col-pending-actions">
                <div class="pending-actions">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="busyId === student.id"
                    @click="openReviewModal(student)"
                  >
                    Review / Add
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="busyId === student.id"
                    @click="openEditPendingModal(student)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    :disabled="busyId === student.id"
                    @click="deletePendingStudent(student)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Review / Add modal -->
    <div v-if="reviewing" class="modal-overlay" @click="closeReview">
      <div class="modal-content review-modal" @click.stop>
        <header class="review-header">
          <div>
            <h2>Review Pending Submission</h2>
            <p class="review-subtitle">
              Confirm details on the right before adding this student to the main list.
            </p>
          </div>
          <button
            type="button"
            class="modal-close"
            aria-label="Close review"
            @click="closeReview"
          >
            ×
          </button>
        </header>

        <div class="review-grid">
          <!-- Left: submitted details -->
          <section class="review-card review-card-readonly">
            <h3>Submitted Details</h3>
            <dl class="review-dl">
              <div><dt>Student Name</dt><dd>{{ reviewing.studentName || '—' }}</dd></div>
              <div><dt>Submitted School</dt><dd class="submitted-school">{{ reviewing.submittedSchool || '—' }}</dd></div>
              <div><dt>Level</dt><dd>{{ reviewing.level || '—' }}</dd></div>
              <div><dt>Parent Name</dt><dd>{{ reviewing.parentName || '—' }}</dd></div>
              <div><dt>Parent Contact</dt><dd>{{ reviewing.parentContact || '—' }}</dd></div>
              <div><dt>Requested Classes</dt><dd>{{ reviewing.requestedClasses || '—' }}</dd></div>
              <div><dt>Submitted At</dt><dd>{{ formatSubmittedAt(reviewing.submittedAt) }}</dd></div>
            </dl>
          </section>

          <!-- Right: editable create form -->
          <section class="review-card">
            <h3>Create Student</h3>
            <form @submit.prevent="submitReview" class="review-form">
              <div class="form-group">
                <label>Student Name *</label>
                <input v-model="reviewForm.name" required />
              </div>
              <div class="form-group">
                <label :for="`review-school-${reviewing.id}`">Official School *</label>
                <SearchableSchoolSelect
                  :id="`review-school-${reviewing.id}`"
                  v-model="reviewForm.school"
                  placeholder="Search or select school"
                />
              </div>
              <div class="form-group">
                <label :for="`review-level-${reviewing.id}`">Level *</label>
                <select :id="`review-level-${reviewing.id}`" v-model="reviewForm.level" required>
                  <option value="" disabled>Select level</option>
                  <option v-for="lvl in studentLevels" :key="lvl" :value="lvl">{{ lvl }}</option>
                  <option
                    v-if="reviewForm.level && !studentLevels.includes(reviewForm.level)"
                    :value="reviewForm.level"
                  >
                    {{ reviewForm.level }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Parent Name *</label>
                <input v-model="reviewForm.parent_name" required />
              </div>
              <div class="form-group">
                <label>Parent Contact *</label>
                <input v-model="reviewForm.parent_contact" type="tel" required />
              </div>
              <div class="form-group">
                <label>Parent Email</label>
                <input v-model="reviewForm.parent_email" type="email" />
              </div>
              <div class="form-group">
                <label>Status *</label>
                <select v-model="reviewForm.status" required>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <p v-if="reviewing.requestedClasses" class="form-note">
                <strong>Requested classes:</strong> {{ reviewing.requestedClasses }}
                <br />
                <span class="form-note-muted">
                  You can assign classes later from the new student's View Details page.
                </span>
              </p>

              <p v-if="reviewError" class="error">{{ reviewError }}</p>

              <div class="modal-actions">
                <button type="submit" class="btn btn-primary" :disabled="reviewBusy">
                  {{ reviewBusy ? 'Adding…' : 'Add Student' }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="reviewBusy"
                  @click="closeReview"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>

    <!-- Edit pending modal -->
    <div v-if="editing" class="modal-overlay" @click="closeEdit">
      <div class="modal-content" @click.stop>
        <header class="edit-header">
          <div>
            <h2>Edit Pending Student</h2>
            <p class="review-subtitle">
              Update the submitted details. This keeps the record as pending.
            </p>
          </div>
          <button
            type="button"
            class="modal-close"
            aria-label="Close edit"
            @click="closeEdit"
          >
            ×
          </button>
        </header>

        <form @submit.prevent="saveEdit" class="edit-form">
          <div class="form-group">
            <label>Student Name</label>
            <input v-model="editForm.studentName" />
          </div>
          <div class="form-group">
            <label>Submitted School</label>
            <input v-model="editForm.submittedSchool" />
          </div>
          <div class="form-group">
            <label :for="`edit-official-school-${editing.id}`">Official School</label>
            <SearchableSchoolSelect
              :id="`edit-official-school-${editing.id}`"
              v-model="editForm.officialSchool"
              placeholder="Select official school"
            />
          </div>
          <div class="form-group">
            <label :for="`edit-level-${editing.id}`">Level</label>
            <select :id="`edit-level-${editing.id}`" v-model="editForm.level">
              <option value="">Select level</option>
              <option v-for="lvl in studentLevels" :key="lvl" :value="lvl">{{ lvl }}</option>
              <option
                v-if="editForm.level && !studentLevels.includes(editForm.level)"
                :value="editForm.level"
              >
                {{ editForm.level }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Parent Name</label>
            <input v-model="editForm.parentName" />
          </div>
          <div class="form-group">
            <label>Parent Contact</label>
            <input v-model="editForm.parentContact" type="tel" />
          </div>
          <div class="form-group">
            <label>Requested Classes</label>
            <textarea v-model="editForm.requestedClasses" rows="2" />
          </div>

          <p v-if="editError" class="error">{{ editError }}</p>

          <div class="modal-actions">
            <button type="submit" class="btn btn-primary" :disabled="editBusy">
              {{ editBusy ? 'Saving…' : 'Save Changes' }}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="editBusy"
              @click="closeEdit"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import SearchableSchoolSelect from './SearchableSchoolSelect.vue'
import { STUDENT_LEVELS } from '../constants/studentOptions'
import { useAdminData } from '../composables/useAdminData'

export default {
  name: 'PendingStudentsTable',
  components: { SearchableSchoolSelect },
  emits: ['approved', 'removed', 'updated'],
  setup(_, { emit }) {
    const {
      pendingStudents,
      loadAdminData,
      refreshPendingStudents,
      isLoaded,
      isLoading
    } = useAdminData()
    const loading = computed(() => isLoading.value && !isLoaded.value)
    const refreshBusy = ref(false)
    const loadError = ref('')
    const rowErrors = ref({})
    const busyId = ref(null)
    const successMessage = ref('')
    let successTimer = null

    const reviewing = ref(null)
    const reviewForm = ref(emptyReviewForm())
    const reviewBusy = ref(false)
    const reviewError = ref('')

    const editing = ref(null)
    const editForm = ref(emptyEditForm())
    const editBusy = ref(false)
    const editError = ref('')

    function emptyReviewForm() {
      return {
        name: '',
        school: '',
        level: '',
        parent_name: '',
        parent_contact: '',
        parent_email: '',
        status: 'active'
      }
    }

    function emptyEditForm() {
      return {
        studentName: '',
        submittedSchool: '',
        officialSchool: '',
        level: '',
        parentName: '',
        parentContact: '',
        requestedClasses: ''
      }
    }

    const toDate = (value) => {
      if (!value) return null
      if (value?.toDate) return value.toDate()
      if (typeof value === 'number') return new Date(value)
      if (typeof value === 'string') {
        const d = new Date(value)
        return Number.isNaN(d.getTime()) ? null : d
      }
      if (value?.seconds != null) return new Date(value.seconds * 1000)
      return null
    }

    const formatSubmittedAt = (value) => {
      const date = toDate(value)
      if (!date) return '—'
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }

    const flashSuccess = (message) => {
      successMessage.value = message
      if (successTimer) clearTimeout(successTimer)
      successTimer = setTimeout(() => {
        successMessage.value = ''
      }, 4000)
    }

    const setRowError = (id, message) => {
      rowErrors.value = { ...rowErrors.value, [id]: message }
    }

    const clearRowError = (id) => {
      if (!rowErrors.value[id]) return
      const next = { ...rowErrors.value }
      delete next[id]
      rowErrors.value = next
    }

    async function loadPendingStudents() {
      loadError.value = ''
      refreshBusy.value = true
      try {
        if (typeof auth.authStateReady === 'function') {
          await auth.authStateReady()
        }
        if (!auth.currentUser) {
          loadError.value = 'Session expired. Please log in again.'
          return
        }
        await refreshPendingStudents()
      } catch (err) {
        console.error('Error loading pending students:', err)
        loadError.value =
          err?.code === 'permission-denied'
            ? 'Unable to read pendingStudents. Check Firestore security rules allow reads of this collection.'
            : err?.message || 'Failed to load pending students.'
      } finally {
        refreshBusy.value = false
      }
    }

    async function onOfficialSchoolChange(student, nextValue) {
      const value = (nextValue || '').trim()
      const previous = student.officialSchool || ''
      if (value === previous) return
      student.officialSchool = value
      clearRowError(student.id)
      try {
        await updateDoc(doc(db, 'pendingStudents', student.id), {
          officialSchool: value
        })
      } catch (err) {
        console.error('Failed to persist officialSchool:', err)
        student.officialSchool = previous
        setRowError(
          student.id,
          err?.code === 'permission-denied'
            ? 'Permission denied saving official school.'
            : 'Could not save official school. Please try again.'
        )
      }
    }

    function openReviewModal(student) {
      clearRowError(student.id)
      reviewError.value = ''
      reviewing.value = student
      reviewForm.value = {
        name: student.studentName || '',
        school: student.officialSchool || '',
        level: student.level || '',
        parent_name: student.parentName || '',
        parent_contact: student.parentContact || '',
        parent_email: student.parentEmail || '',
        status: 'active'
      }
    }

    function closeReview() {
      if (reviewBusy.value) return
      reviewing.value = null
      reviewForm.value = emptyReviewForm()
      reviewError.value = ''
    }

    async function submitReview() {
      if (!reviewing.value) return
      reviewError.value = ''
      const f = reviewForm.value
      const missing = []
      if (!f.name?.trim()) missing.push('Student Name')
      if (!f.school?.trim()) missing.push('Official School')
      if (!f.level?.trim()) missing.push('Level')
      if (!f.parent_name?.trim()) missing.push('Parent Name')
      if (!f.parent_contact?.trim()) missing.push('Parent Contact')
      if (missing.length > 0) {
        reviewError.value = `Please fill in: ${missing.join(', ')}.`
        return
      }

      reviewBusy.value = true
      const pendingId = reviewing.value.id
      try {
        const newStudentRef = await addDoc(collection(db, 'students'), {
          name: f.name.trim(),
          school: f.school.trim(),
          level: f.level.trim(),
          parent_name: f.parent_name.trim(),
          parent_contact: f.parent_contact.trim(),
          parent_email: (f.parent_email || '').trim(),
          status: f.status || 'active',
          source: 'pending_form',
          pending_id: pendingId,
          created_at: serverTimestamp()
        })
        await updateDoc(doc(db, 'pendingStudents', pendingId), {
          status: 'approved',
          officialSchool: f.school.trim(),
          approvedAt: serverTimestamp(),
          createdStudentId: newStudentRef.id
        })
        pendingStudents.value = pendingStudents.value.filter((p) => p.id !== pendingId)
        clearRowError(pendingId)
        reviewing.value = null
        reviewForm.value = emptyReviewForm()
        flashSuccess('Student added successfully.')
        emit('approved', { pendingId, studentId: newStudentRef.id })
      } catch (err) {
        console.error('Error approving pending student:', err)
        reviewError.value =
          err?.code === 'permission-denied'
            ? 'Permission denied. Firestore rules do not allow this write.'
            : err?.message || 'Failed to add student.'
      } finally {
        reviewBusy.value = false
      }
    }

    function openEditPendingModal(student) {
      clearRowError(student.id)
      editError.value = ''
      editing.value = student
      editForm.value = {
        studentName: student.studentName || '',
        submittedSchool: student.submittedSchool || '',
        officialSchool: student.officialSchool || '',
        level: student.level || '',
        parentName: student.parentName || '',
        parentContact: student.parentContact || '',
        requestedClasses: student.requestedClasses || ''
      }
    }

    function closeEdit() {
      if (editBusy.value) return
      editing.value = null
      editForm.value = emptyEditForm()
      editError.value = ''
    }

    async function saveEdit() {
      if (!editing.value) return
      editError.value = ''
      editBusy.value = true
      const id = editing.value.id
      const payload = {
        studentName: (editForm.value.studentName || '').trim(),
        submittedSchool: (editForm.value.submittedSchool || '').trim(),
        officialSchool: (editForm.value.officialSchool || '').trim(),
        level: (editForm.value.level || '').trim(),
        parentName: (editForm.value.parentName || '').trim(),
        parentContact: (editForm.value.parentContact || '').trim(),
        requestedClasses: (editForm.value.requestedClasses || '').trim()
      }
      try {
        await updateDoc(doc(db, 'pendingStudents', id), payload)
        const idx = pendingStudents.value.findIndex((p) => p.id === id)
        if (idx !== -1) {
          pendingStudents.value[idx] = { ...pendingStudents.value[idx], ...payload }
        }
        editing.value = null
        editForm.value = emptyEditForm()
        flashSuccess('Pending student updated.')
        emit('updated', { pendingId: id })
      } catch (err) {
        console.error('Error updating pending student:', err)
        editError.value =
          err?.code === 'permission-denied'
            ? 'Permission denied. Firestore rules do not allow this update.'
            : err?.message || 'Failed to update pending student.'
      } finally {
        editBusy.value = false
      }
    }

    async function deletePendingStudent(student) {
      if (!confirm('Are you sure you want to delete this pending student submission?')) {
        return
      }
      busyId.value = student.id
      clearRowError(student.id)
      try {
        await updateDoc(doc(db, 'pendingStudents', student.id), {
          status: 'rejected',
          rejectedAt: serverTimestamp()
        })
        pendingStudents.value = pendingStudents.value.filter((p) => p.id !== student.id)
        flashSuccess('Pending student removed.')
        emit('removed', { pendingId: student.id })
      } catch (err) {
        console.error('Error rejecting pending student:', err)
        setRowError(
          student.id,
          err?.code === 'permission-denied'
            ? 'Permission denied. Firestore rules do not allow this update.'
            : err?.message || 'Failed to remove pending student.'
        )
      } finally {
        busyId.value = null
      }
    }

    onMounted(() => {
      void loadAdminData()
    })

    return {
      pendingStudents,
      loading,
      refreshBusy,
      loadError,
      rowErrors,
      busyId,
      successMessage,
      studentLevels: STUDENT_LEVELS,
      reviewing,
      reviewForm,
      reviewBusy,
      reviewError,
      editing,
      editForm,
      editBusy,
      editError,
      loadPendingStudents,
      onOfficialSchoolChange,
      openReviewModal,
      closeReview,
      submitReview,
      openEditPendingModal,
      closeEdit,
      saveEdit,
      deletePendingStudent,
      formatSubmittedAt
    }
  }
}
</script>

<style scoped>
.pending-section {
  margin-top: 48px;
}

.pending-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.pending-header h2 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-text, #1e293b);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pending-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.pending-subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted, #64748b);
  font-size: 0.9375rem;
}

.refresh-btn {
  flex-shrink: 0;
}

.toast {
  padding: 10px 14px;
  border-radius: var(--radius-md, 8px);
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 12px;
}

.toast-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.pending-card {
  padding: 0;
  overflow: hidden;
}

.pending-empty,
.pending-error {
  padding: 28px 24px;
  margin: 0;
  text-align: center;
  font-size: 0.9375rem;
}

.pending-empty {
  color: var(--color-text-muted, #64748b);
}

.pending-error {
  color: #b91c1c;
  background: #fef2f2;
}

.pending-table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.pending-table {
  min-width: 1200px;
  width: 100%;
  margin: 0;
}

.pending-table :deep(thead th) {
  white-space: nowrap;
  vertical-align: middle;
  background: var(--color-background, #f8fafc);
}

.pending-table :deep(tbody td) {
  vertical-align: top;
}

.col-official-school {
  min-width: 280px;
}

.pending-table :deep(.col-pending-actions) {
  min-width: 170px;
  position: sticky;
  right: 0;
  background: var(--color-surface, #ffffff);
  box-shadow: -1px 0 0 0 var(--color-border, #e2e8f0);
  z-index: 2;
}

.pending-table :deep(thead .col-pending-actions),
.pending-table :deep(thead .actions-column-header) {
  z-index: 3;
  background: var(--color-background, #f8fafc);
}

.pending-table :deep(tbody tr:hover .col-pending-actions) {
  background: var(--color-primary-light, #eef2ff);
}

.name-cell {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.student-name {
  font-weight: 600;
  color: var(--color-text, #1e293b);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.submitted-school {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--color-background, #f1f5f9);
  color: var(--color-text, #334155);
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 0.85rem;
  max-width: 220px;
  word-break: break-word;
  white-space: normal;
}

.requested-classes {
  max-width: 220px;
  white-space: normal;
  word-break: break-word;
  color: var(--color-text, #334155);
}

.pending-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.pending-actions .btn {
  width: 100%;
  white-space: nowrap;
}

.row-error {
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm, 6px);
  background: #fee2e2;
  color: #991b1b;
  font-size: 0.8125rem;
  line-height: 1.3;
}

/* === Modals === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 32px 16px;
  overflow-y: auto;
  z-index: 1000;
}

.modal-content {
  background: var(--color-surface, #ffffff);
  padding: 28px;
  border-radius: var(--radius-lg, 12px);
  max-width: 520px;
  width: 100%;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.review-modal {
  max-width: 1040px;
}

.review-header,
.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
}

.review-header h2,
.edit-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.review-subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted, #64748b);
  font-size: 0.875rem;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 1.75rem;
  line-height: 1;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  padding: 0 4px;
}

.modal-close:hover {
  color: var(--color-text, #1e293b);
}

.review-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .review-grid {
    grid-template-columns: 1fr;
  }
}

.review-card {
  background: var(--color-background, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 10px);
  padding: 20px;
}

.review-card h3 {
  margin: 0 0 14px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text, #1e293b);
}

.review-card-readonly {
  background: #f8fafc;
}

.review-dl {
  margin: 0;
  display: grid;
  gap: 12px;
}

.review-dl > div {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 8px;
  align-items: start;
}

.review-dl dt {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.review-dl dd {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text, #1e293b);
  word-break: break-word;
}

@media (max-width: 640px) {
  .review-dl > div {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

.review-form .form-group,
.edit-form .form-group {
  margin-bottom: 14px;
}

.form-note {
  margin: 4px 0 16px;
  padding: 10px 12px;
  background: #eef2ff;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.8125rem;
  color: #3730a3;
  line-height: 1.4;
}

.form-note-muted {
  color: #4338ca;
  opacity: 0.85;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 8px 12px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  margin-bottom: 12px;
}

@media (max-width: 640px) {
  .pending-header {
    flex-direction: column;
    align-items: stretch;
  }
  .refresh-btn {
    align-self: flex-start;
  }
  .modal-actions .btn {
    width: 100%;
  }
}
</style>
