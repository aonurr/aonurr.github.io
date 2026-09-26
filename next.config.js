/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",       // statik export -> ./out klasörü oluşturur
  images: {
    unoptimized: true,    // GitHub Pages image optimization desteklemiyor
  },
};

module.exports = nextConfig;