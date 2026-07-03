import type { ReactNode } from "react";
import { MoreHorizontal, Edit, Trash2, Download } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  onClick?: (item: T) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  less?: boolean;
  data: T[];
  isLoading?: boolean;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onDownload?: (item: T) => void;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  less,
  data,
  isLoading,
  onEdit,
  onDelete,
  onDownload,
  onRowClick
}: DataTableProps<T>) {

  const items = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto no-scrollbar bg-card border border-border rounded-xl shadow-sm-soft">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted/50 transition-colors">
            {columns.map((col) => (
              <th key={col.key.toString()} className="h-12 px-4 text-left font-medium text-muted-foreground select-none">
                {col.header}
              </th>
            ))}
            {(onEdit || onDelete || onDownload) && (
              <th className="h-12 px-4 text-right font-medium text-muted-foreground select-none">Actions</th>
            )}
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                No results found.
              </td>
            </tr>
          ) : (
            items.map((item, idx) => (
              <tr
                key={item.id || idx}
                className={`border-b transition-colors hover:bg-muted/30 ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key.toString()}
                    onClick={(e) => {
                      if (col.onClick) {
                        e.stopPropagation();
                        col.onClick(item);
                      }
                    }}
                    className={`${col.onClick ? "cursor-pointer font-medium text-primary hover:underline" : ""} p-4 align-middle`}
                  >
                    {col.render
                      ? col.render(item)
                      : (item[col.key as keyof T] as React.ReactNode)}
                  </td>
                ))}

                {(onEdit || onDelete || onDownload) && (
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        {onDownload && (
                          <DropdownMenuItem
                            onClick={() => onDownload(item)}
                          >
                            <Download className="mr-2 h-4 w-4 text-primary" />
                            <span>Download Quotation</span>
                          </DropdownMenuItem>
                        )}

                        {onEdit && (
                          <DropdownMenuItem
                            onClick={() => onEdit(item)}
                          >
                            <Edit className="mr-2 h-4 w-4 text-primary" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                        )}

                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(item)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
