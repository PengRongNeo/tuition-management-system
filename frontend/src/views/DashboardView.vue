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
          <h3>Revenue Thus Far</h3>
          <p class="stat-number">{{ formatCurrency(revenueThusFar) }}</p>
          <p class="stat-subtitle">Based on chargeable attendance records</p>
        </div>
      </div>

      <div class="card card-chart">
        <h2>Weekly Revenue</h2>
        <p class="card-subtitle">Grouped by Monday of each week</p>
        <div v-if="loading" class="loading">Loading...</div>
        <div v-else-if="weeklyRevenue.length === 0" class="loading">
          No weekly revenue data yet.
        </div>
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
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Navbar from '../components/Navbar.vue'
import { api } from '../api'
import { Chart, registerables } from 'chart.js'
import { isPresentLike } from '../constants/attendance'

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
    const revenueThusFar = ref(0)
    const recentLessons = ref([])
    const weeklyRevenue = ref([])

    const currencyFormatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0)
    const chartCanvas = ref(null)
    let chartInstance = null

    const formatDate = (timestamp) => {
      if (!timestamp) return ''
      const date = typeof timestamp === 'string' ? new Date(timestamp) : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp))
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const getPresentCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.filter(a => isPresentLike(a?.status)).length
    }

    const getTotalCount = (attendance) => {
      if (!attendance || !Array.isArray(attendance)) return 0
      return attendance.length
    }

    // Lightweight plugin that paints a "$X.XX" label above each line point.
    // We don't depend on chartjs-plugin-datalabels.
    const pointValueLabelsPlugin = {
      id: 'pointValueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart
        const meta = chart.getDatasetMeta(0)
        if (!meta || !Array.isArray(meta.data)) return
        const dataset = chart.data.datasets[0]
        if (!dataset) return
        ctx.save()
        ctx.font = '600 11px Inter, system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#1e293b'
        meta.data.forEach((point, idx) => {
          const raw = Number(dataset.data[idx]) || 0
          const label = `$${raw.toFixed(2)}`
          const x = point.x
          const y = point.y - 10
          ctx.fillText(label, x, y)
        })
        ctx.restore()
      }
    }

    const renderWeeklyRevenueChart = (entries) => {
      if (!chartCanvas.value) return
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
      const labels = entries.map((e) => e.weekLabel)
      const values = entries.map((e) => Number(e.revenue) || 0)
      chartInstance = new Chart(chartCanvas.value, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Revenue ($)',
            data: values,
            borderColor: 'rgba(79, 70, 229, 1)',
            backgroundColor: 'rgba(79, 70, 229, 0.15)',
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgba(79, 70, 229, 1)',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
          }]
        },
        plugins: [pointValueLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2,
          layout: {
            // Extra top padding so point value labels aren't clipped.
            padding: { top: 24, right: 12, bottom: 0, left: 0 }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items?.[0]?.dataIndex ?? 0
                  const label = entries[idx]?.weekLabel || ''
                  return `Week of ${label}`
                },
                label: (ctx) => `Revenue: $${Number(ctx.raw || 0).toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              ticks: {
                autoSkip: true,
                maxRotation: 45,
                minRotation: 0
              }
            },
            y: {
              beginAtZero: true,
              ticks: { callback: (value) => '$' + value }
            }
          }
        }
      })
    }

    const loadDashboardData = async () => {
      try {
        const data = await api.get('/api/dashboard')
        totalClasses.value = data.totalClasses ?? 0
        totalStudents.value = data.totalStudents ?? 0
        revenueThusFar.value = data.revenueThusFar ?? data.monthlyRevenue ?? 0
        weeklyClassesCount.value = data.weeklyClassesCount ?? 0
        recentLessons.value = data.recentLessons ?? []
        weeklyRevenue.value = Array.isArray(data.revenueByWeek) ? data.revenueByWeek : []
        loading.value = false
        // Canvas is only in the DOM after loading becomes false, so wait a tick
        // before touching the chart.
        await nextTick()
        if (weeklyRevenue.value.length > 0) {
          renderWeeklyRevenueChart(weeklyRevenue.value)
        } else if (chartInstance) {
          chartInstance.destroy()
          chartInstance = null
        }
      } catch (err) {
        console.error('Error loading dashboard:', err)
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
      revenueThusFar,
      recentLessons,
      weeklyRevenue,
      chartCanvas,
      formatDate,
      formatCurrency,
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
.card-stat .stat-subtitle { margin-top: 6px; font-size: 0.8125rem; color: var(--color-text-muted); }
.card-chart .chart-container { position: relative; max-width: 100%; min-height: 300px; margin-top: 8px; }
.card-chart .card-subtitle { margin: 4px 0 12px; font-size: 0.8125rem; color: var(--color-text-muted); }
.btn-sm { padding: 6px 12px; font-size: 0.8125rem; }
</style>
