import axios from "axios";
import { useEffect, useState } from "react";
import ReferralTreeViewOnly from "./ReferralTreeViewOnly";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminUserDetail = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false); // 🔹 Modal state

  const getHeaders = () => {
    const token = sessionStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const headers = getHeaders();

      const userRes = await axios.get(`${API_BASE_URL}/users/admin/user`, {
        headers,
        params: { treeOwnerId: userId },
      });
      setUser(userRes.data);

      const treeRes = await axios.get(`${API_BASE_URL}/referrals/tree`, {
        headers,
        params: { rootUserId: userId },
      });
      setTreeData(treeRes.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    load();
  }, [userId]);

  const handleRoleToggle = async () => {
    const id = userId;
    const newRole = user.role === 'user' ? 'admin' : 'user';
    if (!confirm(`Are you sure you want to change the role of this user to ${newRole}?`)) return;

    try {
      const headers = getHeaders();
      await axios.patch(`${API_BASE_URL}/users/admin/role`, 
        { userId: id, role: newRole },
        { headers }
      );
      alert("User status updated successfully");
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  // 🔹 API Call for updating info
  const handleUpdateUser = async (formData) => {
    try {
      const headers = getHeaders();
      await axios.put(`${API_BASE_URL}/users/admin/user/${userId}`, formData, { headers });
      alert("User updated successfully!");
      setShowEditModal(false);
      load(); // Refresh data
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md border-t-4 border-t-prim">
        <h3 className="font-semibold text-lg mb-3 flex justify-between items-center gap-2">
          <span>User Details</span> 
          <div className="flex gap-4">
             {/* 🔹 Edit Button */}
            <span className="text-sm text-blue-600 cursor-pointer" onClick={() => setShowEditModal(true)}>Edit Info</span>
            <span className="text-sm text-orange-600 cursor-pointer" onClick={handleRoleToggle}>Change Role</span>
          </div>
        </h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Name" value={user.name} />

          <Info label="Email" value={user.email} />

          <Info label="Date of Birth" value={user.dob} type={'date'} />

          <Info label="Phone" value={user.phone} />

          <Info label="Address" value={user.address} />

          <Info label="Role" value={user.role} />

          <Info label="Star" value={user.star} />

          <Info label="Wallet" value={user.walletBalance} />

          <Info label="Total Earnings" value={user.totalEarnings} />

          <Info label="Self Volume" value={user.selfVolume} />

          <Info label="Left Volume" value={user.leftVolume} />

          <Info label="Right Volume" value={user.rightVolume} />

          <Info label="RSP" value={user.rsp} />

          <Info label="Total RSP" value={user.Totalrsp} />

          <Info label="Checks Claimed" value={user.checksClaimed} />
        </div>
      </div>

      {/* 🔹 Render the Modal */}
      {showEditModal && (
        <EditUserModal 
          user={user} 
          onClose={() => setShowEditModal(false)} 
          onSave={handleUpdateUser} 
        />
      )}

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md border-t-4 border-t-prim">
        <h3 className="font-semibold text-lg mb-3">Referral Tree</h3>
        <ReferralTreeViewOnly treeData={treeData} />
      </div>
    </div>
  );
};

// 🔹 NEW MODAL COMPONENT
const EditUserModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: user.name || "",
    dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : "",
    phone: user.phone || "",
    address: user.address || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">Update User Info</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Full Name</label>
            <input name="name" value={formData.name} onChange={handleChange} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Date of Birth</label>
            <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Phone Number</label>
            <input name="phone" value={formData.phone} onChange={handleChange} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Address</label>
            <textarea name="address" value={formData.address} onChange={handleChange} className="w-full border rounded-lg p-2" rows="3" required />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-neutral-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-prim text-white rounded-lg bg-orange-600 hover:bg-orange-700">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Info = ({ label, value, type = 'string' }) => (
  <div>
    <div className="text-xs text-neutral-500">{label}</div>
    {value ?
      <div className="font-semibold">{type == "date" ? new Date(value).toDateString() : value}</div>
      :
      <div className="font-semibold">-</div>
    }
  </div>
);

export default AdminUserDetail;