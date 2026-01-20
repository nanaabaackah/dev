import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar, Container, Button } from 'react-bootstrap'; // Import Container and Button
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import 'bootstrap/dist/css/bootstrap.min.css';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login'; // Redirect to login page
  };

  const token = localStorage.getItem('token'); // Check for token to conditionally render logout button

  return (
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="/">KPI Dashboard</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
            {token && ( // Only show logout button if token exists
              <Button variant="outline-light" onClick={handleLogout}>
                Logout
              </Button>
            )}
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
