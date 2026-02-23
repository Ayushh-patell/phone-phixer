import { useEffect, useState } from "react";
import axios from "axios";
import AdminUserDetail from "./AdminUserDetail";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // pagination / ui state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // =============================
  // Fetch users list
  // =============================
  const fetchUsers = async (pageNum = 1, searchTerm = "") => {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("token");

      const res = await axios.get(`${API_BASE_URL}/admin/users`, {
        params: { page: pageNum, search: searchTerm },
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers(res.data?.users || []);
      setPages(res.data?.pages || 1);
      setPage(res.data?.page || 1);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ LOAD ON MOUNT
  useEffect(() => {
    fetchUsers(1);
  }, []);

  const handleUserClick = (id) => {
    setSelectedUserId(id);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* LEFT — user list */}
      <div className="col-span-4 space-y-2">
        {loading && (
          <div className="text-sm text-neutral-500">Loading users…</div>
        )}

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-sm text-neutral-500">No users found.</div>
        )}

        {users.map((u) => {
          const id = u.id || u._id;

          return (
            <button
              key={id}
              onClick={() => handleUserClick(id)}
              className="w-full text-left border p-3 rounded-lg hover:bg-neutral-50"
            >
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs text-neutral-500">{u.email}</div>
            </button>
          );
        })}
      </div>

      {/* RIGHT — detail panel */}
      <div className="col-span-8">
        {selectedUserId ? (
          <AdminUserDetail userId={selectedUserId} />
        ) : (
          <div className="text-sm text-neutral-500 p-6">
            Select a user to view details.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;