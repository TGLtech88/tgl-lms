import React, {
  useEffect,
  useState,
  useMemo,
  useRef
} from "react";
import { useAuthStore } from "../../stores/authStore";
import {
  Loader2,
  Calendar,
  Save,
  Trash2,
  FileDown,
  CloudUpload,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import { initAuth, googleSignIn, getAccessToken, logout } from "../../lib/googleAuth";

// We'll use html2pdf dynamically
const generatePdfBlob = async (htmlContent: string, date: string, studentName: string): Promise<Blob> => {
  const html2pdf = (await import("html2pdf.js")).default;
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = `
    <div style="padding: 40px; font-family: sans-serif; color: #000;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Daily Journal</h1>
      <p style="color: #666; margin-bottom: 24px;">Date: ${date} <br/> Student: ${studentName}</p>
      <div style="line-height: 1.6;">
        ${htmlContent}
      </div>
    </div>
  `;
  
  const opt = {
    margin: 0.5,
    filename: `Journal_${date}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
  };

  return await html2pdf().set(opt).from(tempContainer).outputPdf('blob');
};

const downloadPdfLocally = async (htmlContent: string, date: string, studentName: string) => {
  const html2pdf = (await import("html2pdf.js")).default;
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = `
    <div style="padding: 40px; font-family: sans-serif; color: #000;">
      <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">Daily Journal</h1>
      <p style="color: #666; margin-bottom: 24px;">Date: ${date} <br/> Student: ${studentName}</p>
      <div style="line-height: 1.6;">
        ${htmlContent}
      </div>
    </div>
  `;
  
  const opt = {
    margin: 0.5,
    filename: `Journal_${date}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
  };

  await html2pdf().set(opt).from(tempContainer).save();
};

export default function StudentJournals() {
  const { profile } = useAuthStore();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [content, setContent] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      () => setNeedsAuth(false),
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  const handleDownload = async () => {
    if (!content.trim()) return toast.error("Journal content is empty.");
    setExporting(true);
    try {
      await downloadPdfLocally(content, date, profile?.full_name || "Student");
      toast.success("Downloaded PDF successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setExporting(false);
    }
  };

  const handleDriveUpload = async () => {
    if (!content.trim()) return toast.error("Journal content is empty.");
    
    let token = await getAccessToken();
    if (!token) {
      try {
        const result = await googleSignIn();
        if (result) {
          token = result.accessToken;
        } else {
          return toast.error("Failed to sign in to Google Drive.");
        }
      } catch (err: any) {
        if (err?.code === 'auth/popup-closed-by-user') {
          return toast.error("Sign-in cancelled. Please complete the prompt to connect Google Drive.");
        }
        return toast.error("Sign in was cancelled or failed.");
      }
    }

    setUploading(true);
    try {
      const blob = await generatePdfBlob(content, date, profile?.full_name || "Student");
      
      const metadata = {
        name: `Journal_${date}.pdf`,
        mimeType: 'application/pdf',
      };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });
      
      if (!res.ok) throw new Error("Failed to upload to drive");
      
      toast.success("Successfully uploaded to Google Drive!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload. The token may have expired.");
      setNeedsAuth(true);
      logout();
    } finally {
      setUploading(false);
    }
  };

  const clearEditor = () => {
    if (confirm("Are you sure you want to clear the editor?")) {
      setContent("");
      setDate(new Date().toISOString().split("T")[0]);
    }
  };

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
    }),
    []
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Local Journal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Write your daily activities, save as PDF, and seamlessly upload to Google Drive without database storage.
          </p>
        </div>
        
        {needsAuth ? (
          <button 
            onClick={googleSignIn}
            className="gsi-material-button bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 flex items-center px-3 py-2 transition-colors"
          >
            <div className="mr-3">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Connect Drive</span>
          </button>
        ) : (
          <div className="flex items-center text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
            Drive Connected
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 shrink-0 gap-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 w-auto"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={clearEditor}
              variant="outline"
              className="text-slate-600 hover:text-red-600"
            >
              Clear
            </Button>
            <Button
              onClick={handleDownload}
              disabled={exporting || uploading}
              variant="secondary"
              className="gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Save PDF
            </Button>
            <Button
              onClick={handleDriveUpload}
              disabled={exporting || uploading}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              Upload to Drive
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-hidden flex flex-col">
          <div
            className={`ql-wrapper-custom bg-white transition-all duration-200 flex flex-col ${
              isFullscreen
                ? "fixed inset-0 z-[100] md:inset-8 md:rounded-2xl shadow-2xl border border-slate-300"
                : "flex-1 min-h-[400px] mt-2 rounded-xl border border-slate-300 relative"
            }`}
          >
            <div className="absolute right-2 top-2 z-[110]">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsFullscreen(!isFullscreen);
                }}
                className="p-1.5 bg-white hover:bg-slate-100 rounded-md text-slate-600 transition-colors border border-slate-200 shadow-sm flex items-center justify-center"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
            {/* @ts-ignore */}
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              modules={modules}
              className="w-full flex-1 flex flex-col m-0 p-0"
              placeholder="Start typing your daily journal here (This will NOT be saved to the online database)..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
