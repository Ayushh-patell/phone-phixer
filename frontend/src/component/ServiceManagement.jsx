import axios from "axios";
import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiX, FiZap } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


const serviceApi = {
  // Helper to get the current config with token
  getAuthConfig: () => {
    const token = sessionStorage.getItem("token");
    return {
      headers: { Authorization: `Bearer ${token}` },
    };
  },

  // 1. CREATE SERVICE
  // Usage: await serviceApi.createService({ name: 'Pro Plan', price: 100 ... })
  createService: async (serviceData) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/service/create`,
        serviceData,
        serviceApi.getAuthConfig()
      );
      return res.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  },

  // 2. UPDATE SERVICE
  // Usage: await serviceApi.updateService('123', { price: 150 })
  updateService: async (id, updatedData) => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/service/${id}`,
        updatedData,
        serviceApi.getAuthConfig()
      );
      return res.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  },

  // 3. DELETE SERVICE
  // Usage: await serviceApi.deleteService('123')
  deleteService: async (id) => {
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/service/${id}`,
        serviceApi.getAuthConfig()
      );
      return res.data;
    } catch (err) {
      throw err.response?.data || err.message;
    }
  }
};

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    uv: "",
    validityDays: "",
    deviceCovered: 1
  });

  const authConfig = () => {
    const token = sessionStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  // --- 1. SERVICE FETCH ---
  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/service`, authConfig());
      setServices(res.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // --- 2. CREATE / UPDATE LOGIC ---
const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    // Strip metadata before sending to API
    const { _id, __v, ...payload } = formData;

    if (editingService) {
      await serviceApi.updateService(editingService._id, payload);
    } else {
      await serviceApi.createService(payload);
    }
    resetForm();
    fetchServices();
  } catch (err) {
    // Improved error display
    alert("Operation failed: " + (err.message || JSON.stringify(err)));
  }
};

  // --- 3. DELETE LOGIC ---
const handleRemove = async (id) => {
  if (!window.confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
    return;
  }
  
  try {
    await serviceApi.deleteService(id);
    fetchServices(); 
  } catch (err) {
    alert("Delete failed: " + (err.message || err));
  }
};

  const resetForm = () => {
    setFormData({ name: "", description: "", price: "", uv: "", validityDays: "" });
    setEditingService(null);
    setShowForm(false);
  };

  const handleEditClick = (service) => {
    setEditingService(service);
    setFormData(service);
    setShowForm(true);
  };

  const inputClass = "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm focus:ring-2 focus:ring-prim/40 focus:border-prim outline-none";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* --- HEADER & CREATE BUTTON --- */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Service Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-prim text-neutral-900 px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition"
        >
          {showForm ? <FiX /> : <FiPlus />}
          {showForm ? "Close Form" : "Create New Service"}
        </button>
      </div>

      {/* --- CREATE / UPDATE FORM --- */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-10 p-6 border border-neutral-200 rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-2">{editingService ? "Update Service" : "New Service Details"}</h2>
          </div>
          <label htmlFor="ServiceName">
            <span>Name</span>
            <input className={inputClass} placeholder="Service Name" id="ServiceName" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
          </label>
          <label htmlFor="ServicePrice">
            <span>Price</span>
          <input className={inputClass} placeholder="Price (INR)" id="ServicePrice" type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required />
          </label>
          <label htmlFor="ServiceUV">
            <span>UV Value</span>
          <input className={inputClass} placeholder="UV Value" id="ServiceUV" type="number" value={formData.uv} onChange={(e) => setFormData({...formData, uv: e.target.value})} required />
          </label>
          <label htmlFor="ServiceValidity">
            <span>Validity</span>
          <input className={inputClass} placeholder="Validity (Days)" id="ServiceValidity" type="number" value={formData.validityDays} onChange={(e) => setFormData({...formData, validityDays: e.target.value})} required />
          </label>
          <label htmlFor="ServiceDesc">
            <span>Description</span>
          <textarea className={`${inputClass} md:col-span-2`} id="ServiceDesc" placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </label>
          <label htmlFor="ServiceDevices">
            <span>Devices Covered</span>
          <input className={inputClass} placeholder="Devices Covered" id="ServiceDevices" type="number" value={formData.deviceCovered} onChange={(e) => setFormData({...formData, deviceCovered: e.target.value})} required />
          </label>
          <button type="submit" className="md:col-span-2 bg-neutral-900 text-white py-2.5 rounded-xl font-semibold hover:bg-neutral-800 transition">
            {editingService ? "Save Changes" : "Create Service"}
          </button>
        </form>
      )}

      {/* --- SERVICE LISTING --- */}
      {loading ? (
        <div className="text-center py-10">Loading services...</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {services.map((service) => (
            <div key={service._id} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
              
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{service.name}</h2>
                  <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{service.description}</p>
                </div>
                
                {/* --- ACTION BUTTONS --- */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditClick(service)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit"
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleRemove(service._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-900">
                  ₹ {service.price}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-prim/40 bg-prim/15 px-3 py-1 font-semibold text-neutral-900">
                  <FiZap className="h-3.5 w-3.5" /> UV {service.uv}
                </span>
                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                  {service.validityDays} Days
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;