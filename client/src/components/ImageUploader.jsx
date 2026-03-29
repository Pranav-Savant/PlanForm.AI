function ImageUploader({ image, setImage, setImageFile }) {
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImage(URL.createObjectURL(file));
    }
  };

  return (
    <div className="w-full">

      <div className="relative border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-indigo-400 transition-all duration-300 bg-white/5">

        {!image ? (
          <div className="flex flex-col items-center justify-center gap-4">

            {/* Icon */}
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-xl">
              ⬆
            </div>

            {/* Text */}
            <div>
              <p className="text-lg font-medium text-white">
                Upload your floor plan
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                PNG, JPG up to 10MB
              </p>
            </div>

            {/* Input */}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="mt-2 text-sm text-zinc-300 file:mr-4 file:py-2 file:px-5 
              file:rounded-lg file:border-0 file:font-medium
              file:bg-gradient-to-r file:from-indigo-500 file:to-blue-500 
              file:text-white hover:file:from-indigo-600 hover:file:to-blue-600 
              cursor-pointer"
            />

          </div>
        ) : (
          <div className="relative group">
            <img
              src={image}
              alt="Floor Plan Preview"
              className="w-full rounded-xl border border-white/10 shadow-lg"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
              <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-sm font-medium shadow">
                Change Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default ImageUploader;