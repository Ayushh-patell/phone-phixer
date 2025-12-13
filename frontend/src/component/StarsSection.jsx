import YearlyChecksCompact from './YearlyChecks'

const StarsSection = () => {
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mb-1">
            My Star
          </h1>
          <p className="text-sm text-slate-400">
            View your Star Level and check eligibility for upgrade.
          </p>
        </div>
      </div>

      <YearlyChecksCompact/>

    </div>
  )
}

export default StarsSection
