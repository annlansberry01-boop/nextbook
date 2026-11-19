import { BrowserRouter, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar'
import Toast from './components/Toast'
import BookPage from './pages/BookPage'
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
        <Route path="/book/:id" element={<BookPage />} />
      </Routes>
      <TabBar />
      <Toast />
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
