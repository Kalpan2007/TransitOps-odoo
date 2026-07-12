import { useState, useMemo, useCallback } from 'react';

/**
 * Reusable hook for client-side sorting, searching, and filtering of table data.
 * @param {Array} items - The data array to sort/filter
 * @param {Object} options - { defaultSortKey, defaultOrder, defaultSearch, defaultFilters }
 * @returns {Object} - { sortedItems, sortConfig, requestSort, searchQuery, setSearchQuery, filters, setFilter, resetFilters }
 */
const useSortableData = (items = [], options = {}) => {
  const {
    defaultSortKey = 'id',
    defaultOrder = 'DESC',
    defaultSearch = '',
    defaultFilters = {},
  } = options;

  const [sortConfig, setSortConfig] = useState({ key: defaultSortKey, direction: defaultOrder });
  const [searchQuery, setSearchQuery] = useState(defaultSearch);
  const [filters, setFiltersState] = useState(defaultFilters);

  const requestSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ASC' ? 'DESC' : 'ASC',
    }));
  }, []);

  const setFilter = useCallback((key, value) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    setSearchQuery(defaultSearch);
    setSortConfig({ key: defaultSortKey, direction: defaultOrder });
  }, [defaultFilters, defaultSearch, defaultSortKey, defaultOrder]);

  const filteredAndSorted = useMemo(() => {
    if (!items || items.length === 0) return [];

    let result = [...items];

    // Apply text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        Object.values(item).some(val =>
          val != null && String(val).toLowerCase().includes(q)
        )
      );
    }

    // Apply dropdown filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => String(item[key]) === String(value));
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle null/undefined
        if (aVal == null) aVal = '';
        if (bVal == null) bVal = '';

        // Handle numeric strings
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'ASC' ? aNum - bNum : bNum - aNum;
        }

        // Handle dates
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortConfig.direction === 'ASC' ? aDate - bDate : bDate - aDate;
        }

        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return sortConfig.direction === 'ASC' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, searchQuery, filters, sortConfig]);

  return {
    sortedItems: filteredAndSorted,
    sortConfig,
    requestSort,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    resetFilters,
  };
};

export default useSortableData;
