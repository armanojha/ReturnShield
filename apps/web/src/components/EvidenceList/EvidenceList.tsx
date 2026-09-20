import { FC, PropsWithChildren } from 'react';

interface EvidenceItem {
  evidence_id: string;
  kind: 'SELLER_HISTORY' | 'LISTING_CONTENT' | 'CUSTOMER_HISTORY' | 'ORDER_RECORD' | 'RETURN_STATEMENT' | 'CATEGORY_POLICY' | 'CONTEXT_FAILURE';
  source_id: string;
  text: string;
  observed_at: string;
}

/** Evidence list grouped by kind. */
export const EvidenceList: FC<PropsWithChildren<{
  items: EvidenceItem[];
}>> = ({ items }) => {
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.kind]) acc[item.kind] = [];
    acc[item.kind].push(item);
    return acc;
  }, {} as Record<string, EvidenceItem[]>);

  const kindLabels: Record<string, string> = {
    SELLER_HISTORY: 'Seller History',
    LISTING_CONTENT: 'Listing Content',
    CUSTOMER_HISTORY: 'Customer History',
    ORDER_RECORD: 'Order Record',
    RETURN_STATEMENT: 'Return Statement',
    CATEGORY_POLICY: 'Category Policy',
    CONTEXT_FAILURE: 'Context Failure',
  };

  return (
    <div className="evidence-list">
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind} className="evidence-list__group">
          <h4 className="evidence-list__kind" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
            {kindLabels[kind] || kind}
          </h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {items.map((item) => (
              <li key={item.evidence_id} className="evidence-list__item" style={{ marginBottom: 'var(--space-2)', padding: 'var(--space-2)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>{item.source_id}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.observed_at).toLocaleString()}</span>
                </div>
                <div style={{ color: 'var(--text)' }}>{item.text}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};