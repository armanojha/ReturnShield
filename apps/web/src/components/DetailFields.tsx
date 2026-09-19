function humanize(
  value: string,
): string {
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function stringifyValue(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return JSON.stringify(
    value,
    null,
    2,
  );
}

export function DetailFields({
  data,
}: {
  data: Record<string, unknown>;
}): JSX.Element {
  const entries =
    Object.entries(data);

  return (
    <div className="detail-grid">
      {entries.map(
        ([key, value]) => (
          <div
            className="detail-field"
            key={key}
          >
            <div className="detail-label">
              {humanize(key)}
            </div>

            {Array.isArray(value) ? (
              <ul className="detail-list">
                {value.length === 0 ? (
                  <li>—</li>
                ) : (
                  value.map(
                    (item, index) => (
                      <li
                        key={`${key}-${index}`}
                      >
                        {stringifyValue(
                          item,
                        )}
                      </li>
                    ),
                  )
                )}
              </ul>
            ) : (
              <div className="detail-value">
                {stringifyValue(value)}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  );
}
