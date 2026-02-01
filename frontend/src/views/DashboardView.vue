<template>
  <div>
    <Navbar />
    <div class="container">
      <header class="page-header">
        <h1>Admin Dashboard</h1>
        <p>Overview of classes, revenue, and recent lessons</p>
      </header>

      <div class="dashboard-stats grid grid-2">
        <div class="card card-stat card-stat-classes">
          <h3>Classes This Week</h3>
          <p class="stat-number">{{ weeklyClassesCount }}</p>
        </div>
        <div class="card card-stat card-stat-total">
          <h3>Total Classes</h3>
          <p class="stat-number">{{ totalClasses }}</p>
        </div>
        <div class="card card-stat card-stat-students">
          <h3>Total Students</h3>
          <p class="stat-number">{{ totalStudents }}</p>
        </div>
        <div class="card card-stat card-stat-revenue">
          <h3>Monthly Revenue</h3>
          <p class="stat-number">${{ monthlyRevenue.toFixed(2) }}</p>
        </div>
      </div>

      <div class="card card-chart">
        <h2>Revenue by Month</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else class="chart-container">
          <canvas ref="chartCanvas"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Recent Lesson Submissions</h2>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="recentLessons.length === 0" class="loading">
          No recent lessons
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Class</th>
              <th>Teacher</th>
              <th>Students Present</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lesson in recentLessons" :key="lesson.id">
              <td>{{ formatDate(lesson.lesson_date) }}</td>
              <td>{{ lesson.className }}</td>
              <td>{{ lesson.teacherName }}</td>
              <td>{{ getPresentCount(lesson.attendance) }} / {{ getTotalCount(lesson.attendance) }}</td>
              <td>
                <router-link :to="`/class/${lesson.class_id}`" class="btn btn-primary btn-sm">
                  View
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Navbar from '../components/Navbar.vue'
import { api } from '../api'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

export default {
  name: 'DashboardView',
  components: {
    Navbar
  },
  setup() {
    const loading = ref(true)
    const weeklyClassesCount = ref(0)
    const totalClasses = ref(0)
    const totalStudents = ref(0)
    const monthlyRevenue = ref(0)
    const recentLessons = ref([])
    const chartCanvas = ref(null)
    let chartInstance = null

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      const date = typeof timestamp === 'string' ? new Date(timestamp) : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp))
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const getPresentCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.filter(a => a.status === 'present' || a.status === 'late').length
    }

    const getTotalCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.length
    }

    const renderRevenueChart = (labels, data) => {
      if (!chartCanvas.value) return
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      chartInstance = new Chart(chartCanvas.value, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Revenue ($)',
            data,
            backgroundColor: 'rgba(79, 70, 229, 0.7)',
            borderColor: 'rgba(79, 70, 229, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `$${ctx.raw.toFixed(2)}` } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => '$' + value } }
          }
        }
      })
    }

    const loadDashboardData = async () => {
      try {
        const data = await api.get('/api/dashboard')
        totalClasses.value = data.totalClasses ?? 0
        totalStudents.value = data.totalStudents ?? 0
        monthlyRevenue.value = data.monthlyRevenue ?? 0
        weeklyClassesCount.value = data.weeklyClassesCount ?? 0
        recentLessons.value = data.recentLessons ?? []
        const rev = data.revenueByMonth
        if (rev?.labels?.length && rev?.values?.length) {
          renderRevenueChart(rev.labels, rev.values)
        }
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => loadDashboardData())
    onBeforeUnmount(() => {
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    })

    return {
      loading,
      weeklyClassesCount,
      totalClasses,
      totalStudents,
      monthlyRevenue,
      recentLessons,
      chartCanvas,
      formatDate,
      getPresentCount,
      getTotalCount
    }
  }
}
</script>

<style scoped>
.page-header h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.025em; }
.page-header p { margin-top: 4px; font-size: 0.9375rem; color: var(--color-text-muted); }
.card-stat { position: relative; padding-left: 20px; border-left: 4px solid var(--color-border); }
.card-stat-classes { border-left-color: #4f46e5; }
.card-stat-total { border-left-color: #0ea5e9; }
.card-stat-students { border-left-color: #059669; }
.card-stat-revenue { border-left-color: #8b5cf6; }
.card-stat .stat-number { font-size: 1.75rem; font-weight: 700; color: var(--color-text); letter-spacing: -0.02em; margin-top: 4px; }
.card-chart .chart-container { position: relative; max-width: 100%; min-height: 300px; margin-top: 8px; }
.btn-sm { padding: 6px 12px; font-size: 0.8125rem; }
</style>
