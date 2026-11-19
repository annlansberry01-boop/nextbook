import { BrowserRouter, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
import Home from './pages/Home'
import Discover from './pages/Discover'
import MyBooks from './pages/MyBooks'
import Search from './pages/Search'
import SignIn from './pages/SignIn'

function Shell() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <SignIn />

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

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
