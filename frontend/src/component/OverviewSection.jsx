import ReferralTree from "./ReferralTree";
import TopMetrics from "./TopMetrics";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const OverviewSection = ({user}) => {


  return (
    <>
      {/* Metrics */}
     <TopMetrics userDetails={user} />

      {/* Referral Tree */}
      <ReferralTree/>
    </>
  );
};

export default OverviewSection;
