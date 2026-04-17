/**
 * StackSift UI Component Library — Primitives
 *
 * All primitive components are exported from this barrel file.
 * Import them like:
 *   import { Button, Badge, Input } from '@/app/components/ui';
 *
 * Never import directly from individual files in consuming code — always
 * use this barrel so that component paths can be refactored without
 * cascading import changes across the codebase.
 */

export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Textarea } from './Textarea';
export type { TextareaProps } from './Textarea';

export { Card, CardHeader, CardBody, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card';

export { Skeleton } from './Skeleton';
export type { SkeletonProps, SkeletonShape } from './Skeleton';

export { Spinner } from './Spinner';
export type { SpinnerProps, SpinnerSize } from './Spinner';

export { Separator } from './Separator';
export type { SeparatorProps } from './Separator';

export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipPlacement } from './Tooltip';

// ── Data Display Components (FE-04) ─────────────────────────────────────────

export { Dropdown } from './Dropdown';
export type { DropdownProps, DropdownItem } from './Dropdown';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateCTA } from './EmptyState';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { ToastContainer } from './Toast';

export { DataTable } from './DataTable';
export type { DataTableProps, DataTablePagination } from './DataTable';
