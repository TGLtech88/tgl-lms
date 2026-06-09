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
            Write your daily activities and save as a PDF for your personal reference.
          </p>
        </div>
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
              disabled={exporting}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Save PDF
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
