import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import {
  X,
  FileText,
  Download,
  FileType,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { formatDate } from "../lib/utils";

interface ReportExportModalProps {
  onClose: () => void;
  reportData: any;
}

export function ReportExportModal({
  onClose,
  reportData,
}: ReportExportModalProps) {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [journals, setJournals] = useState<any[]>([]);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [companyName, setCompanyName] = useState("My Company");

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      try {
        // Fetch Journals
        const { data: jData } = await supabase
          .from("daily_journals")
          .select("*")
          .eq("student_id", profile.id)
          .order("date", { ascending: true });

        if (jData) setJournals(jData);

        // Fetch Batch Info
        const { data: bsData } = await supabase
          .from("batch_students")
          .select("batch_id")
          .eq("student_id", profile.id)
          .maybeSingle();

        if (bsData?.batch_id) {
          const { data: bData } = await supabase
            .from("batches")
            .select("*")
            .eq("id", bsData.batch_id)
            .maybeSingle();
          if (bData) setBatchInfo(bData);
        }
      } catch (err) {
        console.error("Error fetching data for export", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [profile?.id]);

  const generateHTMLString = () => {
    // We build a semantic HTML string that will be parsed by both html2pdf and html-to-docx
    const studentName = profile?.full_name || "Student";
    const bName = batchInfo?.name || "Internship Program";
    const sDate = batchInfo?.start_date || "N/A";
    const eDate = batchInfo?.end_date || "N/A";

    // Extract all image URLs from journals
    let allImages: string[] = [];
    journals.forEach((j) => {
      if (j.image_urls && j.image_urls.length > 0) {
        allImages = allImages.concat(j.image_urls);
      }
      // We should also check for <img> tags inside activities_performed since we switched to ReactQuill
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = j.activities_performed || "";
      const imgs = tempDiv.querySelectorAll("img");
      imgs.forEach((img) => allImages.push(img.src));
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Report</title>
        <style>
          * { max-width: 100%; box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #000; word-wrap: break-word; overflow-wrap: break-word; }
          .page-break { page-break-before: always; break-before: page; }
          .text-center { text-align: center; }
          .header-1 { font-size: 24pt; font-weight: bold; margin-bottom: 20px; }
          .header-2 { font-size: 18pt; font-weight: bold; margin-bottom: 15px; }
          .header-3 { font-size: 14pt; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
          .cover-page { padding-top: 100px; text-align: center; }
          .section { margin-bottom: 30px; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; }
          img { max-width: 100%; height: auto; object-fit: contain; }
          p, div, span, h1, h2, h3, h4, h5, h6, table, tr, td, th {
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        <div class="cover-page">
          <div class="header-1">INTERNSHIP / PROJECT REPORT</div>
          <div class="header-2">${reportData.title || "Untitled Project"}</div>
          <br/><br/><br/>
          <h3>Submitted by</h3>
          <p><strong>${studentName}</strong></p>
          <p>${profile?.email || ""}</p>
          <br/><br/><br/>
          <h3>In partial fulfillment of the requirements for</h3>
          <p><strong>${companyName}</strong></p>
          <p>Program/Batch: ${bName}</p>
          <p>Duration: ${sDate} to ${eDate}</p>
        </div>

        <div class="page-break"></div>

        <!-- Certificate -->
        <div class="section">
          <h1 class="text-center header-2">CERTIFICATE</h1>
          <p>This is to certify that <strong>${studentName}</strong> has successfully completed the internship / project work titled <strong>"${reportData.title || "Untitled Project"}"</strong> at <strong>${companyName}</strong> during the period from <strong>${sDate}</strong> to <strong>${eDate}</strong>.</p>
          <br/><br/><br/><br/>
          <div style="display: flex; justify-content: space-between;">
            <div>
               <p>_______________________</p>
               <p>Project Guide</p>
            </div>
            <div>
               <p>_______________________</p>
               <p>Coordinator / HR</p>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <!-- Acknowledgement -->
        <div class="section">
          <h1 class="header-2">ACKNOWLEDGEMENT</h1>
          <div>${reportData.acknowledgement || "I would like to express my special thanks to my mentors and the company for this opportunity."}</div>
        </div>

        <div class="page-break"></div>

        <!-- Project Description -->
        <div class="section">
          <h1 class="header-2">1. PROJECT DESCRIPTION</h1>
          <div>${reportData.description || "No description provided."}</div>
        </div>

        <div class="page-break"></div>

        <!-- Objectives & Components -->
        <div class="section">
          <h1 class="header-2">2. OBJECTIVES & COMPONENTS</h1>
          <h2 class="header-3">2.1 Objectives</h2>
          <div>${reportData.objectives || "No objectives provided."}</div>
          <h2 class="header-3">2.2 Components / Tools Used</h2>
          <div>${reportData.components_used || "No components provided."}</div>
        </div>

        <div class="page-break"></div>

        <!-- Methodology -->
        <div class="section">
          <h1 class="header-2">3. METHODOLOGY</h1>
          <div>${reportData.methodology || "No methodology provided."}</div>
        </div>

        <div class="page-break"></div>

        <!-- Daily Activities -->
        <div class="section">
          <h1 class="header-2">4. DAILY ACTIVITIES</h1>
          ${
            journals.length > 0
              ? journals
                  .map(
                    (j) => `
            <div style="margin-bottom: 20px;">
              <h3 style="font-size: 12pt; font-weight: bold; background: #f0f0f0; padding: 5px;">Date: ${formatDate(j.date)}</h3>
              <div>${j.activities_performed || "No activities logged."}</div>
            </div>
          `,
                  )
                  .join("")
              : "<p>No daily activities logged.</p>"
          }
        </div>

        <div class="page-break"></div>

        <!-- Observations & Results -->
        <div class="section">
          <h1 class="header-2">5. OBSERVATIONS & RESULTS</h1>
          <h2 class="header-3">5.1 Observations</h2>
          <div>${reportData.observations || "No observations provided."}</div>
          <h2 class="header-3">5.2 Results</h2>
          <div>${reportData.results || "No results provided."}</div>
        </div>

        <div class="page-break"></div>

        <!-- Screenshots -->
        <div class="section">
          <h1 class="header-2">6. SCREENSHOTS & ASSETS</h1>
          ${
            allImages.length > 0
              ? allImages
                  .map(
                    (url) => `
            <div style="margin-bottom: 15px; text-align: center;">
              <img src="${url}" style="max-width: 500px; max-height: 400px; object-fit: contain; border: 1px solid #ccc; padding: 5px;"/>
            </div>
          `,
                  )
                  .join("")
              : "<p>No screenshots found in daily journals.</p>"
          }
        </div>

        <div class="page-break"></div>

        <!-- Conclusion -->
        <div class="section">
          <h1 class="header-2">7. CONCLUSION & FUTURE SCOPE</h1>
          <h2 class="header-3">7.1 Conclusion</h2>
          <div>${reportData.conclusion || "No conclusion provided."}</div>
          <h2 class="header-3">7.2 Future Scope</h2>
          <div>${reportData.future_scope || "No future scope provided."}</div>
        </div>

        <div class="page-break"></div>

        <!-- References -->
        <div class="section">
          <h1 class="header-2">8. REFERENCES</h1>
          <div>${reportData.references || "No references provided."}</div>
        </div>
      </body>
      </html>
    `;
  };

  const wrapHTMLForPDF = (innerHtml: string) => {
    // Add page numbering styles for PDF
    return innerHtml;
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const htmlStr = generateHTMLString();
      const tempContainer = document.createElement("div");
      tempContainer.style.width = "800px";
      tempContainer.innerHTML = htmlStr;

      const opt = {
        margin: 0.75, // TS error fix: use number instead of array or explicit tuple
        filename: `${profile?.full_name?.replace(/\s+/g, "_") || "Student"}_Report.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          windowWidth: 900,
        }, // windowWidth helps ensure layouts don't break if viewport is weird
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["css", "legacy"] },
      };

      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(opt).from(tempContainer).save();
    } catch (err) {
      console.error(err);
      alert("Failed to export PDF format.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    setExporting(true);
    try {
      const htmlStr = generateHTMLString().replace(
        /<div class="page-break"><\/div>/g,
        '<br clear="all" style="page-break-before:always" />',
      );

      // Fallback simple HTML to Word conversion natively supported by Word
      const preHtml =
        "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
      const postHtml = "</body></html>";
      const html = preHtml + htmlStr + postHtml;

      const blob = new Blob(["\ufeff", html], {
        type: "application/msword",
      });

      const fileName = `${profile?.full_name?.replace(/\s+/g, "_") || "Student"}_Report.doc`;

      // Specify link url
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to export DOCX format.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            Generate Report
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col justify-center items-center py-8 gap-4 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p>Gathering journals and report data...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company / Institute Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter the company name for the cover page"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                <CheckCircle className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Report Structure Ready</p>
                  <p className="opacity-80">
                    Your generated report will automatically include:
                  </p>
                  <ul className="list-disc pl-4 mt-2 space-y-1 opacity-80 columns-2">
                    <li>Cover Page</li>
                    <li>Certificate</li>
                    <li>Acknowledgement</li>
                    <li>Project Details</li>
                    <li>Daily Activities ({journals.length} logs)</li>
                    <li>Results & Conclusion</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <Button
                  onClick={handleExportDOCX}
                  disabled={exporting}
                  className="flex-1 gap-2 border-2 border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-700"
                >
                  {exporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileType className="h-5 w-5" />
                  )}
                  Download DOCX
                </Button>

                <Button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex-1 gap-2 bg-red-50 text-red-700 hover:bg-red-100 border-none"
                >
                  {exporting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                  Download PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
