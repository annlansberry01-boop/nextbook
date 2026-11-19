import { Link } from 'react-router-dom'
import { PlusIcon, SearchIcon } from '../components/Icons'

export default function Home() {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Next Book</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/search" className="icon-btn" aria-label="Search">
            <SearchIcon size={20} />
          </Link>
          <button className="icon-btn accent" aria-label="Add a book">
            <PlusIcon />
          </button>
        </div>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="section-label">Currently reading</h2>
        <div className="placeholder-card">
          Your books will appear here once we connect the database and import your reading log.
        </div>
      </section>
    </main>
  )
}
