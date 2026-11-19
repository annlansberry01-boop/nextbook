import { BrowserRouter, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import Home from './pages/Home'
import Discover from './pages/Discover'
import MyBooks from './pages/MyBooks'
import Search from './pages/Search'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/books" element={<MyBooks />} />
        <Route path="/search" element={<Search />} />
      </Routes>
      <TabBar />
    </BrowserRouter>
  )
}
