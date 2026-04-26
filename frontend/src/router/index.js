import { createRouter, createWebHistory } from 'vue-router'
import { api } from '../api'
import { loadAdminData } from '../composables/useAdminData'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/classes',
    name: 'Classes',
    component: () => import('../views/ClassesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/class/:id',
    name: 'Class',
    component: () => import('../views/ClassView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/lesson/:classId',
    name: 'LessonSubmission',
    component: () => import('../views/LessonSubmissionView.vue')
  },
  {
    path: '/students',
    name: 'Students',
    component: () => import('../views/StudentsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/teachers',
    name: 'Teachers',
    component: () => import('../views/TeachersView.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
  const token = api.getToken()

  if (requiresAuth && !token) {
    next('/login')
  } else if (requiresGuest && token) {
    next('/dashboard')
  } else {
    if (requiresAuth && token) {
      void loadAdminData()
    }
    next()
  }
})

export default router
