```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Eye, EyeOff, Sparkles } from "lucide-react";

export default function App() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length > 0) {
      // Simulate simple shake or feedback
      setIsError(true);
      setTimeout(() => setIsError(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100"
      >
        <div className="flex flex-col items-center">
          {/* Lock Icon Section */}
          <div className="relative mb-8 pt-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center relative z-10"
            >
              <div className="w-16 h-16 rounded-full bg-blue-100/50 flex items-center justify-center">
                <Lock className="w-8 h-8 text-blue-600 fill-blue-600/10" strokeWidth={2.5} />
              </div>
            </motion.div>

            {/* Decorative Sparkles */}
            <motion.div
              animate={{
                y: [0, -5, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -top-2 -right-4 text-blue-200"
            >
              <Sparkles size={16} />
            </motion.div>
            <motion.div
              animate={{
                y: [0, 5, 0],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute bottom-4 -left-6 text-blue-200"
            >
              <Sparkles size={12} />
            </motion.div>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute top-2 -left-8 text-blue-200"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            </motion.div>
            <motion.div
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.5,
              }}
              className="absolute top-12 -right-10 text-blue-200"
            >
              <div className="w-1 h-1 rounded-full bg-blue-300" />
            </motion.div>
          </div>

          {/* Text Content */}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4 text-center tracking-tight">
            Chapter locked
          </h1>
          <p className="text-gray-500 text-center leading-relaxed mb-10 max-w-[280px]">
            Chương này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để tiếp tục đọc.
          </p>

          {/* Form */}
          <form className="w-full space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 ml-1">
                Mật khẩu
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={18} strokeWidth={2.5} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className={`w-full h-14 pl-12 pr-12 bg-white border ${
                    isError ? "border-red-300 ring-4 ring-red-50" : "border-gray-200 ring-4 ring-transparent"
                  } rounded-2xl focus:border-blue-400 focus:ring-blue-50 outline-none transition-all duration-200 placeholder:text-gray-300`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-600/20 active:shadow-none"
            >
              Mở khóa và đọc
            </motion.button>
          </form>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-50 w-full text-center">
            <p className="text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              Bạn không có mật khẩu?{" "}
              <a
                href="#"
                className="text-blue-600 font-medium hover:underline transition-all"
              >
                Liên hệ quản trị viên
              </a>{" "}
              hoặc tác giả để được cấp quyền truy cập.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

```