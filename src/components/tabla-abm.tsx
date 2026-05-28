"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

interface Column {
  key: string
  label: string
  render?: (item: any) => React.ReactNode
}

interface CustomAction {
  icon: React.ReactNode | ((item: any) => React.ReactNode)
  onClick: (item: any) => void
  tooltip?: string | ((item: any) => string)
  visible?: (item: any) => boolean
}

interface TablaABMProps {
  title: string
  columns: Column[]
  data: any[]
  onNew: () => void
  onEdit: (item: any) => void
  onDelete: (item: any) => void
  idKey?: string
  customActions?: CustomAction[]
  filterInfo?: string
  canEdit?: (item: any) => boolean
  canDelete?: (item: any) => boolean
}

export function TablaABM({
  title,
  columns,
  data,
  onNew,
  onEdit,
  onDelete,
  customActions = [],
  filterInfo,
  canEdit = () => true,
  canDelete = () => true,
}: TablaABMProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredData = data.filter((item) =>
    Object.values(item).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  return (
    <Card className="bg-card">
      <div className="p-3 lg:p-6">
        {filterInfo && (
          <div className="mb-3 lg:mb-4 p-2 lg:p-3 bg-accent/50 rounded-lg border border-border">
            <p className="text-xs lg:text-sm text-foreground">
              <span className="font-semibold">Filtrado por:</span> {filterInfo}
            </p>
          </div>
        )}

        <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 lg:gap-4">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-input border-border text-foreground text-sm"
            />
          </div>
          <Button
            onClick={onNew}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo {title}</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border -mx-3 lg:mx-0">
          <table className="w-full min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 lg:px-4 py-2 lg:py-3 text-left text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {column.label}
                  </th>
                ))}
                <th className="px-3 lg:px-4 py-2 lg:py-3 text-right text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedData.map((item, index) => (
                <tr key={index} className="hover:bg-accent/50 transition-colors">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm text-foreground">
                      {column.render ? column.render(item) : item[column.key]}
                    </td>
                  ))}
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-right">
                    <div className="flex justify-end gap-1 lg:gap-2">
                      {customActions.map((action, idx) => {
                        const isVisible = action.visible ? action.visible(item) : true
                        if (!isVisible) return null

                        const icon = typeof action.icon === "function" ? action.icon(item) : action.icon
                        const tooltip = typeof action.tooltip === "function" ? action.tooltip(item) : action.tooltip

                        return (
                          <Button
                            key={idx}
                            variant="ghost"
                            size="icon"
                            onClick={() => action.onClick(item)}
                            className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-foreground"
                            title={tooltip}
                          >
                            {icon}
                          </Button>
                        )
                      })}
                      {canEdit(item) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(item)}
                          className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        </Button>
                      )}
                      {canDelete(item) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(item)}
                          className="h-7 w-7 lg:h-8 lg:w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 lg:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs lg:text-sm text-muted-foreground text-center sm:text-left">
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredData.length)} de{" "}
            {filteredData.length} resultados
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 lg:h-8 lg:w-8"
            >
              <ChevronLeft className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            </Button>
            <span className="text-xs lg:text-sm text-foreground whitespace-nowrap">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 lg:h-8 lg:w-8"
            >
              <ChevronRight className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
