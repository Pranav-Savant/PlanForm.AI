import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function Navbar() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed top-0 left-0 w-full z-50
      bg-[#020617]/95 backdrop-blur-2xl
      border-b border-indigo-500/20
      shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
        {/* LEFT - LOGO */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          onClick={() => navigate("/")}
          className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent cursor-pointer"
        >
          PlanForm.AI
        </motion.div>

        {/* CENTER - NAV LINKS */}
        <div className="flex justify-center gap-10 text-sm font-medium">
          {[
            { name: "Home", path: "/" },
            { name: "Analyze", path: "/analyze" },
            { name: "About", path: "/about" },
          ].map((item, i) => (
            <NavLink key={i} to={item.path}>
              {({ isActive }) => (
                <div className="relative group cursor-pointer">
                  <span
                    className={`transition ${
                      isActive
                        ? "text-white"
                        : "text-zinc-400 group-hover:text-white"
                    }`}
                  >
                    {item.name}
                  </span>

                  {/* underline */}
                  <span
                    className={`absolute left-0 -bottom-1 h-[2px] w-full
                    bg-gradient-to-r from-indigo-500 to-blue-500
                    transform origin-left transition duration-300
                    ${
                      isActive
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </div>
              )}
            </NavLink>
          ))}
        </div>

        {/* RIGHT - CTA BUTTON */}
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/analyze")}
            className="px-5 py-2 rounded-lg text-sm font-medium
            bg-gradient-to-r from-indigo-500 to-blue-500
            hover:from-indigo-600 hover:to-blue-600
            shadow-lg transition"
          >
            Try Now →
          </motion.button>
        </div>
      </div>

      {/* SEPARATOR */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </div>
  );
}

export default Navbar;
