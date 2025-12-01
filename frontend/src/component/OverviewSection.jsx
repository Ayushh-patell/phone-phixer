import ReferralTree from "./ReferralTree";
import TopMetrics from "./TopMetrics";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const OverviewSection = ({ user }) => {
    console.log(user);


  return (
    <>
      {/* Metrics */}
     <TopMetrics/>

      {/* Referral Tree */}
      <ReferralTree/>
    </>
  );
};

export default OverviewSection;
