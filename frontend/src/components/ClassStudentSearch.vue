<template>
  <div class="class-student-search">
    <input
      v-model="query"
      type="search"
      class="class-student-search-input"
      :placeholder="placeholder"
      autocomplete="off"
      @keydown.enter.prevent
    />
    <p v-if="hint" class="class-student-search-hint">
      {{ hint }}
    </p>
    <ul
      v-if="query.trim() && visibleOptions.length"
      class="class-student-search-list"
    >
      <li
        v-for="s in visibleOptions"
        :key="s.id"
        :class="['class-student-search-item', { inactive: !isActive(s) }]"
        @click="onPick(s)"
      >
        <div>
          <span class="cname">{{ s.name || '—' }}</span>
          <span
            v-if="statusClass(s)"
            :class="['st-badge', statusClass(s)]"
          >{{ statusLabel(s) }}</span>
        </div>
        <div class="cmeta">
          <span v-if="s.level">{{ s.level }}</span>
          <span v-if="s.school"> · {{ s.school }}</span>
          <span v-if="s.parent_contact"> · {{ s.parent_contact }}</span>
        </div>
      </li>
    </ul>
    <p
      v-else-if="query.trim() && !visibleOptions.length"
      class="class-student-search-empty"
    >
      No matches.
    </p>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import {
  isStudentActive,
  getStudentStatusRank,
  getStudentStatusLabel,
  getStudentStatusClass
} from '../constants/studentStatus'

export default {
  name: 'ClassStudentSearch',
  props: {
    students: {
      type: Array,
      default: () => []
    },
    /**
     * Student ids that cannot be chosen (e.g. already in chips / already enrolled)
     */
    disabledIds: {
      type: Object, // Set-like: we use Array or Set in parent
      default: null
    },
    placeholder: {
      type: String,
      default: 'Search by name, level, school, or parent contact…'
    },
    hint: {
      type: String,
      default: ''
    },
    maxResults: {
      type: Number,
      default: 50
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const query = ref('')

    const disabled = computed(() => {
      if (!props.disabledIds) return new Set()
      if (props.disabledIds instanceof Set) return props.disabledIds
      return new Set(
        Array.isArray(props.disabledIds) ? props.disabledIds : []
      )
    })

    const sorted = computed(() => {
      const list = [...(props.students || [])]
      return list.sort((a, b) => {
        const d = getStudentStatusRank(a) - getStudentStatusRank(b)
        if (d !== 0) return d
        return (a.name || '').localeCompare(b.name || '', undefined, {
          sensitivity: 'base'
        })
      })
    })

    const visibleOptions = computed(() => {
      const term = query.value.trim().toLowerCase()
      if (!term) return []
      const ex = disabled.value
      return sorted.value
        .filter((s) => s.id && !ex.has(s.id))
        .filter((s) => {
          const hay = [s.name, s.school, s.level, s.parent_contact, s.parent_name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return hay.includes(term)
        })
        .slice(0, props.maxResults)
    })

    const isActive = (s) => isStudentActive(s)
    const statusLabel = (s) => getStudentStatusLabel(s) || '—'
    const statusClass = (s) => {
      const c = getStudentStatusClass(s)
      if (!c) return ''
      if (c.includes('success')) return 'st-ok'
      if (c.includes('muted') || c.includes('secondary')) return 'st-inactive'
      return 'st-warn'
    }

    const onPick = (s) => {
      if (disabled.value.has(s.id)) return
      emit('select', s)
      query.value = ''
    }

    return {
      query,
      visibleOptions,
      onPick,
      isActive,
      statusLabel,
      statusClass
    }
  }
}
</script>

<style scoped>
.class-student-search-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
}
.class-student-search-hint {
  font-size: 0.8rem;
  color: #64748b;
  margin: 8px 0 0;
}
.class-student-search-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}
.class-student-search-item {
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.875rem;
}
.class-student-search-item:last-child {
  border-bottom: 0;
}
.class-student-search-item:hover {
  background: #f8fafc;
}
.class-student-search-item.inactive {
  opacity: 0.92;
}
.cname {
  font-weight: 600;
  color: #0f172a;
}
.cmeta {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 2px;
}
.st-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  vertical-align: middle;
}
.st-ok {
  background: #d1fae5;
  color: #047857;
}
.st-inactive {
  background: #e2e8f0;
  color: #475569;
}
.st-warn {
  background: #fef3c7;
  color: #b45309;
}
.class-student-search-empty {
  font-size: 0.85rem;
  color: #64748b;
  margin: 8px 0 0;
}
</style>
