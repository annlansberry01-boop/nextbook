import { NavLink } from 'react-router-dom'
import { BooksIcon, DiscoverIcon, HomeIcon, SearchIcon } from './Icons'
import './TabBar.css'

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/discover', label: 'Discover', Icon: DiscoverIcon, end: false },
  { to: '/books', label: 'My books', Icon: BooksIcon, end: false },
  { to: '/search', label: 'Search', Icon: SearchIcon, end: false },
]

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="tab">
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
