import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LocationProvider } from './context/LocationContext.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Assistant from './pages/Assistant.jsx'
import Forecast from './pages/Forecast.jsx'
import About from './pages/About.jsx'

export default function App() {
  return (
    <LocationProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <Home />
              </>
            }
          />
          <Route
            path="/login"
            element={
              <>
                <Navbar />
                <Login />
              </>
            }
          />
          <Route
            path="/signup"
            element={
              <>
                <Navbar />
                <Signup />
              </>
            }
          />
          <Route path="/assistant" element={<Assistant />} />
          <Route
            path="/forecast"
            element={
              <>
                <Navbar />
                <Forecast />
              </>
            }
          />
          <Route
            path="/about"
            element={
              <>
                <Navbar />
                <About />
              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </LocationProvider>
  )
}
