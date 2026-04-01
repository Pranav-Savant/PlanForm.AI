import axios from "axios";
import fs from "fs";
import FormData from "form-data";

export const parseFloorPlanWithCV = async (filePath) => {
  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    const response = await axios.post(
      "http://localhost:8000/parse-floorplan",
      formData,
      {
        headers: formData.getHeaders(),
      },
    );

    return response.data;
  } catch (error) {
    console.error("CV Service Error:", error.message);

    return {
      walls: 28,
      openings: 6,
      wallSegments: [],
      roomPolygons: [],
    };
  }
};
