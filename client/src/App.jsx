import { Routes, Route } from "react-router-dom";
import Layout from "./layout";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ResultsPage from "./pages/ResultsPage";
import AboutUs from "./pages/Aboutus";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyze" element={<UploadPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/about" element={<AboutUs />} />
      </Route>
    </Routes>
  );
}

export default App;
