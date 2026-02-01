<template>
  <nav class="navbar">
    <div class="navbar-content">
      <router-link to="/dashboard" class="navbar-brand">
        <span class="navbar-brand-text">Tuition Management</span>
      </router-link>
      <div class="navbar-links">
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/classes">Classes</router-link>
        <router-link to="/teachers">Teachers</router-link>
        <router-link to="/students">Students & Fees</router-link>
        <button @click="logout" class="btn btn-secondary btn-nav-logout">Logout</button>
      </div>
    </div>
  </nav>
</template>

<script>
import { useRouter } from 'vue-router'
import { api } from '../api'

export default {
  name: 'Navbar',
  setup() {
    const router = useRouter()

    const logout = () => {
      api.clearToken()
      router.push('/login')
    }

    return {
      logout
    }
  }
}
</script>

<style scoped>
.navbar-brand {
  text-decoration: none;
  color: var(--color-text);
}

.navbar-brand-text {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.navbar-brand:hover .navbar-brand-text {
  color: var(--color-primary);
}

.btn-nav-logout {
  font-size: 0.875rem;
}
</style>
