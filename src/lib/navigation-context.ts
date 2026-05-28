type NavigationContext = {
  from: string
  filterId: string | number
  filterName: string
  filterField: string
  path?: string // Optional path field
}

type PageFilter = {
  filterId: string | number
  filterName: string
  filterField: string
}

const STORAGE_KEY = "navigation_context"

export const navigationContext = {
  // Save context
  save: (context: NavigationContext) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context))
      console.log("[v0] Context saved:", context)
    }
  },

  // Get context
  get: (): NavigationContext | null => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const context = stored ? JSON.parse(stored) : null
      console.log("[v0] Context retrieved:", context)
      return context
    }
    return null
  },

  // Clear context
  clear: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY)
      console.log("[v0] Context cleared")
    }
  },

  // Subscribe to context changes
  subscribe: (_callback: (context: NavigationContext | null) => void) => {
    // No-op for compatibility, no longer needed events
    return () => {}
  },

  // Push context onto the stack
  push: (context: NavigationContext) => {
    if (typeof window !== "undefined") {
      const stack = navigationContext.getStack()
      stack.push(context)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack))
      console.log("[v0] Context pushed:", context, "Stack:", stack)
    }
  },

  // Peek at the last context without removing it
  peek: (): NavigationContext | null => {
    if (typeof window !== "undefined") {
      const stack = navigationContext.getStack()
      return stack.length > 0 ? stack[stack.length - 1] : null
    }
    return null
  },

  // Pop and return the last context
  pop: (): NavigationContext | null => {
    if (typeof window !== "undefined") {
      const stack = navigationContext.getStack()
      const context = stack.pop()
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack))
      console.log("[v0] Context popped:", context, "Remaining stack:", stack)
      return context || null
    }
    return null
  },

  // Get the entire stack
  getStack: (): NavigationContext[] => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    }
    return []
  },

  // Get context for a specific path
  getForPath: (path: string): NavigationContext | null => {
    if (typeof window !== "undefined") {
      const stack = navigationContext.getStack()
      // Search from back to front to get the most recent
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].path === path) {
          return stack[i]
        }
      }
    }
    return null
  },

  // Guardar filtro para una página específica
  saveFilter: (page: string, filter: PageFilter) => {
    if (typeof window !== "undefined") {
      const key = `filter_${page}`
      sessionStorage.setItem(key, JSON.stringify(filter))
      console.log(`[v0] Filtro guardado para ${page}:`, filter)
    }
  },

  // Obtener filtro de una página específica
  getFilter: (page: string): PageFilter | null => {
    if (typeof window !== "undefined") {
      const key = `filter_${page}`
      const stored = sessionStorage.getItem(key)
      const filter = stored ? JSON.parse(stored) : null
      console.log(`[v0] Filtro recuperado para ${page}:`, filter)
      return filter
    }
    return null
  },

  // Limpiar filtro de una página específica
  clearFilter: (page: string) => {
    if (typeof window !== "undefined") {
      const key = `filter_${page}`
      sessionStorage.removeItem(key)
      console.log(`[v0] Filtro limpiado para ${page}`)
    }
  },

  // Limpiar todos los filtros
  clearAll: () => {
    if (typeof window !== "undefined") {
      const keys = Object.keys(sessionStorage).filter((key) => key.startsWith("filter_"))
      keys.forEach((key) => sessionStorage.removeItem(key))
      console.log("[v0] Todos los filtros limpiados")
    }
  },
}
