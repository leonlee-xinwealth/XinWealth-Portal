import React, { useState } from 'react';

interface RegisterProps {
  onNavigateToLogin: () => void;
}

const Register: React.FC<RegisterProps> = ({ onNavigateToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    icNumber: '',
    contactNumber: '',
    emailAddress: '',
    nationality: 'Malaysian',
    maritalStatus: 'Single',
    occupation: '',
    employmentStatus: 'Employed',
    taxStatus: 'Tax Resident'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError("You are already an existing client. No need to apply again.");
        } else {
          setError(data.error || 'Failed to register account. Please try again.');
        }
      } else {
        setSuccess(true);
        // Clear form
        setFormData({
          fullName: '',
          icNumber: '',
          contactNumber: '',
          emailAddress: '',
          nationality: 'Malaysian',
          maritalStatus: 'Single',
          occupation: '',
          employmentStatus: 'Employed',
          taxStatus: 'Tax Resident'
        });
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("Network error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-xin-blue rounded-b-[4rem] z-0"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-xin-gold opacity-10 rounded-full blur-3xl animate-float-slow"></div>

      {/* Register Card */}
      <div className="relative z-10 w-full max-w-2xl bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl animate-fade-in-up">
        
        <div className="text-center mb-10">
            <h1 className="font-serif text-4xl font-bold text-xin-blue tracking-tighter mb-2">Xin<span className="text-xin-gold">Wealth</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">Account Registration</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
            <p className="font-semibold">Registration Failed</p>
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded">
            <p className="font-semibold">Success!</p>
            <p>Your account has been registered successfully. We will process your application.</p>
            <div className="mt-4">
              <button 
                onClick={onNavigateToLogin}
                className="text-green-800 font-medium underline"
              >
                Return to Login
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. IC Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">IC Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
                placeholder="e.g. John Doe"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
              />
            </div>

            {/* 2. IC Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">IC Number *</label>
              <input
                type="text"
                name="icNumber"
                value={formData.icNumber}
                onChange={handleChange}
                required
                placeholder="e.g. 900101-14-5555"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
              />
            </div>

            {/* 3. Contact Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Contact Number *</label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                required
                placeholder="e.g. +60123456789"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
              />
            </div>

            {/* 4. Email Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Email Address *</label>
              <input
                type="email"
                name="emailAddress"
                value={formData.emailAddress}
                onChange={handleChange}
                required
                placeholder="e.g. john@example.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
              />
            </div>

            {/* 5. Nationality */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Nationality *</label>
              <select
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue font-medium"
              >
                <option value="Malaysian">Malaysian</option>
                <option value="Non-Malaysian">Non-Malaysian</option>
              </select>
            </div>

            {/* 6. Marital Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Marital Status *</label>
              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue font-medium"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>

            {/* 7. Occupation */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Occupation *</label>
              <input
                type="text"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                required
                placeholder="e.g. Software Engineer"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
              />
            </div>

            {/* 8. Employment Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Employment Status *</label>
              <select
                name="employmentStatus"
                value={formData.employmentStatus}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue font-medium"
              >
                <option value="Employed">Employed</option>
                <option value="Self-Employed">Self-Employed</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Student">Student</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            {/* 9. Tax Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Tax Status *</label>
              <select
                name="taxStatus"
                value={formData.taxStatus}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue font-medium"
              >
                <option value="Tax Resident">Tax Resident</option>
                <option value="Non-Tax Resident">Non-Tax Resident</option>
              </select>
            </div>

          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between border-t border-slate-100 gap-4">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-slate-400 hover:text-xin-blue font-bold text-sm transition"
            >
              &larr; Back to Login
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className={`w-full md:w-auto bg-xin-blue text-white px-8 py-4 rounded-2xl text-sm font-bold tracking-[0.2em] uppercase hover:bg-xin-blueLight transition-all shadow-xl shadow-xin-blue/20 hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
