const webpack = require('webpack');

module.exports = {
  resolve: {
    fallback: {
      "crypto": false,
      "fs": false,
      "path": false,
      "stream": false,
      "buffer": false,
      "node:crypto": false,
      "node:fs": false
    },
    alias: {
      "node:crypto": false,
      "node:fs": false
    }
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      const mod = resource.request.replace(/^node:/, '');
      resource.request = mod;
    })
  ]
};
