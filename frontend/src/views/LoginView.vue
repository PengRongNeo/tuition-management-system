<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Admin Login</h1>
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
import { useRouter } from 'vue-router'
import { api } from '../api'

export default {
  name: 'LoginView',
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const router = useRouter()

    const login = async () => {
      error.value = ''
      loading.value = true
      try {
        const { token } = await api.post('/api/auth/login', { email: email.value, password: password.value })
        api.setToken(token)
        router.push('/dashboard')
      } catch (err) {
        error.value = err.message || 'Invalid credentials. Please try again.'
      } finally {
        loading.value = false
      }
    }

    return {
      email,
      password,
      error,
      loading,
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
</style>
