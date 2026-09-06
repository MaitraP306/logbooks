function ReportStatus({
  status
}) {

  if (status === '✓') {

    return (
      <span className="report-status complete">
        ✓
      </span>
    )
  }


  return (
    <span className="report-status missing">
      NC
    </span>
  )
}

export default ReportStatus
