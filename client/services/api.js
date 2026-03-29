import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api/pipeline",
});

export const analyzeFloorPlan = async (file) => {
  const formData = new FormData();
  formData.append("floorPlan", file);

  const response = await API.post("/analyze", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};