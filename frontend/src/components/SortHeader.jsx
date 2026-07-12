import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * Sortable table header component.
 * @param {string} label - Display text
 * @param {string} sortKey - Key for sorting
 * @param {Object} sortConfig - Current sort configuration { key, direction }
 * @param {Function} onSort - Sort handler function
 * @param {Object} style - Optional inline styles
 */
const SortHeader = ({ label, sortKey, sortConfig, onSort, style = {} }) => {
  const isActive = sortConfig.key === sortKey;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{label}</span>
        <span style={{ opacity: isActive ? 1 : 0.3, display: 'flex', alignItems: 'center' }}>
          {direction === 'ASC' ? (
            <ChevronUp size={13} />
          ) : direction === 'DESC' ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronsUpDown size={13} />
          )}
        </span>
      </div>
    </th>
  );
};

export default SortHeader;
