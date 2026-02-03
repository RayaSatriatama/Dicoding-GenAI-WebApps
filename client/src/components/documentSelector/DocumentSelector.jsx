import React, { useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { ConfigContext } from '../configStore/ConfigStore';
import { FileText, Search, X, Check, FolderOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import './documentSelector.css';

export function DocumentSelector({ onClose }) {
  const { getToken } = useAuth();
  const { config, setConfig } = useContext(ConfigContext);
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const popupRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedDocs = Array.isArray(config.selectedDocuments) 
    ? config.selectedDocuments 
    : (config.document && config.document !== 'none' ? [config.document] : []);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        
        // Fetch documents from Kotaemon database (indexed documents)
        const kotaemonResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/kotaemon/documents`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (kotaemonResponse.ok) {
          const kotaemonData = await kotaemonResponse.json();
          if (kotaemonData.documents && kotaemonData.documents.length > 0) {
            // Use Kotaemon documents - these have exact names that Kotaemon recognizes
            setDocuments(kotaemonData.documents.map(doc => ({
              id: doc.name, // Use name as unique ID
              path: doc.name, // Path is the exact Kotaemon name for RAG
              title: doc.display_name, // User-friendly display name
              type: doc.type || 'pdf',
              source: doc.source,
            })));
            console.log('📚 Loaded documents from Kotaemon:', kotaemonData.documents.length);
            setLoading(false);
            return;
          }
        }

        // Fallback: fetch from user documents endpoint
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const userDocuments = await response.json();
          setDocuments(userDocuments.map(doc => ({
            id: doc._id,
            path: doc.path,
            title: doc.title,
            type: doc.type,
          })));
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [getToken]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const filteredDocuments = documents.filter(doc => 
    doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.path?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDocument = (docPath) => {
    const newSelectedDocs = selectedDocs.includes(docPath)
      ? selectedDocs.filter(d => d !== docPath)
      : [...selectedDocs, docPath];
    setConfig({
      ...config,
      selectedDocuments: newSelectedDocs,
      document: newSelectedDocs.length > 0 ? newSelectedDocs[0] : 'none',
    });
  };

  const selectAll = () => {
    const allPaths = filteredDocuments.map(doc => doc.path);
    setConfig({ ...config, selectedDocuments: allPaths, document: allPaths[0] || 'none' });
  };

  const clearAll = () => {
    setConfig({ ...config, selectedDocuments: [], document: 'none' });
  };

  const getDisplayName = (path) => {
    if (!path) return path;
    const filename = path.split('/').pop() || path;
    return filename.replace(/^\d{8}_\d{6}_/, '');
  };

  const getFileType = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return { label: 'PDF', badge: 'badge-pdf' };
    if (t.includes('doc')) return { label: 'DOC', badge: 'badge-doc' };
    if (t.includes('xls')) return { label: 'XLS', badge: 'badge-xls' };
    if (t.includes('ppt')) return { label: 'PPT', badge: 'badge-ppt' };
    if (t.includes('image') || t.includes('png') || t.includes('jpg')) return { label: 'IMG', badge: 'badge-image' };
    return { label: type || 'FILE', badge: 'badge-default' };
  };

  const selectedDocObjects = documents.filter(doc => selectedDocs.includes(doc.path));

  return (
    <div className="doc-selector-popup" ref={popupRef}>
      {/* Header */}
      <div className="doc-selector-header">
        <div className="header-title">
          <FolderOpen />
          <span>Pilih Dokumen</span>
        </div>
        <button onClick={onClose} className="close-btn" aria-label="Tutup">
          <X />
        </button>
      </div>

      {/* Search */}
      <div className="doc-selector-search">
        <Search className="search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Cari dokumen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="clear-search">
            <X />
          </button>
        )}
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <button onClick={selectAll} className="quick-action-btn" disabled={filteredDocuments.length === 0}>
          <Check /> Pilih Semua
        </button>
        <button onClick={clearAll} className="quick-action-btn" disabled={selectedDocs.length === 0}>
          <X /> Hapus Semua
        </button>
      </div>

      {/* Document list */}
      <div className="doc-selector-list">
        {loading ? (
          <div className="state-container">
            <div className="loading-spinner" />
            <span className="state-text">Memuat...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="state-container">
            <div className="empty-icon"><FileText /></div>
            <span className="state-text">
              {searchQuery ? 'Tidak ditemukan' : 'Belum ada dokumen'}
            </span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="clear-filter-btn">Reset</button>
            )}
          </div>
        ) : (
          <div className="doc-items-grid">
            {filteredDocuments.map((doc) => {
              const isSelected = selectedDocs.includes(doc.path);
              const fileType = getFileType(doc.type);
              
              return (
                <label key={doc.id || doc.path} className={`doc-card ${isSelected ? 'selected' : ''}`}>
                  <div className="doc-card-checkbox">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleDocument(doc.path)} />
                  </div>
                  <div className="doc-card-icon"><FileText /></div>
                  <div className="doc-card-content">
                    <span className="doc-card-name" title={doc.path}>
                      {getDisplayName(doc.title || doc.path)}
                    </span>
                    <span className={`doc-card-type ${fileType.badge}`}>{fileType.label}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="doc-selector-footer">
        <div className="selection-summary">
          <div className={`summary-icon ${selectedDocs.length > 0 ? 'active' : ''}`}>
            <FileText />
          </div>
          <div className="summary-text">
            {selectedDocs.length > 0 ? (
              <>
                <span className="summary-count">{selectedDocs.length}</span>
                <span className="summary-label">dipilih</span>
              </>
            ) : (
              <span className="summary-empty">Tidak ada</span>
            )}
          </div>
        </div>
        <Button onClick={onClose} size="sm" className="done-btn">Selesai</Button>
      </div>
    </div>
  );
}

export function DocumentSelectorTrigger({ onClick, selectedCount }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="doc-selector-trigger"
      title="Pilih dokumen RAG"
    >
      <FolderOpen />
      {selectedCount > 0 && <span className="trigger-badge">{selectedCount}</span>}
    </button>
  );
}

export default DocumentSelector;
