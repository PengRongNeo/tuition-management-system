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
        <router-link to="/past-data">View Past Data</router-link>
        <button @click="logout" class="btn btn-secondary btn-nav-logout">Logout</button>
      </div>
    </div>
  </nav>
</template>

<script>
import { useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import { api } from '../api'
import { auth } from '../firebase'
import { useAdminData } from '../composables/useAdminData'

export default {
  name: 'Navbar',
  setup() {
    const router = useRouter()
    const { clearAdminData } = useAdminData()

    const logout = async () => {
      clearAdminData()
      api.clearToken()
      try {
        await signOut(auth)
      } catch (err) {
        console.warn('[auth] Firebase signOut failed:', err)
      }
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

/* -- Mobile (<= 768px) ----------------------------------------------------
   The navbar already wraps via the global .navbar-content rule. On phones
   the four nav links + logout don't fit on a single row, so we turn the
   links row into a horizontally-scrollable strip that keeps every link
   reachable without a hamburger menu (which would change behavior). */
@media (max-width: 768px) {
  :deep(.navbar-content) {
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 0;
  }
  :deep(.navbar-links) {
    width: 100%;
    justify-content: flex-start;
    gap: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
  }
  :deep(.navbar-links::-webkit-scrollbar) {
    display: none;
  }
  :deep(.navbar-links a) {
    flex: 0 0 auto;
    padding: 8px 12px;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  :deep(.navbar-links .btn) {
    margin-left: auto;
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .navbar-brand-text {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  :deep(.navbar-links a) {
    padding: 8px 10px;
  }
}
</style>
