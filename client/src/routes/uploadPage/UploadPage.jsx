import { useState, useEffect, useCallback } from "react"
import { UploadCloud, Download, Trash2, FileText, Image as ImageIcon, File, Loader2, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from '@clerk/clerk-react'
import { motion, AnimatePresence } from "framer-motion"
import { useSettings } from '../../context/SettingsContext';
import "./uploadPage.css"

export default function UploadPage() {
  const { settingsOpen } = useSettings();
  const { getToken, userId } = useAuth();
  const [file, setFile] = useState(null)


  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const documents = await response.json();
          setFiles([
            ...documents.map(doc => ({
              name: doc.title,
              path: doc.path,
              size: doc.size,
              type: doc.type,
              uploadDate: doc.uploadDate,
              vectorbaseStatus: 'Selesai'
            }))
          ]);
        } else {
          console.error("Failed to fetch documents:", response.status);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    };

    fetchDocuments();
  }, [getToken]);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type) => {
    if (type?.includes('image')) return <ImageIcon className="w-5 h-5 text-purple-500" />
    if (type?.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />
    return <File className="w-5 h-5 text-blue-500" />
  }

  const getFileTypeLabel = (file) => {
    if (file.type === 'application/pdf') return 'PDF';
    if (file.type.includes('image')) return 'IMG';
    if (file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
    if (file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)) return 'IMG';
    if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')) return 'DOC';
    return file.type.split('/')[1]?.toUpperCase() || 'FILE';
  };

  const toggleFileSelection = (filePath) => {
    setSelectedFiles(prev =>
      prev.includes(filePath)
        ? prev.filter(p => p !== filePath)
        : [...prev, filePath]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.path));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`Hapus ${selectedFiles.length} file?`)) return;

    try {
      const token = await getToken();
      for (const filePath of selectedFiles) {
        await fetch(`${import.meta.env.VITE_POST_URL_DELETE_VECTOR}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: filePath }),
        });

        const formattedFilePath = filePath.replace(import.meta.env.VITE_UPLOAD_DIR, '');
        await fetch(`${import.meta.env.VITE_API_URL}/api/delete/${userId}/${formattedFilePath}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
      setFiles(files.filter(f => !selectedFiles.includes(f.path)));
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error deleting files:', error);
      alert('Terjadi kesalahan saat menghapus file');
    }
  };

  const handleDownloadSelected = () => {
    if (selectedFiles.length === 0) return;
    selectedFiles.forEach(filePath => {
      const fileDoc = files.find(f => f.path === filePath);
      if (fileDoc) {
        const link = document.createElement('a');
        // Use the API endpoint for serving files which maps to /api/uploads/{path}
        // fileDoc.path is relative path (userId/filename) stored in DB
        link.href = `${import.meta.env.VITE_API_URL}/api/uploads/${fileDoc.path}`;
        link.download = fileDoc.name;
        link.target = "_blank"; // Ensure it opens even if download attribute is ignored
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newFile = {
          name: result.fileName,
          path: result.filePath.replace(/^uploads\//, '').replace(import.meta.env.VITE_UPLOAD_DIR, '').replace('/', ''),
          size: file.size,
          type: file.type,
          uploadDate: new Date().toISOString(),
          vectorbaseStatus: 'loading',
        };

        setFiles((prevFiles) => [...prevFiles, newFile]);
        setFile(null);

        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => input.value = '');

        const vectorbaseResponse = await fetch(`${import.meta.env.VITE_POST_URL_UPLOAD}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ filePath: result.filePath }),
        });

        if (vectorbaseResponse.ok) {
          setFiles((prevFiles) =>
            prevFiles.map(f =>
              f.path === newFile.path ? { ...f, vectorbaseStatus: 'Selesai' } : f
            )
          );
        }
      } else {
        const errorResult = await response.json();
        alert(errorResult.message || "Failed to upload file.");
      }
    } catch (error) {
      console.error("Error during file upload:", error);
      alert("An error occurred while uploading the file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="uploadPage">
      {/* Header Section */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Upload Documents</h1>
            <p className="text-[10px] text-gray-500">Manage your files and knowledge base.</p>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {selectedFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    marginRight: !settingsOpen ? 44 : 0
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="selected-files-actions flex gap-2"
                >
                  <Button variant="outline" size="sm" onClick={handleDownloadSelected} className="gap-2 h-7 text-xs px-2">
                    <Download className="w-3 h-3" />
                    ({selectedFiles.length})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2 h-7 text-xs px-2">
                    <Trash2 className="w-3 h-3" />
                    ({selectedFiles.length})
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>



      {/* Upload Area */}
      <div className="p-3 bg-white shrink-0">
        <div
          className={`drag-drop-zone p-4 flex flex-col items-center justify-center text-center ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-colors ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            <UploadCloud className="w-4 h-4" />
          </div>

          {file ? (
            <div className="flex items-center gap-2 bg-white p-1.5 border rounded-md shadow-sm max-w-sm w-full animate-in fade-in slide-in-from-bottom-2">
              <div className="p-1 bg-gray-50 rounded border border-gray-100">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-xs truncate text-gray-900">{file.name}</p>
                <p className="text-[10px] text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setFile(null)} disabled={isUploading} className="h-6 w-6">
                <X className="w-3 h-3" />
              </Button>
              <Button onClick={handleUpload} disabled={isUploading} size="sm" className="h-6 text-[10px] px-2">
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : 'Upload'}
              </Button>
            </div>
          ) : (
            <>
              <h3 className="text-xs font-semibold text-gray-900">Click to upload or drag and drop</h3>
              <p className="text-[10px] text-gray-500 mt-0.5 mb-1">PDF, PNG, JPG under 10MB</p>
              <div className="relative">
                <Input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept="application/pdf,image/*"
                />
                <Button variant="secondary" size="sm" className="pointer-events-none h-6 text-[10px] px-2">Select File</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="upload-scroll-area border-t border-gray-100 bg-white">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
              <File className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-sm font-medium">No documents uploaded</p>
          </div>
        ) : (
          <table className="file-table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[32px] text-center p-2">
                  <input
                    type="checkbox"
                    checked={selectedFiles.length === files.length && files.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                </th>
                <th className="py-2 px-3 text-xs">Name</th>
                <th className="py-2 px-3 text-xs">Size</th>
                <th className="py-2 px-3 text-xs">Type</th>
                <th className="py-2 px-3 text-xs">Date</th>
                <th className="py-2 px-3 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {files.map((file, index) => (
                  <motion.tr
                    key={file.path || index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, backgroundColor: "#fee2e2" }}
                    transition={{ duration: 0.2 }}
                    className={selectedFiles.includes(file.path) ? "bg-blue-50/50" : ""}
                  >
                    <td className="text-center p-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-white border border-gray-100 shadow-sm shrink-0">
                          {getFileIcon(file.type)}
                        </div>
                        <span className="font-medium truncate max-w-[200px] text-gray-700 text-xs" title={file.name}>{file.name}</span>
                      </div>
                    </td>
                    <td className="text-gray-500 font-mono text-[10px] py-2 px-3">{formatFileSize(file.size)}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 uppercase tracking-wide">
                        {getFileTypeLabel(file)}
                      </span>
                    </td>
                    <td className="text-gray-500 text-[10px] py-2 px-3">
                      {new Date(file.uploadDate).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </td>
                    <td className="py-2 px-3">
                      {file.vectorbaseStatus === 'loading' ? (
                        <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-medium bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processing
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-700 text-[10px] font-medium bg-green-50 px-2 py-0.5 rounded-full w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Ready
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}