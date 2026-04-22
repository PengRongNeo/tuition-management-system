<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Admin Login</h1>
      <div v-if="notice" class="notice">{{ notice }}</div>
      <form @submit.prevent="login">
        <div class="form-group">
          <label>Email</label>
          <input
            type="email"
            v-model="email"
            required
            placeholder="admin@example.com"
          />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input
            type="password"
            v-model="password"
            required
            placeholder="Enter your password"
          />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { api } from '../api'
import { auth } from '../firebase'

export default {
  name: 'LoginView',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const router = useRouter()
    const route = useRoute()
    const notice = ref(
      route.query.reason === 'session-expired'
        ? 'Session expired. Please log in again.'
        : ''
    )

    const login = async () => {
      error.value = ''
      loading.value = true
      try {
        const { token } = await api.post('/api/auth/login', {
          email: email.value,
          password: password.value
        })
        api.setToken(token)
        try {
          await signInWithEmailAndPassword(auth, email.value, password.value)
        } catch (firebaseErr) {
          console.warn(
            '[auth] Firebase client sign-in failed; Firestore rules requiring request.auth will block this session.',
            firebaseErr
          )
        }
        router.push('/dashboard')
      } catch (err) {
        console.error('[login] failed', err)
        // Network failure (no HTTP response) — almost always a wrong API URL
        // or a blocked CORS preflight. api.js already produced a descriptive
        // message so we surface it; otherwise fall back to a generic one.
        if (!err.status) {
          error.value =
            err.message ||
            'Could not reach backend. Check API URL or CORS.'
        } else if (err.status === 401) {
          error.value = 'Invalid credentials. Please try again.'
        } else {
          error.value = err.message || 'Login failed. Please try again.'
        }
      } finally {
        loading.value = false
      }
    }

    return {
      email,
      password,
      error,
      loading,
      notice,
      login
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
}

.login-card {
  background: var(--color-surface);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 400px;
  border: 1px solid var(--color-border);
}

.login-card h1 {
  margin-bottom: 28px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.login-card button {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
}

.notice {
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.875rem;
  line-height: 1.4;
  border: 1px solid #fde68a;
}
</style>
