import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

function Footer() {
  return (
    <footer className="relative mt-32 border-t border-white/10 text-white overflow-hidden">

      <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#0f172a] to-transparent" />

      <div className="relative max-w-7xl mx-auto px-6 py-16">

        <div className="grid md:grid-cols-3 gap-12">

          {/* LEFT */}
          <div>
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
              PlanForm.AI
            </h2>

            <p className="mt-4 text-zinc-400 text-sm leading-relaxed max-w-sm">
              Autonomous structural intelligence system transforming floor plans into
              actionable insights using AI, 3D modeling, and material optimization.
            </p>
          </div>

          {/* ✅ CENTER (UPDATED WITH NAVLINK) */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 tracking-wider">
              NAVIGATION
            </h3>

            <ul className="space-y-3 text-sm">
              {[
                { name: "Home", path: "/" },
                { name: "Analyze", path: "/analyze" },
                { name: "About", path: "/about" },
              ].map((item, i) => (
                <li key={i}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `transition ${
                        isActive
                          ? "text-indigo-400"
                          : "text-zinc-400 hover:text-white"
                      }`
                    }
                  >
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* RIGHT */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-4 tracking-wider">
              HACKATHON PROJECT
            </h3>

            <p className="text-zinc-400 text-sm leading-relaxed">
              Built for innovation challenges — combining AI, computer vision, and
              structural analysis into a unified intelligent pipeline.
            </p>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="mt-5 inline-block px-4 py-2 rounded-lg
              bg-gradient-to-r from-indigo-500 to-blue-500
              text-sm font-medium shadow-lg"
            >
              🚀 Hackathon Build
            </motion.div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-center text-zinc-500 text-sm">
          © {new Date().getFullYear()} PlanForm.AI • Built with AI & Innovation
        </div>

      </div>
    </footer>
  );
}

export default Footer;