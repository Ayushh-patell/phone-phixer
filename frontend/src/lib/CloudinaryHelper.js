import axios  from "axios"
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

 const getHeaders = () => {
    const token = sessionStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };
  const headers = getHeaders();

export const uploadToCloudinary = async (file) => {
  const { data } = await axios.get(`${API_BASE_URL}/kyc/sign-upload`, {
    headers
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", data.apiKey);
  formData.append("timestamp", data.timestamp);
  formData.append("signature", data.signature);
  formData.append("folder", "user_kyc_documents");

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${data.cloudName}/auto/upload`,
    formData
  );

  return {
    url: res.data.secure_url,
    publicId: res.data.public_id,
    // Add the resource_type to your return object so your DB knows what it is
    resourceType: res.data.resource_type 
  };
};

export const getThumbnailUrl = (url, resourceType) => {
  if (resourceType === 'video') {
    return url.replace('/video/upload/', '/video/upload/w_200,h_200,c_fill,so_0/'); // First frame of video
  }
  // This works for both images and PDFs (it forces a JPG conversion for PDFs)
  return url.replace('/upload/', '/upload/w_200,h_200,c_fill,f_jpg/');
};