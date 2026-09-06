import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '../lib/supabase'

function Home() {

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStores()
  }, [])


  async function loadStores() {

    setLoading(true)
    setError('')

    const { data, error } =
      await supabase
        .from('stores')
        .select('*')
        .eq('active', true)
        .order('name')

    if (error) {
      setError(error.message)
    } else {
      setStores(data || [])
    }

    setLoading(false)
  }


  return (
    <main className="content">

      <section className="home-hero">
        <div>
          <div className="eyebrow">Operations workspace</div>
          <h1 className="page-title">Restaurant Task List</h1>
          <p className="subtitle">Select a store to review today's operational logbooks and outstanding tasks.</p>
        </div>
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Live operations
        </div>
      </section>

      {loading && (
        <div className="store-grid" aria-label="Loading stores">
          {[1, 2, 3].map(item => (
            <div className="store-card loading-card" key={item}>
              <span className="loading-icon" />
              <span className="loading-lines"><span /><span /></span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="error">
          Database error: {error}
        </p>
      )}

      {!loading && !error && (

        <div className="store-grid">

          {stores.map(store => (

            <Link
              key={store.id}
              to={`/store/${store.id}`}
              className="store-card"
            >

              <span className="store-icon">
                🏪
              </span>

              <span>
                {store.name}
              </span>

              <span className="arrow">
                →
              </span>

            </Link>

          ))}

        </div>

      )}

    </main>
  )
}

export default Home
