import type {
  ReactNode,
} from 'react';

export interface DataTableColumn<
  T extends Record<string, unknown>,
> {
  key: string;
  header: string;
  render?: (
    row: T,
  ) => ReactNode;
  width?: string;
}

interface DataTableProps<
  T extends Record<string, unknown>,
> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  ariaLabel?: string;
  getRowKey?: (
    row: T,
    index: number,
  ) => string;
  onRowClick?: (
    row: T,
  ) => void;
}

function defaultRowKey<
  T extends Record<string, unknown>,
>(
  row: T,
  index: number,
): string {
  const preferredKeys = [
    'id',
    'case_id',
    'listing_id',
    'seller_id',
    'order_id',
  ];

  for (const key of preferredKeys) {
    const value = row[key];

    if (
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value;
    }

    if (
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return String(value);
    }
  }

  /*
   * This fallback is only used when the row genuinely has no stable
   * identifier. It does not create or display business data.
   */
  return `row-${index}`;
}

function renderDefaultCell(
  value: unknown,
): ReactNode {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return '—';
}

export function DataTable<
  T extends Record<string, unknown>,
>({
  columns,
  rows,
  emptyMessage = 'No records found.',
  ariaLabel = 'Data table',
  getRowKey = defaultRowKey,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  if (rows.length === 0) {
    return (
      <div
        className="table-empty"
        role="status"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="data-table">
      <table>
        <caption className="visually-hidden">
          {ariaLabel}
        </caption>

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{
                  width: column.width,
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const rowKey =
              getRowKey(
                row,
                index,
              );

            const clickable =
              Boolean(onRowClick);

            return (
              <tr
                key={rowKey}
                className={
                  clickable
                    ? 'clickable'
                    : undefined
                }
                onClick={
                  clickable
                    ? () =>
                        onRowClick?.(
                          row,
                        )
                    : undefined
                }
                onKeyDown={
                  clickable
                    ? (
                        event,
                      ) => {
                        if (
                          event.key ===
                            'Enter' ||
                          event.key ===
                            ' '
                        ) {
                          event.preventDefault();

                          onRowClick?.(
                            row,
                          );
                        }
                      }
                    : undefined
                }
                tabIndex={
                  clickable
                    ? 0
                    : undefined
                }
                role={
                  clickable
                    ? 'link'
                    : undefined
                }
                aria-label={
                  clickable
                    ? `Open row ${rowKey}`
                    : undefined
                }
              >
                {columns.map(
                  (column) => (
                    <td
                      key={
                        column.key
                      }
                    >
                      {column.render
                        ? column.render(
                            row,
                          )
                        : renderDefaultCell(
                            row[
                              column.key
                            ],
                          )}
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
