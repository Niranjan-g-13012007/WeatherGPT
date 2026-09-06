import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { LocationProvider } from './context/LocationContext.jsx'
import { AlertProvider } from './context/AlertContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Assistant from './pages/Assistant.jsx'
import Forecast from './pages/Forecast.jsx'
import Climate from './pages/Climate.jsx'
import About from './pages/About.jsx'

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <LocationProvider>
          <AlertProvider>
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
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute>
                    <Assistant />
                  </ProtectedRoute>
                }
              />
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
                path="/climate"
                element={
                  <>
                    <Navbar />
                    <Climate />
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
        </AlertProvider>
      </LocationProvider>
    </LanguageProvider>
  </AuthProvider>
)
}
