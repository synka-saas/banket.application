export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  /** Show the "Por página: 20 50 100" selector when set. */
  pageSize?: number;
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination(props: PaginationProps): JSX.Element;
