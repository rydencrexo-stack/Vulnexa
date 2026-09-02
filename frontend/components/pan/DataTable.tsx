"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/pan/EmptyState";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number | boolean | null | undefined;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField?: keyof T;
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyField,
  getRowKey,
  onRowClick,
  pageSize = 8,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Items that match this view will appear here.",
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.value) return data;
    return [...data].sort((a, b) => {
      const aValue = column.value?.(a) ?? "";
      const bValue = column.value?.(b) ?? "";
      const comparison = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [columns, data, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable || !column.value) return;
    setSort((current) => current?.key === column.key
      ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key: column.key, direction: "asc" });
    setPage(1);
  }

  if (!data.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={cn("pan-table-shell", className)}>
      <div className="pan-table-scroll">
        <table className="pan-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.headerClassName} key={column.key} scope="col">
                  {column.sortable && column.value ? (
                    <button type="button" onClick={() => toggleSort(column)}>
                      {column.header}
                      {sort?.key === column.key ? sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ChevronsUpDown size={13} />}
                    </button>
                  ) : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const key = getRowKey?.(row, index) ?? (keyField ? String(row[keyField]) : String(index));
              return (
                <tr
                  key={key}
                  className={onRowClick ? "pan-table-clickable" : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((column) => {
                    const directValue = (row as Record<string, unknown>)[column.key];
                    return <td className={column.className} key={column.key}>{column.render ? column.render(row) : String(column.value?.(row) ?? directValue ?? "—")}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="pan-pagination">
          <p>{(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}</p>
          <div>
            <button aria-label="Previous page" className="pan-icon-button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            <span>Page {safePage} of {pageCount}</span>
            <button aria-label="Next page" className="pan-icon-button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DataTable;
