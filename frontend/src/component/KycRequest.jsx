import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  FiClipboard, FiAlertTriangle, FiClock, FiCheckCircle, FiXCircle,
  FiSearch, FiRefreshCw, FiShield, FiUser, FiUploadCloud, FiFileText, FiEye,
  FiVideo, FiChevronLeft, FiChevronRight, FiFilter,
  FiPackage
} from "react-icons/fi";
import { uploadToCloudinary, getThumbnailUrl } from "../lib/CloudinaryHelper";

const TEST_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; 
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const statusMeta = {
  pending: { label: "Pending", icon: FiClock, badge: "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800" },
  verified: { label: "Verified", icon: FiCheckCircle, badge: "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700" },
  rejected: { label: "Rejected", icon: FiXCircle, badge: "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700" },
  "re-upload_required": { label: "Re-upload", icon: FiRefreshCw, badge: "inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800" },
};

const KycSection = ({ user }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // User Submission State
  const [uploading, setUploading] = useState(false);
  const [aadharFile, setAadharFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [agreementFile, setAgreementFile] = useState(null);

  const isAdmin = !!(user?.admin || user?.isAdmin || user?.role === "admin");
//   const isAdmin = false;
  
const authConfig = () => {
  const token = sessionStorage.getItem("token");
  
  return {
    headers: { Authorization: `Bearer ${token}` }
  }};

  const fetchKycData = async () => {
    try {
      setLoading(true);
      setError("");
      const endpoint = isAdmin 
        ? `${API_BASE_URL}/kyc/admin/list?status=${statusFilter === 'all' ? '' : statusFilter}&page=${page}` 
        : `${API_BASE_URL}/kyc/my-status`;
      
      const res = await axios.get(endpoint, authConfig());
      
      if (isAdmin) {
        setItems(res.data?.kycRequests || []);
        setTotalPages(res.data?.pages || 1);
      } else {
        setItems(res.data ? [res.data] : []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load KYC data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, [isAdmin, statusFilter, page]);

  const handleKycSubmit = async () => {
    if (!aadharFile || !panFile || !videoFile || !agreementFile) {
      return setError("All 3 steps are mandatory. Please upload all files.");
    }

    try {
      setUploading(true);
      setError("");

      const filesToUpload = [
        { file: aadharFile, label: "Aadhar" },
        { file: panFile, label: "PAN" },
        { file: videoFile, label: "Video" },
        { file: agreementFile, label: "Agreement" }
      ];

      const uploadedFiles = await Promise.all(
        filesToUpload.map(async ({ file, label }) => {
          const cloudRes = await uploadToCloudinary(file);
          return {
            url: cloudRes.url,
            cloudinaryId: cloudRes.publicId,
            fileType: file.type.includes("video") ? "video" : file.type.includes("pdf") ? "pdf" : "image",
            label
          };
        })
      );

      await axios.post(`${API_BASE_URL}/kyc/submit`, {
        documentType: "Full Bundle Verification",
        kycFiles: uploadedFiles
      }, authConfig());

      // Reset files
      setAadharFile(null); setPanFile(null); setVideoFile(null); setAgreementFile(null);
      fetchKycData();
    } catch (err) {
      setError("Upload failed. Please check your connection and file sizes.");
    } finally {
      setUploading(false);
    }
  };

  const [adminNote, setAdminNote] = useState("");
  const handleReview = async (id, status) => {
    try {
      await axios.put(`${API_BASE_URL}/kyc/admin/review/${id}`, { status, adminNote }, authConfig());
      setAdminNote("");
      fetchKycData();
    } catch (err) {
      setError("Review update failed.");
    }
  };

  const UploadBox = ({ label, icon: Icon, accept, onChange, file, limit }) => (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-prim/50">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-prim/10 text-prim">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-neutral-900">{label}</h3>
          <p className="text-[10px] text-neutral-500 uppercase font-medium">Limit: {limit}MB</p>
        </div>
      </div>
      <label className="relative cursor-pointer">
        <div className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-colors ${file ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files[0];
              if (selected && selected.size > limit * 1024 * 1024) {
                setError(`${label} exceeds ${limit}MB.`);
              } else {
                onChange(selected);
              }
            }}
          />
          <span className="text-xs font-semibold text-neutral-600">
            {file ? "Change File" : "Select File"}
          </span>
        </div>
      </label>
      {file && <p className="mt-2 text-[10px] text-emerald-600 font-bold truncate">✓ {file.name}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-neutral-50/30">
      {/* Header & Filter Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 tracking-tighter">
            <FiShield className="text-prim" /> {isAdmin ? "KYC Terminal" : "Verification Center"}
          </h1>
          <p className="text-sm text-neutral-500">Securely manage and verify identity documents.</p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-neutral-200 shadow-sm">
            <FiFilter className="ml-3 text-neutral-400" />
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs font-bold p-2 outline-none bg-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3">
          <FiAlertTriangle className="shrink-0" /> {error}
        </div>
      )}

      {/* List/Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <FiRefreshCw className="animate-spin text-prim h-10 w-10" />
          <p className="text-sm font-bold text-neutral-400">Loading Database...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((kyc) => (
              <div key={kyc._id} className="group relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-md font-black text-neutral-900 flex items-center gap-2">
                      <FiUser className="text-neutral-300" /> {kyc.userId?.name || "Client File"}
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Ref: {kyc._id.slice(-8)}</p>
                  </div>
                  <div className={statusMeta[kyc.status]?.badge}>
                    {kyc.status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                  {kyc.kycFiles?.map((file, idx) => (

                    file.fileType === 'video' ?
                    <a key={idx} href={isAdmin? file.url : "#"} target="_blank" rel="noreferrer" className="relative shrink-0 overflow-hidden rounded-xl border border-neutral-100">
                        <div className="h-20 w-full flex justify-center items-center object-cover transition-transform bg-slate-100">
                            <FiVideo/>
                        </div>
                    </a>
                    :
                    <a key={idx} href={isAdmin? file.url : "#"} target="_blank" rel="noreferrer" className="relative shrink-0 overflow-hidden rounded-xl border border-neutral-100">

                      <img 
                        src={getThumbnailUrl(file.url, file.fileType)} 
                        alt="KYC Doc" 
                        className="h-20 w-full object-cover transition-transform bg-slate-100" 
                      />
                    </a>
   
                  ))}
                </div>

                {kyc.adminNote && (
                  <div className="mb-6 rounded-xl bg-neutral-50 p-3 text-[11px] text-neutral-600 border-l-4 border-neutral-300 italic">
                    "{kyc.adminNote}"
                  </div>
                )}

                {isAdmin && kyc.status === 'pending' && (
                  <div className="space-y-4">
                    <textarea 
                      placeholder="Add administrative feedback..."
                      onChange={(e) => setAdminNote(e.target.value)}
                      className="w-full text-xs p-3 border border-neutral-200 rounded-xl outline-none focus:border-prim min-h-[60px] bg-neutral-50/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(kyc._id, 'rejected')} className="flex-1 bg-white text-red-600 p-3 rounded-xl text-xs font-black uppercase border border-red-100 hover:bg-red-50 transition-colors">Reject</button>
                      <button onClick={() => handleReview(kyc._id, 'verified')} className="flex-1 bg-prim text-neutral-900 p-3 rounded-xl text-xs font-black uppercase hover:shadow-lg transition-all">Approve</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {items.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-200">
              <div className="bg-neutral-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                <FiFileText size={32} />
              </div>
              <p className="text-neutral-500 font-bold">No KYC records found here.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {isAdmin && totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-3 rounded-full bg-white border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30"
              >
                <FiChevronLeft />
              </button>
              <span className="text-xs font-black text-neutral-400 uppercase tracking-tighter">
                Page <span className="text-neutral-900">{page}</span> of {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-3 rounded-full bg-white border border-neutral-200 hover:bg-neutral-50 disabled:opacity-30"
              >
                <FiChevronRight />
              </button>
            </div>
          )}
        </>
      )}

      {/* Submission Section for Users */}
      {!isAdmin && (!items[0] || items[0]?.status === 'rejected' || items[0]?.status === 're-upload_required') && (
        <div className="space-y-8 bg-white p-6 rounded-3xl border border-neutral-200 shadow-xl mt-12">
          <div className="grid gap-8">
            <section>
              <h2 className="text-sm font-black uppercase text-neutral-400 mb-4 flex items-center gap-2 tracking-widest">
                <span className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">01</span> Document Verification
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <UploadBox label="Aadhaar Card" icon={FiFileText} accept="image/*,.pdf" limit={10} onChange={setAadharFile} file={aadharFile} />
                <UploadBox label="PAN Card" icon={FiFileText} accept="image/*,.pdf" limit={10} onChange={setPanFile} file={panFile} />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase text-neutral-400 mb-4 flex items-center gap-2 tracking-widest">
                <span className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">02</span> Video Authentication
              </h2>
              <UploadBox label="Selfie Video (Face Match)" icon={FiVideo} accept="video/*" limit={50} onChange={setVideoFile} file={videoFile} />
            </section>

            <section>
              <h2 className="text-sm font-black uppercase text-neutral-400 mb-4 flex items-center gap-2 tracking-widest">
                <span className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px]">03</span> Legal Agreement
              </h2>
              <UploadBox label="Signed PDF Agreement" icon={FiClipboard} accept=".pdf" limit={15} onChange={setAgreementFile} file={agreementFile} />
            </section>
          </div>

          <button
            onClick={handleKycSubmit}
            disabled={uploading}
            className="w-full mt-6 flex items-center justify-center gap-3 rounded-2xl bg-prim py-5 font-black uppercase tracking-tighter transition-all hover:scale-[1.01] active:scale-[0.99] disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {uploading ? <FiRefreshCw className="animate-spin h-5 w-5" /> : <FiUploadCloud className="h-5 w-5" />}
            {uploading ? "Securing Documents..." : "Submit Bundle for Verification"}
          </button>
        </div>
      )}


    </div>
  );
};

export default KycSection;