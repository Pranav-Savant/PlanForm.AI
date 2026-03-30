// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { useEffect } from "react";
import Tilt from "react-parallax-tilt";

export default function AboutUs() {
  // Cursor glow follow
  useEffect(() => {
    const glow = document.getElementById("cursorGlow");

    const move = (e) => {
      if (glow) {
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
      }
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  const sections = [
    {
      title: "🚧 Problem & Objectives",
      content: [
        "Floor plans are static images with no structured data",
        "Manual interpretation is slow and inefficient",
        "Difficult to detect rooms, doors, windows automatically",
        "Goal: Convert images → structured usable data",
      ],
    },
    {
      title: "💡 Our Solution",
      content: [
        "Computer vision extracts wall structures",
        "Adaptive wall thickness detection",
        "Graph-based spatial understanding",
        "Automatic door & window detection",
        "Transforms plans into intelligent data",
      ],
    },
    {
      title: "⚙️ Tech Stack",
      content: [
        "Python + OpenCV",
        "NumPy",
        "Graph modeling",
        "React + Tailwind",
        "Framer Motion",
      ],
    },
    {
      title: "🚀 Why We Stand Out",
      content: [
        "No hardcoded rules (adaptive)",
        "Hybrid detection (geometry + symbols)",
        "Graph-based reasoning",
        "Works on real noisy plans",
        "Scalable & practical",
      ],
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#0b1120] text-white overflow-hidden">
      {/* GRID BACKGROUND */}
      <div className="absolute inset-0 bg-[linear-gradient(#1e293b_1px,transparent_1px),linear-gradient(90deg,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-30"></div>

      {/* CURSOR GLOW */}
      <div
        id="cursorGlow"
        className="fixed w-72 h-72 bg-blue-500/20 blur-3xl rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"
      ></div>

      {/* CONTENT */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-16">
        {/* TITLE */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-bold text-center mb-16 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"
        >
          About Our Project
        </motion.h1>

        {/* SECTIONS */}
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="mb-12"
          >
            <Tilt tiltMaxAngleX={6} tiltMaxAngleY={6}>
              <div className="relative group">
                {/* GLOW BORDER */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 blur-xl transition duration-500"></div>

                {/* CARD */}
                <div className="relative rounded-2xl p-8 bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 overflow-hidden">
                  {/* LIGHT SWEEP */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-700">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  </div>

                  {/* TITLE */}
                  <h2 className="text-2xl font-bold mb-5 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {section.title}
                  </h2>

                  {/* CONTENT */}
                  <ul className="space-y-3 text-gray-300">
                    {section.content.map((item, idx) => (
                      <motion.li
                        key={idx}
                        whileHover={{ x: 6 }}
                        className="flex items-center gap-2 cursor-pointer transition"
                      >
                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                        {item}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </Tilt>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
