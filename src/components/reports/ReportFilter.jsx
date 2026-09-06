function ReportFilter({
  stores,
  selectedStore,
  setSelectedStore,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onApply,
  loading
}) {

  return (
    <section className="report-filter-card">

      <div className="report-filter">

        <div className="form-section">

          <label>
            Filter by Store
          </label>

          <select
            value={selectedStore}
            onChange={e =>
              setSelectedStore(
                e.target.value
              )
            }
          >

            <option value="all">
              All Stores
            </option>

            {stores.map(store => (

              <option
                key={store.id}
                value={store.id}
              >
                {store.name}
              </option>

            ))}

          </select>

        </div>


        <div className="form-section">

          <label>
            From
          </label>

          <input
            type="date"
            value={fromDate}
            onChange={e =>
              setFromDate(
                e.target.value
              )
            }
          />

        </div>


        <div className="form-section">

          <label>
            To
          </label>

          <input
            type="date"
            value={toDate}
            onChange={e =>
              setToDate(
                e.target.value
              )
            }
          />

        </div>


        <div className="filter-action">

          <button
            className="submit-button"
            onClick={onApply}
            disabled={loading}
          >
            {loading
              ? 'Loading...'
              : 'Apply Filter'}
          </button>

        </div>

      </div>

    </section>
  )
}

export default ReportFilter
