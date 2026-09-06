import { useState } from 'react'
import { Link } from 'react-router-dom'

import ManagerChecklistReport from './ManagerChecklistReport'
import TemperatureCompletionReport from './TemperatureCompletionReport'

function CompletionReports() {

  const [activeReport, setActiveReport] =
    useState('temperature')


  return (
    <main className="content">

      <div className="report-header">

        <div>

          <h1 className="page-title">
            Completion Reports
          </h1>

          <p className="subtitle">
            Review store completion by date range.
          </p>

        </div>


        <Link
          to="/"
          className="header-button secondary"
        >
          Back to Stores
        </Link>

      </div>


      <div className="report-tabs">

        <button
          className={
            activeReport === 'temperature'
              ? 'report-tab active'
              : 'report-tab'
          }
          onClick={() =>
            setActiveReport(
              'temperature'
            )
          }
        >
          Temperature Logs
        </button>


        <button
          className={
            activeReport === 'manager'
              ? 'report-tab active'
              : 'report-tab'
          }
          onClick={() =>
            setActiveReport(
              'manager'
            )
          }
        >
          Manager Checklists
        </button>

      </div>


      {activeReport === 'temperature'
        ? <TemperatureCompletionReport />
        : <ManagerChecklistReport />}

    </main>
  )
}

export default CompletionReports
