<template>
  <div
    class="ss-select"
    :class="{
      'ss-select--open': open,
      'ss-select--custom': isCustomValue,
      'ss-select--disabled': effectiveDisabled
    }"
    @keydown.escape.prevent="closeAndRevert"
  >
    <input
      ref="inputRef"
      :id="id"
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="activeId"
      aria-autocomplete="list"
      :placeholder="effectivePlaceholder"
      :value="query"
      :disabled="effectiveDisabled"
      :aria-disabled="effectiveDisabled"
      class="ss-select__input"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.down.prevent="moveActive(1)"
      @keydown.up.prevent="moveActive(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.tab="onTab"
    />

    <button
      type="button"
      class="ss-select__chevron"
      :aria-label="open ? 'Close list' : 'Open list'"
      tabindex="-1"
      :disabled="effectiveDisabled"
      @mousedown.prevent="toggleOpen"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path
          d="M5.25 7.5L10 12.25L14.75 7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <ul
      v-if="open"
      :id="listboxId"
      ref="listRef"
      class="ss-select__list"
      role="listbox"
    >
      <li
        v-if="filtered.length === 0"
        class="ss-select__empty"
        role="option"
        aria-disabled="true"
      >
        <template v-if="allowCustom && query.trim()">
          No matches — press Enter to use “{{ query.trim() }}”
        </template>
        <template v-else>
          No matches
        </template>
      </li>

      <li
        v-for="(opt, idx) in filtered"
        :key="opt"
        :id="optionId(idx)"
        :class="[
          'ss-select__option',
          { 'is-active': idx === activeIndex, 'is-selected': opt === modelValue }
        ]"
        role="option"
        :aria-selected="opt === modelValue"
        @mousedown.prevent="select(opt)"
        @mouseenter="activeIndex = idx"
      >
        <span class="ss-select__option-label">{{ opt }}</span>
        <span v-if="opt === modelValue" class="ss-select__check" aria-hidden="true">✓</span>
      </li>
    </ul>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { SECONDARY_SCHOOLS, getSchoolsByLevel } from '../constants/schools'

let uid = 0

