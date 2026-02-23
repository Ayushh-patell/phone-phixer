import axios from "axios";
import { useEffect, useState } from "react";
import ReferralTreeViewOnly from "./ReferralTreeViewOnly";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AdminUserDetail = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getHeaders = () => {
    const token = sessionStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const headers = getHeaders();

        // 🔹 fetch user details
        const userRes = await axios.get(
          `${API_BASE_URL}users/admin/user`,
          {
            headers,
            params: { treeOwnerId: userId },
          }
        );

        setUser(userRes.data);

        // 🔹 fetch user's tree
        const treeRes = await axios.get(
          `${API_BASE_URL}/referrals/tree`,
          {
            headers,
            params: { rootUserId: userId },
          }
        );

        setTreeData(treeRes.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load user.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* 🔹 USER INFO */}
      <div className="rounded-xl border p-4 bg-white">
        <h3 className="font-semibold text-lg mb-3">
          User Details
        </h3>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Name" value={user.name} />
          <Info label="Email" value={user.email} />
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

      {/* 🔹 TREE VIEW (VIEW ONLY) */}
      <div className="rounded-xl border p-4 bg-white">
        <h3 className="font-semibold text-lg mb-3">
          Referral Tree
        </h3>

        <ReferralTreeViewOnly treeData={treeData} />
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs text-neutral-500">{label}</div>
    <div className="font-semibold">{value ?? "-"}</div>
  </div>
);

export default AdminUserDetail;