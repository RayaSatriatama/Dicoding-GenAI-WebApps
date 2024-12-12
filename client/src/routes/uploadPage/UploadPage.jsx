import { useState, useEffect } from "react"
import { Upload, Download, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from '@clerk/clerk-react'
import "./uploadPage.css"
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThinkingDots } from "@/components/ui/loading-spinners";

export default function UploadPage() {
  const { userId } = useAuth();
  const [file, setFile] = useState(null)
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents`, {
          method: 'GET',
          credentials: 'include',
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
            }))
          ]);
        } else {
          console.error("Failed to fetch documents");
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    };

    fetchDocuments();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDelete = async (filePath) => {
    try {
      const vectorbaseResponse = await fetch(`${import.meta.env.VITE_POST_URL_DELETE_VECTOR}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filePath: filePath }),
      });

      const formattedFilePath = filePath.replace(import.meta.env.VITE_UPLOAD_DIR, '');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/delete/${userId}/${formattedFilePath}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok && vectorbaseResponse.ok) {
        setFiles(files.filter(f => f.path !== filePath));
      } else {
        const errorResult = await response.json();
        alert(errorResult.message || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('An error occurred while deleting the file');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a file!");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newFile = {
          name: result.fileName,
          path: result.filePath.replace(/^uploads\//, '').replace(import.meta.env.VITE_UPLOAD_DIR, ''),
          size: file.size,
          type: file.type,
          uploadDate: new Date().toISOString(),
          vectorbaseStatus: 'loading',
        };

        setFiles((prevFiles) => [...prevFiles, newFile]);
        setFile(null);
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';

        const vectorbaseResponse = await fetch(`${import.meta.env.VITE_POST_URL_UPLOAD}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filePath: result.filePath }),
        });

        if (vectorbaseResponse.ok) {
          setFiles((prevFiles) =>
            prevFiles.map(f =>
              f.path === newFile.path
                ? { ...f, vectorbaseStatus: 'Selesai' }
                : f
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
      <div className="container pb-8 pl-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Upload File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleUpload} className="flex items-center gap-4">
              <Input
                type="file"
                onChange={handleFileChange}
                className="flex-1"
                accept="application/pdf,image/*"
              />
              <Button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white" disabled={!file || isUploading}>
                {isUploading ? (
                  <ThinkingDots />
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </form>

            <ScrollArea className="upload-scroll-area">
              {(
                <div className="list">
                  {files.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border p-2 text-left">Nama File</th>
                            <th className="border p-2 text-left">Ukuran</th>
                            <th className="border p-2 text-left">Tipe</th>
                            <th className="border p-2 text-left">Tanggal Upload</th>
                            <th className="border p-2 text-left">Vectorbase</th>
                            <th className="border p-2 text-left w-[200px]">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((file, index) => (
                            <tr key={index} className="border-b">
                              <td className="border-x p-2">{file.name}</td>
                              <td className="border-x p-2">{formatFileSize(file.size)}</td>
                              <td className="border-x p-2">{file.type.replace("application/", "")}</td>
                              <td className="border-x p-2">
                                {new Date(file.uploadDate).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="border-x p-2">
                                {file.vectorbaseStatus === 'loading' ? <ThinkingDots /> : file.vectorbaseStatus || 'Selesai'}
                              </td>
                              <td className="border-x p-2">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                  >
                                    <a
                                      href={`${import.meta.env.VITE_API_URL}/uploads/${file.path.replace(import.meta.env.VITE_UPLOAD_DIR, '')}`}
                                      download
                                      className="flex items-center gap-2"
                                    >
                                      <Download className="w-4 h-4" />
                                      Download
                                    </a>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(file.path)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}