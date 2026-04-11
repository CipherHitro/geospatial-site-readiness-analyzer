import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

export default function SearchBox({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Use Photon API — fast, CORS-friendly, no strict rate limits
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    try {
      // Photon geocoder — biased towards Ahmedabad coords for local results
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&lat=23.0225&lon=72.5714&limit=6&lang=en`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!controller.signal.aborted) {
        const items = (data.features || []).map((f) => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          return {
            name: p.name || '',
            city: p.city || p.county || '',
            state: p.state || '',
            country: p.country || '',
            type: p.osm_value || p.type || '',
            lat: coords[1],
            lon: coords[0],
            display: [p.name, p.street, p.city || p.county, p.state].filter(Boolean).join(', ')
          };
        });
        setResults(items);
        setIsOpen(items.length > 0);
        setActiveIndex(-1);
        setIsLoading(false);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Search error:', err.message);
      if (!controller.signal.aborted) {
        setResults([]);
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query && query.length >= 2) {
      setIsLoading(true);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, 350);
    } else {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    setQuery(item.name);
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(item.lat, item.lon);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        fetchSuggestions(query);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    if (abortRef.current) abortRef.current.abort();
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchSuggestions(query);
  };

  const formatType = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ');
  };

  return (
    <div className="search-box" ref={containerRef}>
      <form className="search-box__form" onSubmit={handleSubmit}>
        <div className="search-box__icon">
          {isLoading ? (
            <Loader2 size={16} className="search-box__spinner" />
          ) : (
            <Search size={16} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="search-box__input"
          placeholder="Search a location in Ahmedabad..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          autoComplete="off"
          id="location-search-input"
        />
        {query && (
          <button
            type="button"
            className="search-box__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {isOpen && (
        <ul className="search-box__results" role="listbox" id="search-results">
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              className={`search-box__item ${i === activeIndex ? 'search-box__item--active' : ''}`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setActiveIndex(i)}
              role="option"
              aria-selected={i === activeIndex}
            >
              <div className="search-box__item-icon">
                <MapPin size={14} />
              </div>
              <div className="search-box__item-content">
                <span className="search-box__item-name">{r.name}</span>
                <span className="search-box__item-address">
                  {[r.city, r.state].filter(Boolean).join(', ')}
                </span>
              </div>
              {r.type && (
                <span className="search-box__tag">{formatType(r.type)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isLoading && !isOpen && query.length >= 2 && (
        <div className="search-box__results">
          {[1, 2, 3].map((n) => (
            <div key={n} className="search-box__shimmer">
              <div className="search-box__shimmer-icon" />
              <div className="search-box__shimmer-lines">
                <div className="search-box__shimmer-line search-box__shimmer-line--short" />
                <div className="search-box__shimmer-line search-box__shimmer-line--long" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
