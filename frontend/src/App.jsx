import React from 'react'
import { Link } from 'react-router'
import HeroSection from './component/Landing/HeroSection'
import AboutPhonePhixer from './component/Landing/AboutSection'
import TrustSection from './component/Landing/TrustSection'
import WhyChoosePhonePhixer from './component/Landing/WhyChooseSection'
import HowItWorks from './component/Landing/HowWorksSection'
import RegistrationBenefits from './component/Landing/BenefitSection'
import FrequentIssuesSection from './component/Landing/IssueSection'
import PricingPlansGrid from './component/Landing/ReferralSection'
import ContactSection from './component/Landing/ContactSection'

const App = () => {
  return (
    <>
      <HeroSection/>
      <AboutPhonePhixer/>
      <TrustSection/>
      <WhyChoosePhonePhixer/>
      <HowItWorks/>
      <RegistrationBenefits/>
      <FrequentIssuesSection/>
      <PricingPlansGrid/>
      <ContactSection/>
    </>
  )
}

export default App
