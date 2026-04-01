import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

function HomePage() {
  const navigate = useNavigate();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const steps = [
    {
      title: "Floor Plan Parsing",
      desc: "Extract walls, detect edges, and clean raw geometry for structured analysis.",
    },
    {
      title: "Geometry Reconstruction",
      desc: "Build spatial relationships and align layout into meaningful structures.",
    },
    {
      title: "3D Model Generation",
      desc: "Convert 2D layouts into 3D models with depth and elevation.",
    },
    {
      title: "Material Analysis",
      desc: "Evaluate materials based on strength, durability, and cost trade-offs.",
    },
    {
      title: "Explainability",
      desc: "Provide AI-driven insights explaining decisions and optimizations.",
    },
  ];

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* PARTICLES */}
      <div className="absolute inset-0 overflow-hidden z-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* CURSOR GLOW */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `radial-gradient(400px at ${mousePos.x}px ${mousePos.y}px, rgba(99,102,241,0.15), transparent 80%)`,
        }}
      />

      {/* HERO */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-6xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Autonomous Structural
            </span>
            <br />
            Intelligence System
          </h1>

          <p className="mt-6 text-lg text-zinc-400 max-w-xl">
            Transform floor plans into intelligent structural insights using
            AI-driven systems.
          </p>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/analyze")}
            className="mt-10 px-10 py-4 rounded-xl text-lg font-semibold
            bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 shadow-xl"
          >
            Start Analysis →
          </motion.button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex justify-center"
        >
          <div className="absolute w-[350px] h-[350px] bg-indigo-500/20 blur-3xl rounded-full"></div>

          <img
            src="https://pngimg.com/uploads/house/house_PNG63.png"
            alt="3D Floorplan"
            className="relative w-[480px] drop-shadow-[0_0_60px_rgba(99,102,241,0.6)]
            hover:scale-105 transition duration-500"
          />
        </motion.div>
      </div>

      {/* HOW IT WORKS */}
      <div className="relative z-10 py-32 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-semibold">How It Works</h2>
            <p className="text-zinc-400 mt-4">
              A high-performance AI pipeline for structural intelligence
            </p>
          </div>

          <div className="relative">
            <div
              className="absolute left-1/2 top-0 h-full w-[3px]
              bg-gradient-to-b from-indigo-500 via-blue-500 to-transparent
              -translate-x-1/2 blur-[1px]"
            />

            {steps.map((step, i) => {
              const isLeft = i % 2 === 0;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isLeft ? -80 : 80 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className={`relative flex items-center mb-24 ${
                    isLeft ? "justify-start" : "justify-end"
                  }`}
                >
                  {/* 🔥 GRADIENT BORDER CARD */}
                  <div className="group relative w-full md:w-[45%]">
                    <div
                      className="p-[1px] rounded-2xl
                      bg-gradient-to-r from-indigo-500/40 via-blue-500/30 to-cyan-500/40
                      hover:from-indigo-500 hover:to-cyan-500 transition-all duration-500"
                    >
                      <div className="bg-[#0b0f19]/90 backdrop-blur-xl rounded-2xl p-7">
                        <div className="text-xs text-indigo-300 mb-2 tracking-widest">
                          STEP 0{i + 1}
                        </div>

                        <h3 className="text-2xl font-semibold mb-3">
                          {step.title}
                        </h3>

                        <p className="text-zinc-400 text-sm leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* NODE */}
                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="w-14 h-14 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500
                      flex items-center justify-center text-white font-bold shadow-xl"
                    >
                      {i + 1}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
