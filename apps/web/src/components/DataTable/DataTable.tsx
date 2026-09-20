import { FC, PropsWithChildren } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

/** Generic data table with sorting and empty state. */
export const DataTable: FC<PropsWithChildren<{
  columns: Column<any>[];
  rows: any[];
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
}>> = ({ columns, rows, emptyMessage = 'No data', onRowClick }) => {
  if (rows.length === 0) {
    return (
      <div className="data-table__empty" style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="data-table" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{ padding: 'var(--space-2) var(--space-3)' }}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};