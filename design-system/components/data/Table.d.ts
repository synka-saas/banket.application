import * as React from "react";

export interface TableColumn<Row = any> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: number | string;
  sortable?: boolean;
  /** Cell style preset: strong (dark medium), accent (terracotta link-style — record names), muted, actions (right-aligned row actions). */
  variant?: "strong" | "accent" | "muted" | "actions";
  /** Tabular numerals. */
  numeric?: boolean;
  className?: string;
  render?: (row: Row, index: number) => React.ReactNode;
}

/**
 * Data table in a rounded card with optional sortable headers and a footer bar (count + Pagination).
 * Empty cells ("", null, "-") render as a soft em-dash.
 */
export interface TableProps<Row = any> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey?: string | ((row: Row, i: number) => string | number);
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (sort: { key: string; dir: "asc" | "desc" }) => void;
  onRowClick?: (row: Row) => void;
  /** Footer bar content — typically <strong>16 registros</strong> + <Pagination/>. */
  footer?: React.ReactNode;
  /** Content when rows is empty (use <EmptyState/>). */
  empty?: React.ReactNode;
  dense?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Table<Row = any>(props: TableProps<Row>): JSX.Element;
