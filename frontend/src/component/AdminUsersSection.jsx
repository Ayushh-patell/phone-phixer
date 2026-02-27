import { useEffect, useState } from "react";
import axios from "axios";
import AdminUserDetail from "./AdminUserDetail";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchUsers = async (pageNum = 1, search = "") => {
    try {
      setLoading(true);
      setError("");
      const token = sessionStorage.getItem("token");

      const res = await axios.get(`${API_BASE_URL}/users/admin/users`, {
        params: { page: pageNum, search: search },
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(res.data?.users || []);
      setPages(res.data?.pages || 1);
      setPage(res.data?.page || 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, searchTerm);
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, searchTerm);
  };

  const handleDisableToggle = async (user) => {
    const id = user._id || user.id;
    const action = user.isDisabled ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      const token = sessionStorage.getItem("token");
      // Note: Usually updates use PATCH/PUT. 
      // If your backend uses GET for this, change back to .get
      await axios.patch(`${API_BASE_URL}/users/admin/disable`, 
        { userId: id, isDisable: !user.isDisabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("User status updated successfully");
      fetchUsers(page, searchTerm);
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-12 gap-6">
        
        {/* LEFT — User List */}
        <div className="col-span-12 md:col-span-4 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search users..." 
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="bg-neutral-800 text-white px-3 py-2 rounded-lg text-sm">Find</button>
          </form>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2">
            {loading && <p className="text-center py-4 text-neutral-500">Loading...</p>}
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            {users.map((u) => {
              const id = u._id || u.id;
              const isActive = selectedUserId === id;

              return (
                <div
                  key={id}
                  className={`group relative flex justify-between items-center p-4 rounded-xl border transition-all cursor-pointer
                    ${isActive 
                      ? "border-blue-500 bg-blue-50 shadow-sm" 
                      : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md"
                    }`}
                  onClick={() => setSelectedUserId(id)}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-800 truncate">{u.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents selecting user when clicking button
                      handleDisableToggle(u);
                    }}
                    className={`ml-2 text-xs font-medium px-2.5 py-1 rounded-full border transition
                      ${u.isDisabled 
                        ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                        : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                      }`}
                  >
                    {u.isDisabled ? "Disabled" : "Active"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Simple Pagination */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-sm disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-400">Page {page} of {pages}</span>
            <button 
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
              className="text-sm disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>

        {/* RIGHT — Detail Panel */}
        <div className="col-span-12 md:col-span-8">
          <div className="bg-neutral-50 rounded-2xl border border-dashed border-neutral-300 min-h-[500px] flex items-center justify-center">
            {selectedUserId ? (
              <div className="w-full h-full bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <AdminUserDetail userId={selectedUserId} />
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-neutral-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <p className="text-neutral-500">Select a user to manage their profile</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;