export default {
  name: 'SearchableSchoolSelect',
  props: {
    modelValue: { type: String, default: '' },
    // When `level` is provided (even as an empty string) the component
    // switches to level-aware mode and derives its options from
    // getSchoolsByLevel(level). When level is undefined the component keeps
    // its legacy behaviour and uses the `options` prop as the source list.
    level: { type: String, default: undefined },
    options: { type: Array, default: () => SECONDARY_SCHOOLS },
    placeholder: { type: String, default: 'Search or select school' },
    id: { type: String, default: '' },
    allowCustom: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const inputRef = ref(null)
    const listRef = ref(null)
    const open = ref(false)
    const query = ref(props.modelValue || '')
    const activeIndex = ref(-1)
    const componentId = `ss-${++uid}`
    const listboxId = `${componentId}-listbox`
    const optionId = (idx) => `${componentId}-opt-${idx}`

    const isLevelAware = computed(() => props.level !== undefined)

    const effectiveOptions = computed(() => {
      if (isLevelAware.value) return getSchoolsByLevel(props.level)
      return props.options
    })

    const effectiveDisabled = computed(() => {
      if (props.disabled) return true
      if (isLevelAware.value && !(props.level && String(props.level).trim())) {
        return true
      }
      return false
    })

    const effectivePlaceholder = computed(() => {
      if (isLevelAware.value && !(props.level && String(props.level).trim())) {
        return 'Select level first'
      }
      return props.placeholder
    })

    watch(
      () => props.modelValue,
      (val) => {
        if (!open.value) query.value = val || ''
      }
    )

    // If the component becomes disabled (e.g. level cleared), make sure the
    // dropdown is hidden and the input is not focused.
    watch(
      effectiveDisabled,
      (isDisabled) => {
        if (isDisabled) {
          open.value = false
          if (inputRef.value) inputRef.value.blur()
        }
      }
    )

    const filtered = computed(() => {
      const q = query.value.trim().toLowerCase()
      if (!q) return effectiveOptions.value
      return effectiveOptions.value.filter((s) => s.toLowerCase().includes(q))
    })

    const isCustomValue = computed(() => {
      const v = (props.modelValue || '').trim()
      if (!v) return false
      return !effectiveOptions.value.some(
        (o) => o.toLowerCase() === v.toLowerCase()
      )
    })

    const activeId = computed(() =>
      activeIndex.value >= 0 && activeIndex.value < filtered.value.length
        ? optionId(activeIndex.value)
        : undefined
    )

    const scrollActiveIntoView = () => {
      nextTick(() => {
        const list = listRef.value
        if (!list) return
        const el = list.querySelector('.ss-select__option.is-active')
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' })
        }
      })
    }

    const openList = () => {
      if (effectiveDisabled.value) return
      open.value = true
      const currentIdx = filtered.value.findIndex(
        (o) => o.toLowerCase() === (props.modelValue || '').toLowerCase()
      )
      activeIndex.value = currentIdx >= 0 ? currentIdx : filtered.value.length > 0 ? 0 : -1
      scrollActiveIntoView()
    }

    const onFocus = () => {
      openList()
    }

    const onInput = (e) => {
      if (effectiveDisabled.value) return
      query.value = e.target.value
      if (!open.value) open.value = true
      activeIndex.value = filtered.value.length > 0 ? 0 : -1
      scrollActiveIntoView()
    }

    const moveActive = (delta) => {
      if (!open.value) {
        openList()
        return
      }
      const n = filtered.value.length
      if (n === 0) {
        activeIndex.value = -1
        return
      }
      activeIndex.value = (activeIndex.value + delta + n) % n
      scrollActiveIntoView()
    }

    const commit = (value) => {
      const next = (value ?? '').trim()
      query.value = next
      emit('update:modelValue', next)
    }

    const select = (opt) => {
      commit(opt)
      open.value = false
      if (inputRef.value) inputRef.value.blur()
    }

    const onEnter = () => {
      if (!open.value) {
        openList()
        return
      }
      if (activeIndex.value >= 0 && filtered.value[activeIndex.value]) {
        select(filtered.value[activeIndex.value])
      } else if (props.allowCustom && query.value.trim()) {
        commit(query.value)
        open.value = false
        if (inputRef.value) inputRef.value.blur()
      }
    }

    const closeAndRevert = () => {
      query.value = props.modelValue || ''
      open.value = false
      if (inputRef.value) inputRef.value.blur()
    }

    const onBlur = () => {
      setTimeout(() => {
        if (!open.value) return
        const typed = query.value.trim()
        const exactMatch = effectiveOptions.value.find(
          (o) => o.toLowerCase() === typed.toLowerCase()
        )
        if (exactMatch) {
          commit(exactMatch)
        } else if (props.allowCustom) {
          commit(typed)
        } else {
          query.value = props.modelValue || ''
        }
        open.value = false
      }, 120)
    }

    const onTab = () => {
      if (open.value && activeIndex.value >= 0 && filtered.value[activeIndex.value]) {
        commit(filtered.value[activeIndex.value])
      }
      open.value = false
    }

    const toggleOpen = () => {
      if (effectiveDisabled.value) return
      if (open.value) {
        open.value = false
        if (inputRef.value) inputRef.value.blur()
      } else {
        if (inputRef.value) inputRef.value.focus()
        else openList()
      }
    }

    onBeforeUnmount(() => {
      open.value = false
    })

    return {
      inputRef,
      listRef,
      open,
      query,
      filtered,
      activeIndex,
      activeId,
      listboxId,
      optionId,
      isCustomValue,
      effectiveDisabled,
      effectivePlaceholder,
      onFocus,
      onBlur,
      onInput,
      onEnter,
      onTab,
      moveActive,
      select,
      toggleOpen,
      closeAndRevert
    }
  }
}
</script>

<style scoped>
.ss-select {
  position: relative;
  width: 100%;
}

.ss-select__input {
  width: 100%;
  padding: 10px 36px 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-family: inherit;
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition), box-shadow var(--transition);
  text-overflow: ellipsis;
}

.ss-select__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.ss-select--custom .ss-select__input {
  border-color: var(--color-warning, #d97706);
  background: var(--color-warning-bg, #fffbeb);
}

.ss-select--disabled .ss-select__input,
.ss-select__input:disabled {
  background: #f1f5f9;
  color: var(--color-text-muted, #64748b);
  cursor: not-allowed;
  border-color: var(--color-border);
  box-shadow: none;
}

.ss-select--disabled .ss-select__chevron,
.ss-select__chevron:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ss-select__chevron {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  border-radius: var(--radius-sm);
  transition: color var(--transition), transform var(--transition);
}

.ss-select__chevron:hover {
  color: var(--color-text);
}

.ss-select--open .ss-select__chevron {
  transform: translateY(-50%) rotate(180deg);
}

.ss-select__list {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15),
    0 4px 10px -4px rgba(15, 23, 42, 0.08);
  -webkit-overflow-scrolling: touch;
}

.ss-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
  line-height: 1.3;
}

.ss-select__option-label {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ss-select__option.is-active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.ss-select__option.is-selected {
  font-weight: 600;
}

.ss-select__check {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 0.9375rem;
}

.ss-select__empty {
  padding: 10px;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: center;
  cursor: default;
}

@media (max-width: 600px) {
  .ss-select__list {
    max-height: 50vh;
  }

  .ss-select__option {
    padding: 12px 12px;
    font-size: 1rem;
  }
}
</style>
