import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PortalLayout from './components/PortalLayout';
import KYCLayout from './components/kyc/KYCLayout';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Route for Fact Finder Form */}
        <Route path="/kyc/*" element={<KYCLayout />} />
        
        {/* Protected Dashboard Route */}
        <Route path="/*" element={<PortalLayout />} />
      </Routes>
    </Router>
  );
};

export default App;